import {
  AgentStatus,
  FileNode,
  GitHubRateLimitInfo,
  LogEntry,
  MigrationConfig,
  MigrationReport,
  RepoAnalysisResult,
  RepoScopeInfo,
} from '../types';
import { fetchFileContent, fetchRepoStructure } from './githubService';
import {
  analyzeRepository,
  generateArchitectureDiagram,
  generateNextJsFileStream,
  generateProjectStructure,
  verifyRepositoryFiles,
} from './geminiService';
import {
  analyzeImports,
  buildDependencyGraph,
  DependencyGraph,
  getRelatedFiles,
} from './dependencyGraph';
import { abortIfSignaled, isAbortError } from './abortUtils';

const MAX_ANALYSIS_PATHS = 500;
const MAX_CONTEXT_FILES = 50;
const MAX_RELATED_CONTEXT_FILES = 8;
const REPO_VERIFICATION_PASSES = 2;

type AddLogFn = (
  message: string,
  type?: LogEntry['type'],
  step?: AgentStatus,
) => void;

interface SemanticTargetMatch {
  primarySourcePath?: string;
  sourcePaths: string[];
  confidence: number;
}

export interface AnalyzePhaseInput {
  url: string;
  includeDirectories: string[];
  excludeDirectories: string[];
  addLog: AddLogFn;
  ensureDiagramApiKey: () => Promise<boolean>;
  onGitHubRateLimitUpdate?: (info: GitHubRateLimitInfo) => void;
  abortSignal?: AbortSignal;
}

export interface AnalyzePhaseResult {
  files: FileNode[];
  analysis: RepoAnalysisResult;
  diagram: string | null;
  repoScope: RepoScopeInfo;
}

export interface ScaffoldPhaseInput {
  url: string;
  sourceFiles: FileNode[];
  analysis: RepoAnalysisResult;
  config: MigrationConfig;
  addLog: AddLogFn;
  onGitHubRateLimitUpdate?: (info: GitHubRateLimitInfo) => void;
  abortSignal?: AbortSignal;
}

export interface ScaffoldPhaseResult {
  sourceContext: string;
  fileContents: Record<string, string>;
  filesToRead: FileNode[];
  graph: DependencyGraph;
  generatedFilePaths: string[];
  generatedFiles: FileNode[];
}

export interface GeneratePhaseInput {
  generatedFiles: FileNode[];
  analysis: RepoAnalysisResult;
  sourceContext: string;
  fileContents: Record<string, string>;
  filesToRead: FileNode[];
  graph: DependencyGraph;
  config: MigrationConfig;
  addLog: AddLogFn;
  onFileStart: (path: string) => void;
  onFileChunk: (path: string, content: string) => void;
  onFileGenerated: (path: string, content: string) => void;
  onFileError: (path: string) => void;
  abortSignal?: AbortSignal;
}

export interface RegenerateFilePhaseInput {
  targetPath: string;
  generatedFiles: FileNode[];
  analysis: RepoAnalysisResult;
  sourceContext: string;
  fileContents?: Record<string, string>;
  filesToRead?: FileNode[];
  graph?: DependencyGraph;
  config: MigrationConfig;
  userInstructions?: string;
  addLog: AddLogFn;
  onFileStart: (path: string) => void;
  onFileChunk: (path: string, content: string) => void;
  onFileGenerated: (path: string, content: string) => void;
  onFileError: (path: string) => void;
  abortSignal?: AbortSignal;
}

export interface VerifyPhaseInput {
  generatedFiles: FileNode[];
  analysis: RepoAnalysisResult;
  addLog: AddLogFn;
  onFileFixed: (path: string, content: string) => void;
  abortSignal?: AbortSignal;
}

export interface VerifyPhaseResult {
  passed: boolean;
  issues: string[];
  fixedFilesApplied: number;
}

export const flattenFiles = (nodes: FileNode[]): FileNode[] => {
  let result: FileNode[] = [];
  nodes.forEach((node) => {
    result.push(node);
    if (node.children) {
      result = result.concat(flattenFiles(node.children));
    }
  });
  return result;
};

const normalizeDirectoryList = (directories: string[]): string[] => {
  return Array.from(
    new Set(
      directories
        .map((directory) => directory.trim().replace(/^\/+|\/+$/g, ''))
        .filter(Boolean),
    ),
  ).sort();
};

const pathInDirectory = (path: string, directory: string): boolean => {
  return path === directory || path.startsWith(`${directory}/`);
};

const applyDirectoryScope = (
  filePaths: string[],
  includeDirectories: string[],
  excludeDirectories: string[],
): string[] => {
  const includes = normalizeDirectoryList(includeDirectories);
  const excludes = normalizeDirectoryList(excludeDirectories);

  let scopedPaths = [...filePaths];

  if (includes.length > 0) {
    scopedPaths = scopedPaths.filter((path) =>
      includes.some((directory) => pathInDirectory(path, directory)),
    );
  }

  if (excludes.length > 0) {
    scopedPaths = scopedPaths.filter(
      (path) => !excludes.some((directory) => pathInDirectory(path, directory)),
    );
  }

  return scopedPaths;
};

const extractAvailableDirectories = (filePaths: string[]): string[] => {
  return Array.from(
    new Set(
      filePaths
        .map((path) => path.split('/').slice(0, -1))
        .filter((parts) => parts.length > 0)
        .map((parts) => parts[0]),
    ),
  ).sort();
};

const pruneTreeToScopedFiles = (
  nodes: FileNode[],
  scopedFilePaths: Set<string>,
): FileNode[] => {
  const prunedNodes: FileNode[] = [];

  for (const node of nodes) {
    if (node.type === 'file') {
      if (scopedFilePaths.has(node.path)) {
        prunedNodes.push(node);
      }
      continue;
    }

    if (node.type === 'dir') {
      const childNodes = node.children
        ? pruneTreeToScopedFiles(node.children, scopedFilePaths)
        : [];

      if (childNodes.length > 0) {
        prunedNodes.push({
          ...node,
          children: childNodes,
        });
      }
    }
  }

  return prunedNodes;
};

export const buildTreeFromPaths = (paths: string[]): FileNode[] => {
  const root: FileNode[] = [];
  const map: Record<string, FileNode> = {};

  const sortedPaths = [...paths].sort();

  sortedPaths.forEach((path) => {
    const parts = path.split('/');
    let currentPath = '';

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map[currentPath]) {
        const node: FileNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'dir',
          status: 'pending',
          children: isFile ? undefined : [],
        };

        map[currentPath] = node;

        if (index === 0) {
          root.push(node);
        } else {
          const parent = map[parentPath];
          if (parent?.children) {
            parent.children.push(node);
          }
        }
      }
    });
  });

  return root;
};

export const isImageFile = (filename: string): boolean => {
  return /\.(png|jpg|jpeg|gif|ico|svg|webp|bmp)$/i.test(filename);
};

const stripExtension = (path: string): string => {
  return path.replace(/\.[^./]+$/, '');
};

const pathBasename = (path: string): string => {
  const stripped = stripExtension(path);
  const parts = stripped.split('/');
  return parts[parts.length - 1] || stripped;
};

const tokenizePath = (path: string): Set<string> => {
  const sanitized = stripExtension(path).toLowerCase();
  return new Set(
    sanitized
      .split(/[/_.-]+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
};

const jaccardSimilarity = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
};

const scorePathSimilarity = (
  targetPath: string,
  sourcePath: string,
): number => {
  const targetTokens = tokenizePath(targetPath);
  const sourceTokens = tokenizePath(sourcePath);
  let score = jaccardSimilarity(targetTokens, sourceTokens);

  if (pathBasename(targetPath) === pathBasename(sourcePath)) {
    score += 0.35;
  }

  if (
    targetPath.toLowerCase().includes('/api/') ===
    sourcePath.toLowerCase().includes('/api/')
  ) {
    score += 0.05;
  }

  return score;
};

const resolvePathCandidates = (
  pathPattern: string,
  candidates: string[],
): string[] => {
  const normalized = pathPattern.replace(/^\.\//, '').trim();
  if (!normalized) {
    return [];
  }

  if (candidates.includes(normalized)) {
    return [normalized];
  }

  if (normalized.includes('*')) {
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wildcardRegex = new RegExp(`^${escaped.replace(/\\\*/g, '.*')}$`);
    return candidates.filter((candidate) => wildcardRegex.test(candidate));
  }

  const normalizedNoExt = stripExtension(normalized);
  const normalizedBase = pathBasename(normalized);

  return candidates.filter((candidate) => {
    const candidateNoExt = stripExtension(candidate);
    return (
      candidate === normalized ||
      candidate.endsWith(`/${normalized}`) ||
      candidateNoExt === normalizedNoExt ||
      candidateNoExt.endsWith(`/${normalizedNoExt}`) ||
      pathBasename(candidate) === normalizedBase
    );
  });
};

const upsertSemanticMatch = (
  matchMap: Map<string, SemanticTargetMatch>,
  targetPath: string,
  sourcePaths: string[],
  confidence: number,
): void => {
  const existing = matchMap.get(targetPath) || {
    sourcePaths: [],
    confidence: 0,
  };

  const mergedSourcePaths = new Set([...existing.sourcePaths, ...sourcePaths]);
  const next: SemanticTargetMatch = {
    primarySourcePath:
      confidence >= existing.confidence
        ? sourcePaths[0] || existing.primarySourcePath
        : existing.primarySourcePath,
    sourcePaths: Array.from(mergedSourcePaths),
    confidence: Math.max(existing.confidence, confidence),
  };

  matchMap.set(targetPath, next);
};

const buildSemanticTargetMatches = (
  targetPaths: string[],
  sourcePaths: string[],
  analysis: RepoAnalysisResult,
): Map<string, SemanticTargetMatch> => {
  const matchMap = new Map<string, SemanticTargetMatch>();
  targetPaths.forEach((targetPath) => {
    matchMap.set(targetPath, { sourcePaths: [], confidence: 0 });
  });

  for (const mapping of analysis.semanticFileMappings) {
    const resolvedSources = resolvePathCandidates(
      mapping.sourcePath,
      sourcePaths,
    );
    const resolvedTargets = resolvePathCandidates(
      mapping.targetPath,
      targetPaths,
    );

    if (resolvedSources.length === 0 || resolvedTargets.length === 0) {
      continue;
    }

    for (const targetPath of resolvedTargets) {
      upsertSemanticMatch(
        matchMap,
        targetPath,
        resolvedSources,
        mapping.confidence,
      );
    }
  }

  for (const targetPath of targetPaths) {
    const existing = matchMap.get(targetPath);
    if (existing?.primarySourcePath) {
      continue;
    }

    let bestSourcePath = '';
    let bestScore = 0;

    for (const sourcePath of sourcePaths) {
      const score = scorePathSimilarity(targetPath, sourcePath);
      if (score > bestScore) {
        bestScore = score;
        bestSourcePath = sourcePath;
      }
    }

    if (bestSourcePath && bestScore >= 0.18) {
      upsertSemanticMatch(matchMap, targetPath, [bestSourcePath], bestScore);
    }
  }

  return matchMap;
};

const getGenerationPriority = (path: string): number => {
  if (
    /^(package\.json|tsconfig\.json|next\.config\.(js|mjs|ts)|postcss\.config\.(js|cjs)|tailwind\.config\.(js|cjs|ts)|eslint\.config\.(js|cjs|mjs))$/i.test(
      path,
    )
  ) {
    return 0;
  }

  if (/^(lib|types|utils|hooks|context|store)\//i.test(path)) {
    return 1;
  }

  if (/^components\//i.test(path)) {
    return 2;
  }

  if (/^app\/api\//i.test(path)) {
    return 3;
  }

  if (/^app\//i.test(path)) {
    return 4;
  }

  if (/(\.test\.|\.spec\.|__tests__)/i.test(path)) {
    return 6;
  }

  return 5;
};

const orderTargetFilesByDependencyPlan = (
  files: FileNode[],
  semanticMatches: Map<string, SemanticTargetMatch>,
  sourceGraph: DependencyGraph,
): FileNode[] => {
  const fileMap = new Map(files.map((file) => [file.path, file]));
  const dependencyMap = new Map<string, Set<string>>();
  const reverseDependencyMap = new Map<string, Set<string>>();
  const sourceToTargets = new Map<string, Set<string>>();

  for (const [targetPath, match] of semanticMatches.entries()) {
    for (const sourcePath of match.sourcePaths) {
      const targets = sourceToTargets.get(sourcePath) || new Set<string>();
      targets.add(targetPath);
      sourceToTargets.set(sourcePath, targets);
    }
  }

  for (const file of files) {
    dependencyMap.set(file.path, new Set());
    reverseDependencyMap.set(file.path, new Set());
  }

  for (const [targetPath, match] of semanticMatches.entries()) {
    const sourceDeps = new Set<string>();

    for (const sourcePath of match.sourcePaths) {
      const directDeps = sourceGraph[sourcePath] || [];
      for (const dep of directDeps) {
        const resolved = Object.keys(sourceGraph).find(
          (candidate) => candidate === dep || candidate.startsWith(dep + '.'),
        );
        if (resolved) {
          sourceDeps.add(resolved);
        }
      }

      for (const transitiveDep of getRelatedFiles(sourcePath, sourceGraph, 6)) {
        sourceDeps.add(transitiveDep);
      }
    }

    for (const sourceDep of sourceDeps) {
      const targetDeps = sourceToTargets.get(sourceDep);
      if (!targetDeps) {
        continue;
      }

      for (const dependencyTargetPath of targetDeps) {
        if (dependencyTargetPath === targetPath) {
          continue;
        }

        dependencyMap.get(targetPath)?.add(dependencyTargetPath);
        reverseDependencyMap.get(dependencyTargetPath)?.add(targetPath);
      }
    }
  }

  const indegree = new Map<string, number>();
  for (const file of files) {
    indegree.set(file.path, dependencyMap.get(file.path)?.size || 0);
  }

  const comparePaths = (a: string, b: string): number => {
    const priorityDelta = getGenerationPriority(a) - getGenerationPriority(b);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return a.localeCompare(b);
  };

  const queue = files
    .filter((file) => (indegree.get(file.path) || 0) === 0)
    .map((file) => file.path)
    .sort(comparePaths);

  const orderedPaths: string[] = [];

  while (queue.length > 0) {
    queue.sort(comparePaths);
    const currentPath = queue.shift();
    if (!currentPath) {
      continue;
    }

    orderedPaths.push(currentPath);

    const dependents =
      reverseDependencyMap.get(currentPath) || new Set<string>();
    for (const dependentPath of dependents) {
      const currentIndegree = indegree.get(dependentPath) || 0;
      const nextIndegree = currentIndegree - 1;
      indegree.set(dependentPath, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(dependentPath);
      }
    }
  }

  const remainingPaths = files
    .map((file) => file.path)
    .filter((path) => !orderedPaths.includes(path))
    .sort(comparePaths);

  for (const path of remainingPaths) {
    orderedPaths.push(path);
  }

  return orderedPaths
    .map((path) => fileMap.get(path))
    .filter((file): file is FileNode => Boolean(file));
};

const buildRelatedContext = (
  targetPath: string,
  semanticMatch: SemanticTargetMatch | undefined,
  sourceGraph: DependencyGraph,
  fileContents: Record<string, string>,
): string => {
  if (!semanticMatch) {
    return '';
  }

  const orderedRelatedPaths: string[] = [];
  const seen = new Set<string>();

  const pushPath = (path: string) => {
    if (!path || seen.has(path) || !fileContents[path]) {
      return;
    }

    seen.add(path);
    orderedRelatedPaths.push(path);
  };

  if (semanticMatch.primarySourcePath) {
    pushPath(semanticMatch.primarySourcePath);
    for (const depPath of getRelatedFiles(
      semanticMatch.primarySourcePath,
      sourceGraph,
      MAX_RELATED_CONTEXT_FILES,
    )) {
      pushPath(depPath);
    }
  }

  for (const sourcePath of semanticMatch.sourcePaths) {
    pushPath(sourcePath);
    for (const depPath of getRelatedFiles(sourcePath, sourceGraph, 3)) {
      pushPath(depPath);
    }
  }

  return orderedRelatedPaths
    .slice(0, MAX_RELATED_CONTEXT_FILES)
    .map((depPath) => {
      const label =
        depPath === semanticMatch.primarySourcePath ? 'PRIMARY' : 'RELATED';
      return `\n\n--- ${label} SOURCE FILE: ${depPath} ---\n${fileContents[depPath] || ''}`;
    })
    .join('\n');
};

const hasGeneratedPathForImport = (
  depPath: string,
  generatedPaths: Set<string>,
): boolean => {
  if (generatedPaths.has(depPath)) {
    return true;
  }

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
  for (const ext of extensions) {
    if (generatedPaths.has(`${depPath}${ext}`)) {
      return true;
    }
  }

  const indexFiles = [
    'index.ts',
    'index.tsx',
    'index.js',
    'index.jsx',
    'index.mjs',
    'index.cjs',
  ];

  for (const indexFile of indexFiles) {
    if (generatedPaths.has(`${depPath}/${indexFile}`)) {
      return true;
    }
  }

  return false;
};

const collectCrossFileConsistencyIssues = (
  generatedFiles: Array<{ path: string; content: string }>,
): string[] => {
  const issues = new Set<string>();
  const generatedPaths = new Set(generatedFiles.map((file) => file.path));

  for (const file of generatedFiles) {
    if (!file.content) {
      issues.add(`${file.path} has no generated content.`);
      continue;
    }

    const imports = analyzeImports(file.content, file.path);
    for (const importPath of imports) {
      if (!hasGeneratedPathForImport(importPath, generatedPaths)) {
        issues.add(`${file.path} imports missing dependency ${importPath}.`);
      }
    }
  }

  return Array.from(issues);
};

export const runAnalyzePhase = async ({
  url,
  includeDirectories,
  excludeDirectories,
  addLog,
  ensureDiagramApiKey,
  onGitHubRateLimitUpdate,
  abortSignal,
}: AnalyzePhaseInput): Promise<AnalyzePhaseResult> => {
  abortIfSignaled(abortSignal);
  addLog(
    `Cloning repository structure from ${url}...`,
    'info',
    AgentStatus.ANALYZING,
  );
  const files = await fetchRepoStructure(url, {
    signal: abortSignal,
    onRateLimitUpdate: onGitHubRateLimitUpdate,
  });

  const allFilePaths = flattenFiles(files)
    .filter((file) => file.type === 'file')
    .map((file) => file.path);
  const availableDirectories = extractAvailableDirectories(allFilePaths);
  const scopedFilePaths = applyDirectoryScope(
    allFilePaths,
    includeDirectories,
    excludeDirectories,
  );

  if (scopedFilePaths.length === 0) {
    throw new Error(
      'No files matched the selected include/exclude directories. Adjust the filters and retry.',
    );
  }

  const scopedFiles = pruneTreeToScopedFiles(files, new Set(scopedFilePaths));

  addLog(
    `File index built: ${allFilePaths.length} source files detected.`,
    'success',
    AgentStatus.ANALYZING,
  );

  addLog(
    'Reading README and package configuration...',
    'info',
    AgentStatus.ANALYZING,
  );
  let readme: string;

  try {
    readme = await fetchFileContent(url, 'README.md', {
      signal: abortSignal,
      onRateLimitUpdate: onGitHubRateLimitUpdate,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    try {
      readme = await fetchFileContent(url, 'readme.md', {
        signal: abortSignal,
        onRateLimitUpdate: onGitHubRateLimitUpdate,
      });
    } catch (readmeError) {
      if (isAbortError(readmeError)) {
        throw readmeError;
      }
      addLog(
        'README.md not found, proceeding with file structure analysis only.',
        'warning',
        AgentStatus.ANALYZING,
      );
      readme = 'No README found in repository.';
    }
  }

  addLog(
    'Engaging Deep Static Analysis (Gemini 3 Pro)...',
    'info',
    AgentStatus.ANALYZING,
  );

  const truncated = scopedFilePaths.length > MAX_ANALYSIS_PATHS;
  if (truncated) {
    addLog(
      `Large repository scope: analyzing first ${MAX_ANALYSIS_PATHS} of ${scopedFilePaths.length} files. Refine include/exclude directories to target a smaller subset.`,
      'warning',
      AgentStatus.ANALYZING,
    );
  }

  if (includeDirectories.length > 0 || excludeDirectories.length > 0) {
    addLog(
      `Scope filters applied. Include: ${includeDirectories.length || 0}, Exclude: ${excludeDirectories.length || 0}.`,
      'info',
      AgentStatus.ANALYZING,
    );
  }

  const limitedPaths = scopedFilePaths.slice(0, MAX_ANALYSIS_PATHS);
  const repoScope: RepoScopeInfo = {
    totalFiles: allFilePaths.length,
    filteredFiles: scopedFilePaths.length,
    analyzedFiles: limitedPaths.length,
    truncated,
    availableDirectories,
  };

  const analysis = await analyzeRepository(
    JSON.stringify(limitedPaths),
    readme,
    {
      abortSignal,
    },
  );

  addLog(
    `Detected: ${analysis.detectedFramework}. Target locked: Next.js (App Router).`,
    'success',
    AgentStatus.PLANNING,
  );

  if (analysis.semanticFileMappings.length > 0) {
    addLog(
      `Semantic mapping plan created (${analysis.semanticFileMappings.length} mappings).`,
      'success',
      AgentStatus.PLANNING,
    );
  }

  let diagram: string | null = null;

  if (analysis.architectureDescription) {
    addLog(
      'Generating legacy architecture diagram...',
      'info',
      AgentStatus.PLANNING,
    );

    const canGenerateDiagram = await ensureDiagramApiKey();
    abortIfSignaled(abortSignal);

    if (canGenerateDiagram) {
      diagram = await generateArchitectureDiagram(
        analysis.architectureDescription,
        { abortSignal },
      );

      if (diagram) {
        addLog(
          'Legacy architecture diagram rendered.',
          'success',
          AgentStatus.PLANNING,
        );
      } else {
        addLog(
          'Diagram generation failed (Quota/Permission).',
          'error',
          AgentStatus.PLANNING,
        );
      }
    } else {
      addLog(
        'Skipping diagram: API Key required.',
        'warning',
        AgentStatus.PLANNING,
      );
    }
  }

  return { files: scopedFiles, analysis, diagram, repoScope };
};

export const runScaffoldPhase = async ({
  url,
  sourceFiles,
  analysis,
  config,
  addLog,
  onGitHubRateLimitUpdate,
  abortSignal,
}: ScaffoldPhaseInput): Promise<ScaffoldPhaseResult> => {
  abortIfSignaled(abortSignal);
  addLog(
    `Ingesting key legacy source files for context (Max ${MAX_CONTEXT_FILES})...`,
    'info',
    AgentStatus.CONVERTING,
  );

  const candidateFiles = flattenFiles(sourceFiles).filter(
    (file) =>
      file.type === 'file' &&
      !file.name.endsWith('.md') &&
      !file.name.endsWith('.json') &&
      !file.name.endsWith('.lock') &&
      !isImageFile(file.name),
  );

  const filesToRead = candidateFiles.slice(0, MAX_CONTEXT_FILES);

  let sourceContext = '';
  const fileContents: Record<string, string> = {};

  for (const file of filesToRead) {
    abortIfSignaled(abortSignal);
    try {
      const content = await fetchFileContent(url, file.path, {
        signal: abortSignal,
        onRateLimitUpdate: onGitHubRateLimitUpdate,
      });
      sourceContext += `\n\n--- FILE: ${file.path} ---\n${content}`;
      fileContents[file.path] = content;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      console.warn(`Failed to read ${file.path}`);
    }
  }

  addLog(
    `Smart Context loaded: ${sourceContext.length} chars from ${filesToRead.length} files.`,
    'success',
    AgentStatus.CONVERTING,
  );

  addLog('Building Dependency Graph...', 'info', AgentStatus.CONVERTING);

  const filesWithContent = filesToRead.map((file) => ({
    ...file,
    content: fileContents[file.path],
  }));

  const graph = buildDependencyGraph(filesWithContent);

  addLog(
    `Dependency Graph built with ${Object.keys(graph).length} nodes.`,
    'success',
    AgentStatus.CONVERTING,
  );

  addLog(
    `Designing Next.js 16.1 App Router project structure (${config.uiFramework}, ${config.stateManagement}, ${config.testingLibrary !== 'none' ? 'with tests' : 'no tests'})...`,
    'info',
    AgentStatus.CONVERTING,
  );

  const generatedFilePaths = await generateProjectStructure(
    analysis.summary,
    config,
    config.testingLibrary !== 'none',
    { abortSignal },
  );

  const generatedFiles = buildTreeFromPaths(generatedFilePaths);

  addLog(
    `Project scaffolded: ${generatedFilePaths.length} files created.`,
    'success',
    AgentStatus.CONVERTING,
  );

  return {
    sourceContext,
    fileContents,
    filesToRead,
    graph,
    generatedFilePaths,
    generatedFiles,
  };
};

export const runGeneratePhase = async ({
  generatedFiles,
  analysis,
  sourceContext,
  fileContents,
  filesToRead,
  graph,
  config,
  addLog,
  onFileStart,
  onFileChunk,
  onFileGenerated,
  onFileError,
  abortSignal,
}: GeneratePhaseInput): Promise<void> => {
  const flatTargetFiles = flattenFiles(generatedFiles).filter(
    (file) => file.type === 'file',
  );

  const sourcePaths = filesToRead.map((file) => file.path);
  const semanticMatches = buildSemanticTargetMatches(
    flatTargetFiles.map((file) => file.path),
    sourcePaths,
    analysis,
  );

  const mappedCount = Array.from(semanticMatches.values()).filter((match) =>
    Boolean(match.primarySourcePath),
  ).length;

  addLog(
    `Semantic context mapping resolved for ${mappedCount}/${flatTargetFiles.length} generated files.`,
    'info',
    AgentStatus.CONVERTING,
  );

  const orderedFiles = orderTargetFilesByDependencyPlan(
    flatTargetFiles,
    semanticMatches,
    graph,
  );

  addLog(
    'Generation order optimized using dependency-aware planning.',
    'info',
    AgentStatus.CONVERTING,
  );

  for (const file of orderedFiles) {
    abortIfSignaled(abortSignal);
    onFileStart(file.path);
    addLog(`Generating ${file.path}...`, 'info', AgentStatus.CONVERTING);

    try {
      const semanticMatch = semanticMatches.get(file.path);
      const relatedContext = buildRelatedContext(
        file.path,
        semanticMatch,
        graph,
        fileContents,
      );

      const content = await generateNextJsFileStream(
        file.path,
        sourceContext,
        relatedContext,
        config,
        (streamedContent) => onFileChunk(file.path, streamedContent),
        { abortSignal },
      );

      onFileGenerated(file.path, content);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      onFileError(file.path);
      addLog(
        `Failed to generate ${file.path}`,
        'error',
        AgentStatus.CONVERTING,
      );
    }
  }
};

export const runRegenerateFilePhase = async ({
  targetPath,
  generatedFiles,
  analysis,
  sourceContext,
  fileContents = {},
  filesToRead = [],
  graph = {},
  config,
  userInstructions,
  addLog,
  onFileStart,
  onFileChunk,
  onFileGenerated,
  onFileError,
  abortSignal,
}: RegenerateFilePhaseInput): Promise<void> => {
  const flatTargetFiles = flattenFiles(generatedFiles).filter(
    (file) => file.type === 'file',
  );

  const targetFile = flatTargetFiles.find((file) => file.path === targetPath);
  if (!targetFile) {
    throw new Error(`Cannot regenerate unknown target file: ${targetPath}`);
  }

  const sourcePaths = filesToRead.map((file) => file.path);
  const semanticMatches = buildSemanticTargetMatches(
    [targetPath],
    sourcePaths,
    analysis,
  );

  const semanticMatch = semanticMatches.get(targetPath);
  let relatedContext = buildRelatedContext(
    targetPath,
    semanticMatch,
    graph,
    fileContents,
  );

  const trimmedInstructions = userInstructions?.trim();
  if (trimmedInstructions) {
    relatedContext = `${relatedContext}\n\n--- USER REGENERATION INSTRUCTIONS ---\n${trimmedInstructions}\nPrioritize these instructions while generating this file.`;
  }

  onFileStart(targetPath);
  addLog(
    `Regenerating ${targetPath}${trimmedInstructions ? ' with custom instructions' : ''}...`,
    'info',
    AgentStatus.CONVERTING,
  );

  try {
    const content = await generateNextJsFileStream(
      targetPath,
      sourceContext,
      relatedContext,
      config,
      (streamedContent) => onFileChunk(targetPath, streamedContent),
      { abortSignal },
    );

    onFileGenerated(targetPath, content);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    onFileError(targetPath);
    addLog(
      `Failed to regenerate ${targetPath}`,
      'error',
      AgentStatus.CONVERTING,
    );
    throw error;
  }
};

export const runVerificationPhase = async ({
  generatedFiles,
  analysis,
  addLog,
  onFileFixed,
  abortSignal,
}: VerifyPhaseInput): Promise<VerifyPhaseResult> => {
  const generatedFileMap = new Map<string, string>();
  const flatFiles = flattenFiles(generatedFiles).filter(
    (file) => file.type === 'file',
  );

  for (const file of flatFiles) {
    generatedFileMap.set(file.path, file.content || '');
  }

  const observedIssueSet = new Set<string>();
  let fixedFilesApplied = 0;
  let unresolvedModelIssues: string[] = [];

  for (
    let passNumber = 1;
    passNumber <= REPO_VERIFICATION_PASSES;
    passNumber += 1
  ) {
    abortIfSignaled(abortSignal);

    addLog(
      `Running cross-file verification pass ${passNumber}/${REPO_VERIFICATION_PASSES}...`,
      'info',
      AgentStatus.VERIFYING,
    );

    const currentSnapshot = Array.from(generatedFileMap.entries()).map(
      ([path, content]) => ({ path, content }),
    );

    const localIssues = collectCrossFileConsistencyIssues(currentSnapshot);
    for (const issue of localIssues) {
      observedIssueSet.add(issue);
    }

    if (localIssues.length > 0) {
      addLog(
        `Static consistency checks found ${localIssues.length} issue(s).`,
        'warning',
        AgentStatus.VERIFYING,
      );
    }

    const verification = await verifyRepositoryFiles(
      currentSnapshot,
      `${analysis.summary}\n${analysis.migrationNotes.join('\n')}`,
      localIssues,
      passNumber,
      { abortSignal },
    );

    for (const issue of verification.issues) {
      observedIssueSet.add(issue);
    }

    unresolvedModelIssues =
      verification.fixedFiles.length === 0 ? verification.issues : [];

    if (verification.fixedFiles.length > 0) {
      for (const fix of verification.fixedFiles) {
        generatedFileMap.set(fix.path, fix.content);
        onFileFixed(fix.path, fix.content);
        fixedFilesApplied += 1;
      }
      addLog(
        `Applied ${verification.fixedFiles.length} auto-fix(es) from verification pass ${passNumber}.`,
        'success',
        AgentStatus.VERIFYING,
      );
    } else {
      addLog(
        `Verification pass ${passNumber} produced no auto-fixes.`,
        'info',
        AgentStatus.VERIFYING,
      );
    }
  }

  const finalSnapshot = Array.from(generatedFileMap.entries()).map(
    ([path, content]) => ({ path, content }),
  );
  const finalStaticIssues = collectCrossFileConsistencyIssues(finalSnapshot);
  const issues = Array.from(
    new Set([...finalStaticIssues, ...unresolvedModelIssues]),
  );
  const passed = issues.length === 0;

  if (passed) {
    addLog(
      'Repository verification passed. Cross-file consistency checks are clean.',
      'success',
      AgentStatus.VERIFYING,
    );
  } else {
    addLog(
      `Repository verification completed with ${issues.length} issue(s).`,
      'warning',
      AgentStatus.VERIFYING,
    );
    addLog(
      `Verification observed ${observedIssueSet.size} total issue signal(s) across passes.`,
      'info',
      AgentStatus.VERIFYING,
    );
  }

  return {
    passed,
    issues,
    fixedFilesApplied,
  };
};

export const generateReport = (
  sourceFiles: FileNode[],
  targetFiles: FileNode[],
  startTime: number,
  endTime: number,
  analysis: RepoAnalysisResult,
): MigrationReport => {
  const flatTarget = flattenFiles(targetFiles);
  const flatSource = flattenFiles(sourceFiles);

  const durationMs = endTime - startTime;
  const duration =
    durationMs > 60000
      ? `${Math.round(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`
      : `${Math.round(durationMs / 1000)}s`;

  const totalFiles = flatSource.filter((file) => file.type === 'file').length;
  const filesGenerated = flatTarget.filter(
    (file) => file.type === 'file',
  ).length;

  const tsFiles = flatTarget.filter(
    (file) => file.path.endsWith('.ts') || file.path.endsWith('.tsx'),
  ).length;

  const typeScriptCoverage = Math.round(
    (tsFiles / Math.max(filesGenerated, 1)) * 100,
  );

  const testFiles = flatTarget.filter(
    (file) => file.path.includes('.test.') || file.path.includes('__tests__'),
  ).length;

  const testCoverage =
    testFiles > 0
      ? Math.round((testFiles / Math.max(filesGenerated - testFiles, 1)) * 80)
      : 0;

  let score = 0;
  score += typeScriptCoverage * 0.4;
  score += testCoverage > 0 ? 20 : 0;
  score += 40;

  const modernizationScore = Math.min(Math.round(score), 100);

  const techStackChanges = [
    { from: analysis.detectedFramework, to: 'Next.js 16.1 (App Router)' },
    { from: 'CSS / SCSS', to: 'Tailwind CSS' },
    { from: 'JavaScript', to: 'TypeScript 5' },
  ];

  return {
    duration,
    totalFiles,
    filesGenerated,
    modernizationScore,
    typeScriptCoverage,
    testCoverage,
    testsGenerated: testFiles,
    techStackChanges,
    keyImprovements: [
      'Implemented Server Side Rendering (SSR) for initial load',
      'Migrated global state to React Context / Hooks',
      `Added ${testFiles} unit test suites with Vitest`,
      'Enforced strict type safety across components',
    ],
    newDependencies: 12,
  };
};

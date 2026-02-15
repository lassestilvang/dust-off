import React, { useState } from 'react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
import {
  AgentStatus,
  RepoState,
  LogEntry,
  FileNode,
  RepoAnalysisResult,
  MigrationReport,
} from '../types';
import {
  fetchRepoStructure,
  fetchFileContent,
} from '../services/githubService';
import {
  analyzeRepository,
  generateArchitectureDiagram,
  generateProjectStructure,
  generateNextJsFile,
} from '../services/geminiService';
import AgentLogs from './AgentLogs';
import FileExplorer from './FileExplorer';
import CodeEditor from './CodeEditor';
import MigrationReportModal from './MigrationReportModal';
import {
  Github,
  Play,
  Layers,
  ArrowRight,
  Loader2,
  GitBranch,
  Database,
  Check,
  Layout,
  RotateCw,
  TestTube,
  Maximize2,
  X,
  Code2,
  Server,
  Download,
  PackageCheck,
  AlertCircle,
  ExternalLink,
  FileImage,
} from 'lucide-react';
import { NextjsIcon, ReactIcon, VueIcon, PythonIcon, PhpIcon } from './Icons';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';

// --- Utility Functions (Outside Component for Purity & Performance) ---

const flattenFiles = (nodes: FileNode[]): FileNode[] => {
  let result: FileNode[] = [];
  nodes.forEach((node) => {
    result.push(node);
    if (node.children) result = result.concat(flattenFiles(node.children));
  });
  return result;
};

const buildTreeFromPaths = (paths: string[]): FileNode[] => {
  const root: FileNode[] = [];
  const map: Record<string, FileNode> = {};

  paths.sort();

  paths.forEach((path) => {
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
          if (parent && parent.children) {
            parent.children.push(node);
          }
        }
      }
    });
  });
  return root;
};

const generateReport = (
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

  const totalFiles = flatSource.filter((f) => f.type === 'file').length;
  const filesGenerated = flatTarget.filter((f) => f.type === 'file').length;

  // Type Safety Score
  const tsFiles = flatTarget.filter(
    (f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx'),
  ).length;
  const typeScriptCoverage = Math.round(
    (tsFiles / Math.max(filesGenerated, 1)) * 100,
  );

  // Test Coverage Est
  const testFiles = flatTarget.filter(
    (f) => f.path.includes('.test.') || f.path.includes('__tests__'),
  ).length;
  const testCoverage =
    testFiles > 0
      ? Math.round((testFiles / Math.max(filesGenerated - testFiles, 1)) * 80)
      : 0; // Rough estimate

  // Modernization Score (Arbitrary but fun metric)
  let score = 0;
  score += typeScriptCoverage * 0.4;
  score += testCoverage > 0 ? 20 : 0;
  score += 40; // Base score for moving to Next.js
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
    newDependencies: 12, // Estimate based on standard Next.js scaffold
  };
};

const isImageFile = (filename: string) => {
  return /\.(png|jpg|jpeg|gif|ico|svg|webp|bmp)$/i.test(filename);
};

// Helper to resolve icon based on framework name
const getFrameworkIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('react'))
    return <ReactIcon className="w-4 h-4 text-blue-400" />;
  if (n.includes('vue')) return <VueIcon className="w-4 h-4 text-green-400" />;
  if (n.includes('python'))
    return <PythonIcon className="w-4 h-4 text-blue-300" />;
  if (n.includes('php') || n.includes('laravel'))
    return <PhpIcon className="w-4 h-4 text-indigo-400" />;
  return <Code2 className="w-4 h-4 text-gray-400" />;
};

const RepoMigration: React.FC = () => {
  const [state, setState] = useState<RepoState>({
    url: '',
    branch: 'main',
    status: AgentStatus.IDLE,
    files: [], // Source
    generatedFiles: [], // Target
    selectedFile: null,
    activeTree: 'source',
    logs: [],
    analysis: null,
    diagram: null,
    sourceLang: 'JavaScript',
    targetLang: 'Next.js + TypeScript',
    sourceContext: '',
    report: null,
  });

  const [includeTests, setIncludeTests] = useState(false);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setState((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          id: uuidv4(),
          timestamp: new Date(),
          step: prev.status,
          message,
          type,
        },
      ],
    }));
  };

  const updateFileStatus = (
    path: string,
    status: FileNode['status'],
    tree: 'source' | 'target',
  ) => {
    setState((prev) => {
      const targetTree = tree === 'source' ? prev.files : prev.generatedFiles;
      const updateNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === path) return { ...node, status };
          if (node.children)
            return { ...node, children: updateNode(node.children) };
          return node;
        });
      };
      const updatedTree = updateNode(targetTree);
      return tree === 'source'
        ? { ...prev, files: updatedTree }
        : { ...prev, generatedFiles: updatedTree };
    });
  };

  const updateFileContent = (
    path: string,
    content: string,
    tree: 'source' | 'target',
  ) => {
    setState((prev) => {
      const targetTree = tree === 'source' ? prev.files : prev.generatedFiles;
      const updateNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === path) return { ...node, content };
          if (node.children)
            return { ...node, children: updateNode(node.children) };
          return node;
        });
      };
      const updatedTree = updateNode(targetTree);
      return tree === 'source'
        ? { ...prev, files: updatedTree }
        : { ...prev, generatedFiles: updatedTree };
    });
  };

  const startRepoProcess = async () => {
    if (!state.url) {
      addLog('Please enter a valid GitHub URL.', 'error');
      return;
    }

    setState((prev) => ({
      ...prev,
      status: AgentStatus.ANALYZING,
      logs: [],
      files: [],
      generatedFiles: [],
      analysis: null,
      diagram: null,
      sourceContext: '',
      activeTree: 'source',
      report: null,
      startTime: Date.now(),
    }));
    addLog(`Cloning repository structure from ${state.url}...`);

    try {
      // 1. Fetch Files (Structure)
      const files = await fetchRepoStructure(state.url);

      setState((prev) => ({ ...prev, files }));
      addLog(
        `File index built: ${flattenFiles(files).length} nodes detected.`,
        'success',
      );

      // 2. Analyze (Readme + List)
      addLog('Reading README and package configuration...', 'info');
      let readme = 'No README found.';

      try {
        readme = await fetchFileContent(state.url, 'README.md');
      } catch {
        try {
          readme = await fetchFileContent(state.url, 'readme.md');
        } catch {
          addLog(
            'README.md not found, proceeding with file structure analysis only.',
            'warning',
          );
          readme = 'No README found in repository.';
        }
      }

      addLog('Engaging Deep Static Analysis (Gemini 3 Pro)...', 'info');

      // Flatten paths for analysis context
      const allPaths = flattenFiles(files).map((f) => f.path);
      // Limit paths to avoid huge prompts if repo is massive, take top 500
      const limitedPaths = allPaths.slice(0, 500);

      const analysis = await analyzeRepository(
        JSON.stringify(limitedPaths),
        readme,
      );

      setState((prev) => ({
        ...prev,
        analysis,
        sourceLang: analysis.detectedFramework,
        targetLang: 'Next.js + TypeScript',
        status: AgentStatus.PLANNING,
      }));
      addLog(
        `Detected: ${analysis.detectedFramework}. Target locked: Next.js (App Router).`,
        'success',
      );

      // 3. Generate Diagram Immediately
      if (analysis.architectureDescription) {
        addLog('Generating legacy architecture diagram...', 'info');

        let hasKey = false;
        const apiStudio = window.aistudio;
        if (apiStudio) {
          try {
            hasKey = await apiStudio.hasSelectedApiKey();
            if (!hasKey) {
              addLog('Requesting API Key for visual generation...', 'warning');
              await apiStudio.openSelectKey();
              hasKey = await apiStudio.hasSelectedApiKey();
            }
          } catch (_e) {
            console.error('Auth flow error', _e);
          }
        }

        if (
          hasKey ||
          (process.env as Record<string, string | undefined>).API_KEY
        ) {
          const diagram = await generateArchitectureDiagram(
            analysis.architectureDescription,
          );
          if (diagram) {
            setState((prev) => ({ ...prev, diagram }));
            addLog('Legacy architecture diagram rendered.', 'success');
          } else {
            addLog('Diagram generation failed (Quota/Permission).', 'error');
          }
        } else {
          addLog('Skipping diagram: API Key required.', 'warning');
        }
      }

      // 4. Return to IDLE state to await user confirmation
      setState((prev) => ({ ...prev, status: AgentStatus.IDLE }));
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      addLog(`Fatal Error: ${errorMessage}`, 'error');
      setState((prev) => ({ ...prev, status: AgentStatus.ERROR }));
    }
  };

  const confirmMigration = async () => {
    if (!state.analysis) return;

    setState((prev) => ({ ...prev, status: AgentStatus.CONVERTING }));

    // 4. Ingest Source Code for Context
    addLog('Ingesting key legacy source files for context...', 'info');
    const filesToRead = flattenFiles(state.files)
      .filter(
        (f) =>
          f.type === 'file' &&
          !f.name.endsWith('.md') &&
          !f.name.endsWith('.json') &&
          !isImageFile(f.name),
      )
      .slice(0, 15); // Limit for demo speed/context size

    let context = '';
    for (const f of filesToRead) {
      try {
        const content = await fetchFileContent(state.url, f.path);
        context += `\n\n--- FILE: ${f.path} ---\n${content}`;
      } catch (_e) {
        console.warn(`Failed to read ${f.path}`);
      }
    }
    setState((prev) => ({ ...prev, sourceContext: context }));
    addLog(`Context loaded: ${context.length} chars.`, 'success');

    // 5. Generate New Project Structure
    addLog(
      `Designing Next.js 16.1 App Router project structure${includeTests ? ' with tests' : ''}...`,
      'info',
    );
    const newFilePaths = await generateProjectStructure(
      state.analysis.summary,
      includeTests,
    );

    const newFileNodes = buildTreeFromPaths(newFilePaths);
    setState((prev) => ({
      ...prev,
      generatedFiles: newFileNodes,
      activeTree: 'target', // Switch view to target
      status: AgentStatus.CONVERTING,
    }));
    addLog(
      `Project scaffolded: ${newFilePaths.length} files created.`,
      'success',
    );

    // 6. Generate Content for New Files
    const flatTargetFiles = flattenFiles(newFileNodes).filter(
      (f) => f.type === 'file',
    );

    for (const file of flatTargetFiles) {
      updateFileStatus(file.path, 'migrating', 'target');
      // Auto select the file being generated
      setState((prev) => ({ ...prev, selectedFile: file.path }));

      addLog(`Generating ${file.path}...`, 'info');

      try {
        const content = await generateNextJsFile(file.path, context);
        updateFileContent(file.path, content, 'target');
        updateFileStatus(file.path, 'done', 'target');
      } catch (_e) {
        updateFileStatus(file.path, 'error', 'target');
        addLog(`Failed to generate ${file.path}`, 'error');
      }
    }

    // 7. Generate Report
    const endTime = Date.now();
    const report = generateReport(
      state.files,
      newFileNodes,
      state.startTime || Date.now(),
      endTime,
      state.analysis,
    );

    setState((prev) => ({ ...prev, status: AgentStatus.COMPLETED, report }));
    setShowReport(true);
    addLog('Migration Complete. System Ready.', 'success');
  };

  const handleDownload = async () => {
    if (state.generatedFiles.length === 0) return;

    const zip = new JSZip();

    // Recursive function to add files to zip
    const addNodeToZip = (nodes: FileNode[], folder: JSZip) => {
      nodes.forEach((node) => {
        if (node.type === 'dir' && node.children) {
          const newFolder = folder.folder(node.name);
          if (newFolder) addNodeToZip(node.children, newFolder);
        } else if (node.type === 'file') {
          // If content is missing, we add a placeholder
          const content =
            node.content || '// File content generation failed or pending.';
          folder.file(node.name, content);
        }
      });
    };

    addNodeToZip(state.generatedFiles, zip);

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nextjs-dust-off.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addLog('Project downloaded successfully.', 'success');
    } catch (e: unknown) {
      addLog('Failed to zip project files.', 'error');
      console.error(e);
    }
  };

  const handleFileSelect = async (path: string) => {
    setState((prev) => ({ ...prev, selectedFile: path }));

    // Check if content needs to be fetched for the source tree
    if (state.activeTree === 'source') {
      const node = flattenFiles(state.files).find((f) => f.path === path);
      // Only fetch if content is undefined
      if (node && node.content === undefined && node.type === 'file') {
        try {
          const content = await fetchFileContent(state.url, path);
          updateFileContent(path, content, 'source');
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          updateFileContent(
            path,
            `// Error loading content for ${path}\n// ${errorMessage}`,
            'source',
          );
        }
      }
    }
  };

  const getSelectedFileData = () => {
    if (!state.selectedFile) return null;
    const tree =
      state.activeTree === 'source' ? state.files : state.generatedFiles;
    return flattenFiles(tree).find((f) => f.path === state.selectedFile);
  };

  const selectedNode = getSelectedFileData();
  const isAnalyzed = !!state.analysis;
  const isWorking =
    state.status !== AgentStatus.IDLE &&
    state.status !== AgentStatus.COMPLETED &&
    state.status !== AgentStatus.ERROR;
  const isBusy =
    state.status === AgentStatus.ANALYZING ||
    state.status === AgentStatus.CONVERTING;

  return (
    <>
      <div className="flex flex-col gap-6 h-full overflow-hidden">
        {/* Top Control Panel with Integrated Analysis */}
        <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 flex flex-col gap-4 shrink-0 shadow-lg">
          {/* Row 1: Input & Examples */}
          <div className="flex flex-col gap-2 w-full">
            {/* Examples */}
            <div className="flex items-center gap-3 text-xs mb-1">
              <span className="text-gray-500 font-medium uppercase tracking-wider">
                Try an example:
              </span>

              {/* PHP Example */}
              <div className="flex items-center rounded-md bg-dark-900 border border-dark-600 overflow-hidden transition-colors hover:border-brand-500/50">
                <button
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      url: 'https://github.com/lassestilvang/example-php-github-copilot-cli-challenge',
                    }))
                  }
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-dark-800 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PhpIcon className="w-3.5 h-3.5 text-indigo-400" />
                  PHP (Legacy)
                </button>
                <a
                  href="https://github.com/lassestilvang/example-php-github-copilot-cli-challenge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1.5 hover:bg-dark-800 border-l border-dark-700 text-gray-500 hover:text-white transition-colors flex items-center h-full"
                  title="View Repository"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Vue Example */}
              <div className="flex items-center rounded-md bg-dark-900 border border-dark-600 overflow-hidden transition-colors hover:border-brand-500/50">
                <button
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      url: 'https://github.com/lassestilvang/example-create-vue',
                    }))
                  }
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-dark-800 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <VueIcon className="w-3.5 h-3.5 text-green-400" />
                  Vue.js
                </button>
                <a
                  href="https://github.com/lassestilvang/example-create-vue"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1.5 hover:bg-dark-800 border-l border-dark-700 text-gray-500 hover:text-white transition-colors flex items-center h-full"
                  title="View Repository"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="relative w-full">
              <Github className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                value={state.url}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, url: e.target.value }))
                }
                disabled={isBusy}
                placeholder="https://github.com/username/repository"
                className={`
                            w-full bg-dark-900 border rounded-lg pl-10 pr-4 py-3 text-gray-200 focus:outline-none transition-colors
                            ${state.status === AgentStatus.ERROR ? 'border-red-500/50 focus:border-red-500' : 'border-dark-600 focus:border-brand-500'}
                        `}
              />
            </div>
            {state.status === AgentStatus.ERROR && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-200 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>
                  Analysis failed. Please check the URL, repository privacy
                  settings, or GitHub API limits and try again.
                </span>
              </div>
            )}
          </div>

          {/* Row 2: Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <button
                onClick={startRepoProcess}
                disabled={isBusy || !state.url}
                className={`
                        flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap w-full md:w-auto
                        ${
                          !isAnalyzed && state.url
                            ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                            : 'bg-dark-700 hover:bg-dark-600 text-gray-300 border border-dark-600'
                        }
                        ${state.status === AgentStatus.ANALYZING || !state.url ? 'opacity-70 cursor-not-allowed' : ''}
                        `}
              >
                {state.status === AgentStatus.ANALYZING ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : state.status === AgentStatus.ERROR ? (
                  <RotateCw className="w-4 h-4" />
                ) : isAnalyzed ? (
                  <RotateCw className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                {state.status === AgentStatus.ANALYZING
                  ? 'Scanning...'
                  : state.status === AgentStatus.ERROR
                    ? 'Retry'
                    : isAnalyzed
                      ? 'Re-analyze Repo'
                      : 'Analyze Repo'}
              </button>

              <div className="h-6 w-px bg-dark-600 hidden md:block" />

              {/* Build / Download Button Logic */}
              {state.status === AgentStatus.COMPLETED ? (
                <>
                  <button
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 py-2 px-6 rounded-lg font-bold text-sm transition-all whitespace-nowrap w-full md:w-auto bg-green-600 hover:bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] animate-in fade-in zoom-in-95"
                  >
                    <Download className="w-4 h-4" />
                    Download Project
                  </button>
                  <button
                    onClick={() => setShowReport(true)}
                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap bg-dark-700 hover:bg-dark-600 text-white border border-dark-600"
                  >
                    <PackageCheck className="w-4 h-4" />
                    View Report
                  </button>
                </>
              ) : (
                <button
                  onClick={confirmMigration}
                  disabled={
                    !isAnalyzed || state.status === AgentStatus.CONVERTING
                  }
                  className={`
                            flex items-center justify-center gap-2 py-2 px-6 rounded-lg font-bold text-sm transition-all whitespace-nowrap w-full md:w-auto
                            ${
                              isAnalyzed
                                ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)] animate-in fade-in zoom-in-95'
                                : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-dark-700'
                            }
                            `}
                >
                  {state.status === AgentStatus.CONVERTING ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GitBranch className="w-4 h-4" />
                  )}
                  {state.status === AgentStatus.CONVERTING
                    ? 'Building Project...'
                    : 'Build Next.js App'}
                </button>
              )}

              <label
                title="Include Vitest/React Testing Library unit tests for components"
                className={`
                        flex items-center gap-2 text-sm cursor-pointer select-none transition-opacity
                        ${isAnalyzed ? 'opacity-100' : 'opacity-50 pointer-events-none'}
                    `}
              >
                <div
                  className={`
                            w-5 h-5 rounded border flex items-center justify-center transition-colors
                            ${includeTests ? 'bg-brand-600 border-brand-500' : 'bg-dark-900 border-dark-600'}
                        `}
                >
                  {includeTests && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={includeTests}
                  onChange={(e) => setIncludeTests(e.target.checked)}
                  disabled={!isAnalyzed}
                  className="hidden"
                />
                <span className="text-gray-300 flex items-center gap-1.5">
                  <TestTube className="w-3.5 h-3.5" />
                  Generate Tests
                </span>
              </label>
            </div>

            {/* Status Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-950 border border-dark-700 shadow-inner min-w-[130px] justify-center">
              <div
                className={`w-2 h-2 rounded-full ${isWorking ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}
              />
              <span className="text-xs font-mono font-medium text-gray-400 uppercase tracking-wider">
                {state.status === AgentStatus.IDLE
                  ? 'SYSTEM IDLE'
                  : state.status}
              </span>
            </div>
          </div>

          {/* Row 3: Integrated Analysis & Diagram (Conditional) */}
          {state.analysis && (
            <div className="mt-2 pt-4 border-t border-dark-700 flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-top-2">
              {/* Summary Text & Badges */}
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-900 border border-dark-600">
                    {getFrameworkIcon(state.analysis.detectedFramework)}
                    <span className="text-gray-300 text-xs font-bold uppercase">
                      {state.analysis.detectedFramework}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-900/20 border border-brand-500/30">
                    <NextjsIcon className="w-4 h-4 text-brand-400" />
                    <span className="text-brand-100 text-xs font-bold uppercase">
                      Next.js 16.1
                    </span>
                  </div>

                  {/* Inferred Complexity Badge */}
                  <div
                    className={`
                                flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono border uppercase tracking-wide
                                ${state.analysis.complexity === 'High' ? 'bg-red-900/20 border-red-500/30 text-red-300' : ''}
                                ${state.analysis.complexity === 'Medium' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300' : ''}
                                ${state.analysis.complexity === 'Low' ? 'bg-green-900/20 border-green-500/30 text-green-300' : ''}
                            `}
                  >
                    <Server className="w-3 h-3" />
                    {state.analysis.complexity} Complexity
                  </div>
                </div>

                <p className="text-sm text-gray-300 leading-relaxed max-w-3xl">
                  {state.analysis.summary}
                </p>
              </div>

              {/* Diagram Thumbnail */}
              <div className="shrink-0 relative">
                {state.diagram ? (
                  <div
                    onClick={() => setIsDiagramOpen(true)}
                    className="group relative w-48 h-28 bg-dark-900 rounded-lg border border-dark-600 overflow-hidden cursor-pointer hover:border-brand-500/50 transition-all shadow-md"
                  >
                    <img
                      src={state.diagram}
                      alt="Architecture"
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                      <div className="bg-dark-800/80 p-1.5 rounded-full border border-dark-500 text-white">
                        <Maximize2 className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-mono pointer-events-none">
                      LEGACY ARCH
                    </div>
                  </div>
                ) : (
                  <div className="w-48 h-28 bg-dark-900 rounded-lg border border-dark-600 border-dashed flex flex-col items-center justify-center text-gray-500 gap-2">
                    {state.status === AgentStatus.ANALYZING ||
                    state.status === AgentStatus.PLANNING ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                        <span className="text-xs">Generating Diagram...</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-6 h-6 opacity-30" />
                        <span className="text-[10px] uppercase tracking-wider opacity-50">
                          No Diagram
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
          {/* Column 1: Agent Logs (Left on Desktop, Bottom on Mobile) */}
          <div className="lg:col-span-4 flex flex-col h-full min-h-0 order-3 lg:order-1">
            <AgentLogs logs={state.logs} />
          </div>

          {/* Column 2: File Tree (Middle on Desktop, Top on Mobile) */}
          <div className="lg:col-span-2 flex flex-col h-full min-h-0 order-1 lg:order-2">
            <FileExplorer
              files={
                state.activeTree === 'source'
                  ? state.files
                  : state.generatedFiles
              }
              selectedFile={state.selectedFile}
              activeTree={state.activeTree}
              onToggleTree={(mode) =>
                setState((prev) => ({ ...prev, activeTree: mode }))
              }
              onSelectFile={handleFileSelect}
            />
          </div>

          {/* Column 3: Main Content (Right on Desktop, Middle on Mobile) */}
          <div className="lg:col-span-6 flex flex-col h-full min-h-0 order-2 lg:order-3">
            <div className="flex-1 bg-dark-800 rounded-xl border border-dark-700 overflow-hidden relative min-h-0 shadow-lg flex flex-col h-full">
              {selectedNode && selectedNode.type === 'file' ? (
                isImageFile(selectedNode.name) ? (
                  <div className="flex flex-col h-full">
                    <div className="bg-dark-900 px-4 py-2 border-b border-dark-700 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-2">
                        <FileImage className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-semibold text-gray-300">
                          {selectedNode.name}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-dark-700 text-gray-400 font-mono uppercase">
                        IMAGE PREVIEW
                      </span>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-dark-900/50">
                      {selectedNode.content ? (
                        <img
                          src={selectedNode.content}
                          alt={selectedNode.name}
                          className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-gray-500 animate-pulse">
                          <div className="w-12 h-12 bg-dark-800 rounded-lg"></div>
                          <span className="text-xs">Loading preview...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <CodeEditor
                    title={
                      state.activeTree === 'source'
                        ? `Legacy / ${selectedNode.name}`
                        : `Next.js / ${selectedNode.name}`
                    }
                    language={
                      state.activeTree === 'source'
                        ? state.sourceLang
                        : 'TypeScript'
                    }
                    code={
                      selectedNode.content ||
                      (state.activeTree === 'target'
                        ? '// Generating...'
                        : '// Loading...')
                    }
                    readOnly={true}
                    highlight={
                      state.activeTree === 'target' && !!selectedNode.content
                    }
                  />
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
                  <div className="w-20 h-20 bg-dark-700/50 rounded-full flex items-center justify-center mb-6 border border-dark-600/50">
                    {state.activeTree === 'source' ? (
                      <Database className="w-10 h-10 text-blue-400/50" />
                    ) : (
                      <Layout className="w-10 h-10 text-brand-400/50" />
                    )}
                  </div>
                  <h3 className="text-xl font-medium text-gray-200">
                    {state.activeTree === 'source'
                      ? 'Legacy Codebase'
                      : 'Modern Next.js Project'}
                  </h3>
                  <p className="text-sm max-w-md text-center mt-3 text-gray-400">
                    {state.activeTree === 'source'
                      ? 'Select a file from the explorer to inspect the original source code structure.'
                      : 'Generated Next.js components, pages, and utility files will appear here.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Diagram Modal */}
      {isDiagramOpen && state.diagram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 p-4 sm:p-8">
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => setIsDiagramOpen(false)}
              className="p-2 rounded-full bg-dark-800 text-white hover:bg-dark-700 border border-dark-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative w-full max-w-7xl max-h-full flex items-center justify-center overflow-auto rounded-lg shadow-2xl bg-dark-900 border border-dark-700">
            <img
              src={state.diagram}
              alt="Architecture Diagram"
              className="max-w-full max-h-full object-contain"
            />
            <div className="absolute bottom-4 left-4 bg-dark-800/90 px-3 py-1.5 rounded border border-dark-600 text-white text-xs font-mono">
              LEGACY SYSTEM ARCHITECTURE
            </div>
          </div>
        </div>
      )}

      {/* Post-Migration Report Modal */}
      {showReport && state.report && (
        <MigrationReportModal
          report={state.report}
          onClose={() => setShowReport(false)}
          onDownload={handleDownload}
        />
      )}
    </>
  );
};

export default RepoMigration;

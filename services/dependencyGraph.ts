import { FileNode } from '../types';

export interface DependencyGraph {
  [filePath: string]: string[]; // filePath -> list of imported file paths
}

export const analyzeImports = (content: string, filePath: string): string[] => {
  const imports: string[] = [];
  // Regex to match:
  // 1. import ... from '...'
  // 2. import '...' (side-effect)
  // 3. require('...')
  const importRegex =
    /(?:import\s+(?:[\w*\s{},]*)\s+from\s+['"]([^'"]+)['"])|(?:import\s+['"]([^'"]+)['"])|(?:require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2] || match[3];
    if (
      importPath &&
      (importPath.startsWith('./') || importPath.startsWith('../'))
    ) {
      // Resolve relative path to absolute (repo-root relative) path
      const resolved = resolvePath(filePath, importPath);
      imports.push(resolved);
    }
  }
  return imports;
};

const resolvePath = (currentPath: string, importPath: string): string => {
  const currentDir = currentPath.split('/').slice(0, -1);
  const importParts = importPath.split('/');

  for (const part of importParts) {
    if (part === '.') continue;
    if (part === '..') {
      currentDir.pop();
    } else {
      currentDir.push(part);
    }
  }
  return currentDir.join('/');
};

export const buildDependencyGraph = (files: FileNode[]): DependencyGraph => {
  const graph: DependencyGraph = {};

  const processNode = (node: FileNode) => {
    if (node.type === 'file' && node.content) {
      // Basic normalization to ensure extensions don't mess up matching too much
      // Ideally we would check for .js, .ts, etc. but simple exact matching for now
      graph[node.path] = analyzeImports(node.content, node.path);
    }
    if (node.children) {
      node.children.forEach(processNode);
    }
  };

  files.forEach(processNode);
  return graph;
};

export const getRelatedFiles = (
  targetPath: string,
  graph: DependencyGraph,
  limit: number = 5,
): string[] => {
  const related: Set<string> = new Set();
  const queue: string[] = [targetPath];

  // Simple BFS to find dependencies
  while (queue.length > 0 && related.size < limit) {
    const current = queue.shift()!;
    const deps = graph[current] || [];

    for (const dep of deps) {
      // We try to match the import path to a key in the graph
      // Since imports might omit extensions (e.g. ./utils instead of ./utils.ts), we try to find a match
      const match = Object.keys(graph).find(
        (k) => k === dep || k.startsWith(dep + '.'),
      );

      if (match && !related.has(match) && match !== targetPath) {
        if (related.size >= limit) break;
        related.add(match);
        queue.push(match);
      }
    }
    if (related.size >= limit) break;
  }

  return Array.from(related);
};

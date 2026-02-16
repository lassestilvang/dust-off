import { describe, expect, it } from 'vitest';
import { generateReport } from './migrationOrchestrator';
import { FileNode, RepoAnalysisResult } from '../types';

const sourceFiles: FileNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'dir',
    status: 'done',
    children: [
      {
        name: 'index.js',
        path: 'src/index.js',
        type: 'file',
        status: 'done',
        content: 'console.log("legacy");',
      },
    ],
  },
];

const targetFiles: FileNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'dir',
    status: 'done',
    children: [
      {
        name: 'page.tsx',
        path: 'src/page.tsx',
        type: 'file',
        status: 'done',
        content: 'export default function Page() { return <main />; }',
      },
    ],
  },
];

const analysis: RepoAnalysisResult = {
  summary: 'Legacy SPA app',
  complexity: 'Medium',
  dependencies: ['react'],
  patterns: ['component-based'],
  risks: [],
  detectedFramework: 'React',
  recommendedTarget: 'Next.js',
  architectureDescription: 'Single-page app',
  semanticFileMappings: [],
  migrationNotes: [],
};

describe('generateReport duration formatting', () => {
  it('reports at least one second for sub-second migrations', () => {
    const report = generateReport(
      sourceFiles,
      targetFiles,
      1000,
      1200,
      analysis,
    );
    expect(report.duration).toBe('1s');
  });

  it('rounds partial seconds up instead of down', () => {
    const report = generateReport(
      sourceFiles,
      targetFiles,
      1000,
      2500,
      analysis,
    );
    expect(report.duration).toBe('2s');
  });

  it('formats minute-range durations as minutes and seconds', () => {
    const report = generateReport(
      sourceFiles,
      targetFiles,
      1000,
      62000,
      analysis,
    );
    expect(report.duration).toBe('1m 1s');
  });
});

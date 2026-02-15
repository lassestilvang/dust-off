
export enum AgentStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  PLANNING = 'PLANNING',
  CONVERTING = 'CONVERTING',
  VERIFYING = 'VERIFYING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface AnalysisResult {
  summary: string;
  complexity: 'Low' | 'Medium' | 'High';
  dependencies: string[];
  patterns: string[];
  risks: string[];
}

export interface RepoAnalysisResult extends AnalysisResult {
  detectedFramework: string;
  recommendedTarget: string;
  architectureDescription: string;
}

export interface VerificationResult {
  passed: boolean;
  issues: string[];
  fixedCode?: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  step: AgentStatus;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface MigrationState {
  sourceLang: string;
  targetLang: string;
  sourceCode: string;
  targetCode: string;
  status: AgentStatus;
  logs: LogEntry[];
  analysis: AnalysisResult | null;
  verification: VerificationResult | null;
}

export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'dir';
  content?: string; // Content
  status: 'pending' | 'migrating' | 'done' | 'error';
  children?: FileNode[];
}

export interface MigrationReport {
  duration: string;
  totalFiles: number;
  filesGenerated: number;
  modernizationScore: number; // 0-100
  typeScriptCoverage: number; // percentage
  testCoverage: number; // estimated percentage
  testsGenerated: number;
  techStackChanges: { from: string; to: string }[];
  keyImprovements: string[];
  newDependencies: number;
}

export interface RepoState {
  url: string;
  branch: string;
  status: AgentStatus;
  files: FileNode[]; // Source files
  generatedFiles: FileNode[]; // Target (New) files
  selectedFile: string | null; // Path of currently viewed file
  activeTree: 'source' | 'target'; // Which tree is visible
  logs: LogEntry[];
  analysis: RepoAnalysisResult | null;
  diagram: string | null; // Base64 image
  sourceLang: string;
  targetLang: string;
  sourceContext: string; // Aggregated content of source files for context
  startTime?: number; // For duration calculation
  report: MigrationReport | null;
}

export const LANGUAGES = [
  { id: 'python2', label: 'Python 2' },
  { id: 'python3', label: 'Python 3' },
  { id: 'javascript', label: 'JavaScript (ES5)' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'react', label: 'React (Functional)' },
  { id: 'vue2', label: 'Vue 2' },
  { id: 'vue3', label: 'Vue 3' },
  { id: 'angular', label: 'Angular' },
  { id: 'jquery', label: 'jQuery' },
  { id: 'php', label: 'PHP' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'java', label: 'Java' },
  { id: 'astro', label: 'Astro' },
  { id: 'nextjs', label: 'Next.js' },
];

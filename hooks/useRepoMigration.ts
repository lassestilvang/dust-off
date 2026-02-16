import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  AgentStatus,
  FileNode,
  GenerationProgress,
  GitHubRateLimitInfo,
  LogEntry,
  MigrationConfig,
  MigrationCostEstimate,
  MigrationHistoryEntry,
  MigrationPlaybook,
  MigrationReport,
  RepoAnalysisResult,
  RepoScopeInfo,
  RepoState,
} from '../types';
import {
  fetchFileContent,
  normalizeGitHubRepoUrl,
} from '../services/githubService';
import {
  flattenFiles,
  generateReport,
  isImageFile,
  runAnalyzePhase,
  runGeneratePhase,
  runPlanReviewPhase,
  runRegenerateFilePhase,
  runScaffoldPhase,
  runVerificationPhase,
} from '../services/migrationOrchestrator';
import { useMigrationLogs } from './useMigrationLogs';
import { isAbortError } from '../services/abortUtils';
import { validateGeminiApiKey } from '../services/geminiService';
import type { DependencyGraph } from '../services/dependencyGraph';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const initialRepoState: RepoState = {
  url: '',
  branch: 'main',
  status: AgentStatus.IDLE,
  includeDirectories: [],
  excludeDirectories: [],
  files: [],
  generatedFiles: [],
  selectedFile: null,
  activeTree: 'source',
  logs: [],
  analysis: null,
  diagram: null,
  sourceLang: 'JavaScript',
  targetLang: 'Next.js + TypeScript',
  sourceContext: '',
  report: null,
  config: {
    uiFramework: 'tailwind',
    stateManagement: 'context',
    testingLibrary: 'vitest',
  },
  githubRateLimit: null,
  repoScope: null,
  generationProgress: null,
  playbook: null,
  playbookNotes: '',
  clarificationAnswers: {},
  costEstimate: null,
  history: [],
  awaitingPlanApproval: false,
};

const REPO_STATE_STORAGE_KEY = 'dustoff.repo-state.v1';
const MAX_PERSISTED_LOGS = 250;
const MAX_HISTORY_ENTRIES = 20;

const normalizeDirectories = (directories: string[]): string[] => {
  return Array.from(
    new Set(
      directories
        .map((directory) => directory.trim().replace(/^\/+|\/+$/g, ''))
        .filter(Boolean),
    ),
  ).sort();
};

interface PersistedLogEntry extends Omit<LogEntry, 'timestamp'> {
  timestamp: string;
}

interface PersistedRepoState {
  url: string;
  branch: string;
  status: AgentStatus;
  includeDirectories: string[];
  excludeDirectories: string[];
  files: FileNode[];
  generatedFiles: FileNode[];
  selectedFile: string | null;
  activeTree: 'source' | 'target';
  logs: PersistedLogEntry[];
  analysis: RepoAnalysisResult | null;
  diagram: string | null;
  sourceLang: string;
  targetLang: string;
  report: MigrationReport | null;
  config: MigrationConfig;
  githubRateLimit: GitHubRateLimitInfo | null;
  repoScope: RepoScopeInfo | null;
  generationProgress: GenerationProgress | null;
  playbook: MigrationPlaybook | null;
  playbookNotes: string;
  clarificationAnswers: Record<string, string>;
  costEstimate: MigrationCostEstimate | null;
  history: MigrationHistoryEntry[];
  awaitingPlanApproval: boolean;
}

interface GenerationContextCache {
  sourceContext: string;
  fileContents: Record<string, string>;
  filesToRead: FileNode[];
  graph: DependencyGraph;
}

const stripFileContents = (nodes: FileNode[]): FileNode[] => {
  return nodes.map((node) => {
    if (node.type === 'file') {
      return {
        ...node,
        content: undefined,
      };
    }

    return {
      ...node,
      children: node.children ? stripFileContents(node.children) : undefined,
    };
  });
};

const isBusyStatus = (status: AgentStatus): boolean => {
  return (
    status === AgentStatus.ANALYZING ||
    status === AgentStatus.CONVERTING ||
    status === AgentStatus.VERIFYING
  );
};

const serializeRepoState = (state: RepoState): PersistedRepoState => {
  return {
    url: state.url,
    branch: state.branch,
    status: isBusyStatus(state.status) ? AgentStatus.IDLE : state.status,
    includeDirectories: state.includeDirectories,
    excludeDirectories: state.excludeDirectories,
    files: stripFileContents(state.files),
    generatedFiles: state.generatedFiles,
    selectedFile: state.selectedFile,
    activeTree: state.activeTree,
    logs: state.logs.slice(-MAX_PERSISTED_LOGS).map((entry) => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    })),
    analysis: state.analysis,
    diagram: state.diagram,
    sourceLang: state.sourceLang,
    targetLang: state.targetLang,
    report: state.report,
    config: state.config,
    githubRateLimit: state.githubRateLimit,
    repoScope: state.repoScope,
    generationProgress: state.generationProgress,
    playbook: state.playbook,
    playbookNotes: state.playbookNotes,
    clarificationAnswers: state.clarificationAnswers,
    costEstimate: state.costEstimate,
    history: state.history,
    awaitingPlanApproval: state.awaitingPlanApproval,
  };
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, string>
  >((result, [key, entryValue]) => {
    if (typeof entryValue === 'string') {
      result[key] = entryValue;
    }
    return result;
  }, {});
};

const parsePersistedState = (
  payload: PersistedRepoState,
  fallback: RepoState,
): RepoState => {
  const history = Array.isArray(payload.history)
    ? payload.history
        .filter(
          (entry): entry is MigrationHistoryEntry =>
            Boolean(entry) &&
            typeof entry.id === 'string' &&
            typeof entry.timestamp === 'number' &&
            typeof entry.repoUrl === 'string' &&
            (entry.complexity === 'Low' ||
              entry.complexity === 'Medium' ||
              entry.complexity === 'High'),
        )
        .slice(-20)
    : fallback.history;

  return {
    ...fallback,
    url: typeof payload.url === 'string' ? payload.url : fallback.url,
    branch:
      typeof payload.branch === 'string' ? payload.branch : fallback.branch,
    status: Object.values(AgentStatus).includes(payload.status)
      ? payload.status
      : AgentStatus.IDLE,
    includeDirectories: normalizeDirectories(
      toStringArray(payload.includeDirectories),
    ),
    excludeDirectories: normalizeDirectories(
      toStringArray(payload.excludeDirectories),
    ),
    files: Array.isArray(payload.files) ? payload.files : fallback.files,
    generatedFiles: Array.isArray(payload.generatedFiles)
      ? payload.generatedFiles
      : fallback.generatedFiles,
    selectedFile:
      typeof payload.selectedFile === 'string' || payload.selectedFile === null
        ? payload.selectedFile
        : fallback.selectedFile,
    activeTree:
      payload.activeTree === 'source' || payload.activeTree === 'target'
        ? payload.activeTree
        : fallback.activeTree,
    logs: Array.isArray(payload.logs)
      ? payload.logs
          .map((entry) => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          }))
          .filter((entry) => !Number.isNaN(entry.timestamp.getTime()))
      : fallback.logs,
    analysis: payload.analysis || null,
    diagram: typeof payload.diagram === 'string' ? payload.diagram : null,
    sourceLang:
      typeof payload.sourceLang === 'string'
        ? payload.sourceLang
        : fallback.sourceLang,
    targetLang:
      typeof payload.targetLang === 'string'
        ? payload.targetLang
        : fallback.targetLang,
    sourceContext: '',
    report: payload.report || null,
    config: payload.config || fallback.config,
    githubRateLimit: payload.githubRateLimit || null,
    repoScope: payload.repoScope || null,
    generationProgress: payload.generationProgress || null,
    playbook: payload.playbook || null,
    playbookNotes:
      typeof payload.playbookNotes === 'string' ? payload.playbookNotes : '',
    clarificationAnswers: toStringRecord(payload.clarificationAnswers),
    costEstimate: payload.costEstimate || null,
    history,
    awaitingPlanApproval: Boolean(payload.awaitingPlanApproval),
    startTime: undefined,
  };
};

const initializeRepoState = (fallback: RepoState): RepoState => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(REPO_STATE_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as PersistedRepoState;
    return parsePersistedState(parsed, fallback);
  } catch (error) {
    console.warn('Failed to restore repository session state.', error);
    return fallback;
  }
};

const buildPlaybookDecisionContext = (
  playbook: MigrationPlaybook | null,
  answers: Record<string, string>,
  notes: string,
): string => {
  if (!playbook) {
    return '';
  }

  const questionBlock = playbook.questions
    .map((question, index) => {
      const selected =
        answers[question.id]?.trim() ||
        question.recommendedOption ||
        question.options[0] ||
        '';
      return `${index + 1}. ${question.question}\nSelected: ${selected}`;
    })
    .join('\n\n');

  const instructions = notes.trim();

  return [
    '--- APPROVED MIGRATION PLAYBOOK ---',
    `Objective: ${playbook.objective}`,
    `Overview: ${playbook.overview}`,
    'Execution Plan:',
    ...playbook.executionPlan.map((step, index) => `${index + 1}. ${step}`),
    questionBlock ? `Clarification Decisions:\n${questionBlock}` : '',
    instructions ? `User Guidance:\n${instructions}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const createHistoryEntry = ({
  state,
  report,
  endTime,
}: {
  state: RepoState;
  report: MigrationReport;
  endTime: number;
}): MigrationHistoryEntry => {
  const durationMs = Math.max(1, endTime - (state.startTime || endTime));
  const durationSeconds = Math.max(1, Math.round(durationMs / 1000));

  return {
    id: `run_${endTime}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: endTime,
    repoUrl: state.url,
    sourceFramework: state.analysis?.detectedFramework || 'Unknown',
    complexity: state.analysis?.complexity || 'Medium',
    sourceFiles: report.totalFiles,
    generatedFiles: report.filesGenerated,
    durationSeconds,
    modernizationScore: report.modernizationScore,
    estimatedCostUsd: state.costEstimate?.estimatedCostUsd || 0,
    estimatedTokens: state.costEstimate?.totalTokens || 0,
    config: state.config,
  };
};

type RepoAction =
  | { type: 'set_url'; payload: string }
  | { type: 'set_status'; payload: AgentStatus }
  | { type: 'reset_for_analysis' }
  | { type: 'set_include_directories'; payload: string[] }
  | { type: 'set_exclude_directories'; payload: string[] }
  | { type: 'set_files'; payload: FileNode[] }
  | { type: 'set_analysis'; payload: RepoAnalysisResult }
  | { type: 'set_repo_scope'; payload: RepoScopeInfo | null }
  | { type: 'set_github_rate_limit'; payload: GitHubRateLimitInfo | null }
  | { type: 'set_generation_progress'; payload: GenerationProgress | null }
  | { type: 'set_diagram'; payload: string | null }
  | { type: 'set_source_context'; payload: string }
  | { type: 'set_playbook'; payload: MigrationPlaybook | null }
  | { type: 'set_playbook_notes'; payload: string }
  | {
      type: 'set_clarification_answer';
      payload: { questionId: string; answer: string };
    }
  | { type: 'set_clarification_answers'; payload: Record<string, string> }
  | { type: 'set_cost_estimate'; payload: MigrationCostEstimate | null }
  | { type: 'set_history'; payload: MigrationHistoryEntry[] }
  | { type: 'set_awaiting_plan_approval'; payload: boolean }
  | { type: 'set_generated_files'; payload: FileNode[] }
  | { type: 'set_selected_file'; payload: string | null }
  | { type: 'set_active_tree'; payload: 'source' | 'target' }
  | { type: 'set_report'; payload: MigrationReport | null }
  | { type: 'set_config'; payload: MigrationConfig }
  | { type: 'add_log'; payload: LogEntry }
  | {
      type: 'update_file_status';
      payload: {
        path: string;
        status: FileNode['status'];
        tree: 'source' | 'target';
      };
    }
  | {
      type: 'update_file_content';
      payload: {
        path: string;
        content: string;
        tree: 'source' | 'target';
      };
    };

const updateTreeNode = (
  nodes: FileNode[],
  path: string,
  updater: (node: FileNode) => FileNode,
): FileNode[] => {
  return nodes.map((node) => {
    if (node.path === path) {
      return updater(node);
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeNode(node.children, path, updater),
      };
    }
    return node;
  });
};

const repoReducer = (state: RepoState, action: RepoAction): RepoState => {
  switch (action.type) {
    case 'set_url':
      return { ...state, url: action.payload };

    case 'set_status':
      return { ...state, status: action.payload };

    case 'reset_for_analysis':
      return {
        ...state,
        status: AgentStatus.ANALYZING,
        logs: [],
        files: [],
        generatedFiles: [],
        selectedFile: null,
        activeTree: 'source',
        analysis: null,
        diagram: null,
        sourceContext: '',
        report: null,
        githubRateLimit: null,
        repoScope: null,
        generationProgress: null,
        playbook: null,
        playbookNotes: '',
        clarificationAnswers: {},
        costEstimate: null,
        awaitingPlanApproval: false,
        startTime: Date.now(),
      };

    case 'set_include_directories': {
      const includeDirectories = normalizeDirectories(action.payload);
      return {
        ...state,
        includeDirectories,
        excludeDirectories: state.excludeDirectories.filter(
          (directory) => !includeDirectories.includes(directory),
        ),
      };
    }

    case 'set_exclude_directories': {
      const excludeDirectories = normalizeDirectories(action.payload);
      return {
        ...state,
        excludeDirectories,
        includeDirectories: state.includeDirectories.filter(
          (directory) => !excludeDirectories.includes(directory),
        ),
      };
    }

    case 'set_files':
      return { ...state, files: action.payload };

    case 'set_analysis':
      return {
        ...state,
        analysis: action.payload,
        sourceLang: action.payload.detectedFramework,
        targetLang: 'Next.js + TypeScript',
        status: AgentStatus.PLANNING,
      };

    case 'set_repo_scope':
      return { ...state, repoScope: action.payload };

    case 'set_github_rate_limit':
      return { ...state, githubRateLimit: action.payload };

    case 'set_generation_progress':
      return { ...state, generationProgress: action.payload };

    case 'set_diagram':
      return { ...state, diagram: action.payload };

    case 'set_source_context':
      return { ...state, sourceContext: action.payload };

    case 'set_playbook':
      return {
        ...state,
        playbook: action.payload,
      };

    case 'set_playbook_notes':
      return {
        ...state,
        playbookNotes: action.payload,
      };

    case 'set_clarification_answer':
      return {
        ...state,
        clarificationAnswers: {
          ...state.clarificationAnswers,
          [action.payload.questionId]: action.payload.answer,
        },
      };

    case 'set_clarification_answers':
      return {
        ...state,
        clarificationAnswers: action.payload,
      };

    case 'set_cost_estimate':
      return { ...state, costEstimate: action.payload };

    case 'set_history':
      return { ...state, history: action.payload };

    case 'set_awaiting_plan_approval':
      return { ...state, awaitingPlanApproval: action.payload };

    case 'set_generated_files':
      return {
        ...state,
        generatedFiles: action.payload,
        activeTree: 'target',
      };

    case 'set_selected_file':
      return { ...state, selectedFile: action.payload };

    case 'set_active_tree':
      return { ...state, activeTree: action.payload };

    case 'set_report':
      return { ...state, report: action.payload };

    case 'set_config':
      return {
        ...state,
        status: AgentStatus.IDLE,
        config: action.payload,
        playbook: null,
        playbookNotes: '',
        clarificationAnswers: {},
        costEstimate: null,
        awaitingPlanApproval: false,
      };

    case 'add_log':
      return { ...state, logs: [...state.logs, action.payload] };

    case 'update_file_status': {
      const { path, status, tree } = action.payload;
      const targetTree = tree === 'source' ? state.files : state.generatedFiles;
      const updatedTree = updateTreeNode(targetTree, path, (node) => ({
        ...node,
        status,
      }));

      if (tree === 'source') {
        return { ...state, files: updatedTree };
      }

      return { ...state, generatedFiles: updatedTree };
    }

    case 'update_file_content': {
      const { path, content, tree } = action.payload;
      const targetTree = tree === 'source' ? state.files : state.generatedFiles;
      const updatedTree = updateTreeNode(targetTree, path, (node) => ({
        ...node,
        content,
      }));

      if (tree === 'source') {
        return { ...state, files: updatedTree };
      }

      return { ...state, generatedFiles: updatedTree };
    }

    default:
      return state;
  }
};

interface UseRepoMigrationResult {
  state: RepoState;
  isDiagramOpen: boolean;
  setIsDiagramOpen: (open: boolean) => void;
  showReport: boolean;
  setShowReport: (open: boolean) => void;
  showConfigModal: boolean;
  setShowConfigModal: (open: boolean) => void;
  isAnalyzed: boolean;
  isWorking: boolean;
  isBusy: boolean;
  isPreparingPlan: boolean;
  isAwaitingPlanApproval: boolean;
  regeneratingFilePath: string | null;
  selectedNode: FileNode | null;
  setUrl: (url: string) => void;
  setConfig: (config: MigrationConfig) => void;
  setIncludeDirectories: (directories: string[]) => void;
  setExcludeDirectories: (directories: string[]) => void;
  setActiveTree: (tree: 'source' | 'target') => void;
  startRepoProcess: () => Promise<void>;
  cancelCurrentRun: () => void;
  handleConfigConfirm: () => void;
  approveMigrationPlan: () => Promise<void>;
  setPlaybookNotes: (notes: string) => void;
  setClarificationAnswer: (questionId: string, answer: string) => void;
  clearHistory: () => void;
  handleDownload: () => Promise<void>;
  handleFileSelect: (path: string) => Promise<void>;
  handleGeneratedFileEdit: (path: string, content: string) => void;
  regenerateTargetFile: (path: string, instructions?: string) => Promise<void>;
}

export const useRepoMigration = (): UseRepoMigrationResult => {
  const [state, dispatch] = useReducer(
    repoReducer,
    initialRepoState,
    initializeRepoState,
  );
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [regeneratingFilePath, setRegeneratingFilePath] = useState<
    string | null
  >(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const generationContextRef = useRef<GenerationContextCache | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const serialized = serializeRepoState(state);
      window.localStorage.setItem(
        REPO_STATE_STORAGE_KEY,
        JSON.stringify(serialized),
      );
    } catch (error) {
      console.warn('Failed to persist repository session state.', error);
    }
  }, [state]);

  useEffect(() => {
    return () => {
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, []);

  const appendLog = useCallback((entry: LogEntry) => {
    dispatch({ type: 'add_log', payload: entry });
  }, []);

  const getCurrentStep = useCallback(() => {
    return stateRef.current.status;
  }, []);

  const { addLog } = useMigrationLogs({ appendLog, getCurrentStep });

  const setUrl = useCallback((url: string) => {
    dispatch({ type: 'set_url', payload: url });
  }, []);

  const setConfig = useCallback((config: MigrationConfig) => {
    dispatch({ type: 'set_config', payload: config });
  }, []);

  const setIncludeDirectories = useCallback((directories: string[]) => {
    dispatch({ type: 'set_include_directories', payload: directories });
  }, []);

  const setExcludeDirectories = useCallback((directories: string[]) => {
    dispatch({ type: 'set_exclude_directories', payload: directories });
  }, []);

  const setActiveTree = useCallback((tree: 'source' | 'target') => {
    dispatch({ type: 'set_active_tree', payload: tree });
  }, []);

  const handleGitHubRateLimitUpdate = useCallback(
    (info: GitHubRateLimitInfo) => {
      dispatch({ type: 'set_github_rate_limit', payload: info });
    },
    [],
  );

  const cancelCurrentRun = useCallback(() => {
    if (!activeControllerRef.current) {
      return;
    }

    const currentStatus = stateRef.current.status;
    cancelRequestedRef.current = true;
    activeControllerRef.current.abort();
    activeControllerRef.current = null;
    dispatch({ type: 'set_generation_progress', payload: null });
    dispatch({ type: 'set_status', payload: AgentStatus.IDLE });
    addLog('Operation cancelled by user.', 'warning', currentStatus);
  }, [addLog]);

  const ensureDiagramApiKey = useCallback(async (): Promise<boolean> => {
    let hasKey = false;
    const apiStudio = window.aistudio;

    if (apiStudio) {
      try {
        hasKey = await apiStudio.hasSelectedApiKey();
        if (!hasKey) {
          addLog(
            'Requesting API Key for visual generation...',
            'warning',
            AgentStatus.PLANNING,
          );
          await apiStudio.openSelectKey();
          hasKey = await apiStudio.hasSelectedApiKey();
        }
      } catch (error: unknown) {
        console.error('Auth flow error', error);
      }
    }

    return (
      hasKey ||
      Boolean((process.env as Record<string, string | undefined>).API_KEY)
    );
  }, [addLog]);

  const startRepoProcess = useCallback(async () => {
    const { url, includeDirectories, excludeDirectories } = stateRef.current;
    const normalizedUrl = normalizeGitHubRepoUrl(url);

    if (activeControllerRef.current) {
      addLog(
        'Another operation is already running. Wait for it to finish before starting a new run.',
        'warning',
      );
      return;
    }

    if (!normalizedUrl) {
      addLog(
        'Please enter a valid GitHub repository URL (https://github.com/owner/repo).',
        'error',
      );
      return;
    }

    if (normalizedUrl !== url) {
      dispatch({ type: 'set_url', payload: normalizedUrl });
    }

    generationContextRef.current = null;
    setRegeneratingFilePath(null);
    dispatch({ type: 'reset_for_analysis' });
    cancelRequestedRef.current = false;
    const controller = new AbortController();
    activeControllerRef.current = controller;

    try {
      addLog(
        'Validating Gemini API key before analysis...',
        'info',
        AgentStatus.ANALYZING,
      );
      await validateGeminiApiKey({ abortSignal: controller.signal });
      addLog(
        'Gemini API key validation succeeded.',
        'success',
        AgentStatus.ANALYZING,
      );

      const result = await runAnalyzePhase({
        url: normalizedUrl,
        includeDirectories,
        excludeDirectories,
        addLog,
        ensureDiagramApiKey,
        onGitHubRateLimitUpdate: handleGitHubRateLimitUpdate,
        abortSignal: controller.signal,
      });

      dispatch({ type: 'set_files', payload: result.files });
      dispatch({ type: 'set_analysis', payload: result.analysis });
      dispatch({ type: 'set_repo_scope', payload: result.repoScope });

      if (result.diagram) {
        dispatch({ type: 'set_diagram', payload: result.diagram });
      }

      dispatch({ type: 'set_status', payload: AgentStatus.IDLE });
    } catch (error: unknown) {
      if (isAbortError(error)) {
        if (!cancelRequestedRef.current) {
          addLog('Operation cancelled.', 'warning', AgentStatus.IDLE);
        }
        dispatch({ type: 'set_status', payload: AgentStatus.IDLE });
        return;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog(`Fatal Error: ${errorMessage}`, 'error', AgentStatus.ERROR);
      dispatch({ type: 'set_status', payload: AgentStatus.ERROR });
    } finally {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
      cancelRequestedRef.current = false;
    }
  }, [addLog, ensureDiagramApiKey, handleGitHubRateLimitUpdate]);

  const prepareMigrationPlan = useCallback(async () => {
    const currentState = stateRef.current;

    if (activeControllerRef.current) {
      addLog(
        'Another operation is already running. Wait for it to finish before starting a new run.',
        'warning',
      );
      return;
    }

    if (!currentState.analysis || !currentState.config) {
      return;
    }

    generationContextRef.current = null;
    setRegeneratingFilePath(null);
    dispatch({ type: 'set_generation_progress', payload: null });
    dispatch({ type: 'set_playbook', payload: null });
    dispatch({ type: 'set_playbook_notes', payload: '' });
    dispatch({ type: 'set_clarification_answers', payload: {} });
    dispatch({ type: 'set_cost_estimate', payload: null });
    dispatch({ type: 'set_awaiting_plan_approval', payload: false });
    dispatch({ type: 'set_status', payload: AgentStatus.PLANNING });
    cancelRequestedRef.current = false;

    const controller = new AbortController();
    activeControllerRef.current = controller;

    try {
      const scaffoldResult = await runScaffoldPhase({
        url: currentState.url,
        sourceFiles: currentState.files,
        analysis: currentState.analysis,
        config: currentState.config,
        addLog,
        onGitHubRateLimitUpdate: handleGitHubRateLimitUpdate,
        abortSignal: controller.signal,
      });

      generationContextRef.current = {
        sourceContext: scaffoldResult.sourceContext,
        fileContents: scaffoldResult.fileContents,
        filesToRead: scaffoldResult.filesToRead,
        graph: scaffoldResult.graph,
      };

      dispatch({
        type: 'set_source_context',
        payload: scaffoldResult.sourceContext,
      });

      dispatch({
        type: 'set_generated_files',
        payload: scaffoldResult.generatedFiles,
      });

      const planResult = await runPlanReviewPhase({
        analysis: currentState.analysis,
        generatedFilePaths: scaffoldResult.generatedFilePaths,
        sourceContext: scaffoldResult.sourceContext,
        config: currentState.config,
        addLog,
        abortSignal: controller.signal,
      });

      const initialAnswers = planResult.playbook.questions.reduce<
        Record<string, string>
      >((accumulator, question) => {
        accumulator[question.id] =
          question.recommendedOption || question.options[0] || '';
        return accumulator;
      }, {});

      dispatch({
        type: 'set_clarification_answers',
        payload: initialAnswers,
      });
      dispatch({ type: 'set_playbook', payload: planResult.playbook });
      dispatch({ type: 'set_cost_estimate', payload: planResult.costEstimate });
      dispatch({ type: 'set_awaiting_plan_approval', payload: true });
      dispatch({ type: 'set_status', payload: AgentStatus.IDLE });

      addLog(
        'Migration playbook prepared. Review the plan, adjust decisions, then approve generation.',
        'success',
        AgentStatus.PLANNING,
      );
    } catch (error: unknown) {
      if (isAbortError(error)) {
        if (!cancelRequestedRef.current) {
          addLog('Operation cancelled.', 'warning', AgentStatus.IDLE);
        }
        dispatch({ type: 'set_status', payload: AgentStatus.IDLE });
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog(`Fatal Error: ${errorMessage}`, 'error', AgentStatus.ERROR);
      dispatch({ type: 'set_status', payload: AgentStatus.ERROR });
    } finally {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
      cancelRequestedRef.current = false;
    }
  }, [addLog, handleGitHubRateLimitUpdate]);

  const approveMigrationPlan = useCallback(async () => {
    const currentState = stateRef.current;

    if (activeControllerRef.current) {
      addLog(
        'Another operation is already running. Wait for it to finish before starting a new run.',
        'warning',
      );
      return;
    }

    if (
      !currentState.analysis ||
      !currentState.playbook ||
      !currentState.awaitingPlanApproval
    ) {
      addLog(
        'Prepare and review the migration playbook before starting.',
        'warning',
      );
      return;
    }

    if (!generationContextRef.current) {
      addLog(
        'Planning context is unavailable. Run Configure & Build again to regenerate the playbook.',
        'warning',
      );
      return;
    }

    const decisionContext = buildPlaybookDecisionContext(
      currentState.playbook,
      currentState.clarificationAnswers,
      currentState.playbookNotes,
    );
    const enrichedSourceContext = decisionContext
      ? `${generationContextRef.current.sourceContext}\n\n${decisionContext}`
      : generationContextRef.current.sourceContext;

    generationContextRef.current = {
      ...generationContextRef.current,
      sourceContext: enrichedSourceContext,
    };

    dispatch({
      type: 'set_source_context',
      payload: enrichedSourceContext,
    });
    dispatch({ type: 'set_awaiting_plan_approval', payload: false });
    dispatch({ type: 'set_generation_progress', payload: null });
    dispatch({ type: 'set_status', payload: AgentStatus.CONVERTING });

    cancelRequestedRef.current = false;
    const controller = new AbortController();
    activeControllerRef.current = controller;

    const generatedFiles = currentState.generatedFiles;
    const totalFilesToGenerate = flattenFiles(generatedFiles).filter(
      (file) => file.type === 'file',
    ).length;
    let startedFileCount = 0;

    try {
      dispatch({
        type: 'set_generation_progress',
        payload: {
          current: 0,
          total: totalFilesToGenerate,
          currentFile: null,
        },
      });

      await runGeneratePhase({
        generatedFiles,
        analysis: currentState.analysis,
        sourceContext: enrichedSourceContext,
        fileContents: generationContextRef.current.fileContents,
        filesToRead: generationContextRef.current.filesToRead,
        graph: generationContextRef.current.graph,
        config: currentState.config,
        addLog,
        abortSignal: controller.signal,
        onFileStart: (path) => {
          startedFileCount = Math.min(
            startedFileCount + 1,
            totalFilesToGenerate,
          );
          dispatch({
            type: 'set_generation_progress',
            payload: {
              current: startedFileCount,
              total: totalFilesToGenerate,
              currentFile: path,
            },
          });
          dispatch({
            type: 'update_file_status',
            payload: { path, status: 'migrating', tree: 'target' },
          });
          dispatch({ type: 'set_selected_file', payload: path });
        },
        onFileChunk: (path, content) => {
          dispatch({
            type: 'update_file_content',
            payload: { path, content, tree: 'target' },
          });
        },
        onFileGenerated: (path, content) => {
          dispatch({
            type: 'update_file_content',
            payload: { path, content, tree: 'target' },
          });
          dispatch({
            type: 'update_file_status',
            payload: { path, status: 'done', tree: 'target' },
          });
        },
        onFileError: (path) => {
          dispatch({
            type: 'update_file_status',
            payload: { path, status: 'error', tree: 'target' },
          });
        },
      });

      dispatch({
        type: 'set_generation_progress',
        payload: {
          current: totalFilesToGenerate,
          total: totalFilesToGenerate,
          currentFile: null,
        },
      });

      dispatch({ type: 'set_status', payload: AgentStatus.VERIFYING });

      const verificationResult = await runVerificationPhase({
        generatedFiles,
        analysis: currentState.analysis,
        addLog,
        abortSignal: controller.signal,
        onFileFixed: (path, content) => {
          dispatch({
            type: 'update_file_content',
            payload: { path, content, tree: 'target' },
          });
          dispatch({
            type: 'update_file_status',
            payload: { path, status: 'done', tree: 'target' },
          });
        },
      });

      if (!verificationResult.passed) {
        addLog(
          `Verification reported ${verificationResult.issues.length} issue(s). Review recommended before shipping.`,
          'warning',
          AgentStatus.VERIFYING,
        );
      }

      const endTime = Date.now();
      const report = generateReport(
        currentState.files,
        generatedFiles,
        currentState.startTime || Date.now(),
        endTime,
        currentState.analysis,
      );
      const historyEntry = createHistoryEntry({
        state: currentState,
        report,
        endTime,
      });

      dispatch({
        type: 'set_history',
        payload: [...currentState.history, historyEntry].slice(
          -MAX_HISTORY_ENTRIES,
        ),
      });
      dispatch({ type: 'set_report', payload: report });
      dispatch({ type: 'set_status', payload: AgentStatus.COMPLETED });
      setShowReport(true);
      addLog(
        'Migration Complete. System Ready.',
        'success',
        AgentStatus.COMPLETED,
      );
    } catch (error: unknown) {
      if (isAbortError(error)) {
        if (!cancelRequestedRef.current) {
          addLog('Operation cancelled.', 'warning', AgentStatus.IDLE);
        }
        dispatch({ type: 'set_generation_progress', payload: null });
        dispatch({ type: 'set_status', payload: AgentStatus.IDLE });
        dispatch({ type: 'set_awaiting_plan_approval', payload: true });
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog(`Fatal Error: ${errorMessage}`, 'error', AgentStatus.ERROR);
      dispatch({ type: 'set_generation_progress', payload: null });
      dispatch({ type: 'set_status', payload: AgentStatus.ERROR });
    } finally {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
      cancelRequestedRef.current = false;
    }
  }, [addLog]);

  const handleConfigConfirm = useCallback(() => {
    setShowConfigModal(false);
    void prepareMigrationPlan();
  }, [prepareMigrationPlan]);

  const setPlaybookNotes = useCallback((notes: string) => {
    dispatch({ type: 'set_playbook_notes', payload: notes });
  }, []);

  const setClarificationAnswer = useCallback(
    (questionId: string, answer: string) => {
      dispatch({
        type: 'set_clarification_answer',
        payload: { questionId, answer },
      });
    },
    [],
  );

  const clearHistory = useCallback(() => {
    dispatch({ type: 'set_history', payload: [] });
  }, []);

  const handleDownload = useCallback(async () => {
    const { generatedFiles } = stateRef.current;

    if (generatedFiles.length === 0) {
      return;
    }

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    const addNodeToZip = (
      nodes: FileNode[],
      folder: import('jszip').default,
    ): void => {
      nodes.forEach((node) => {
        if (node.type === 'dir' && node.children) {
          const newFolder = folder.folder(node.name);
          if (newFolder) {
            addNodeToZip(node.children, newFolder);
          }
          return;
        }

        if (node.type === 'file') {
          const content =
            node.content || '// File content generation failed or pending.';
          folder.file(node.name, content);
        }
      });
    };

    addNodeToZip(generatedFiles, zip);

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'nextjs-dust-off.zip';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      addLog('Project downloaded successfully.', 'success');
    } catch (error: unknown) {
      addLog('Failed to zip project files.', 'error');
      console.error(error);
    }
  }, [addLog]);

  const handleFileSelect = useCallback(
    async (path: string) => {
      dispatch({ type: 'set_selected_file', payload: path });

      const currentState = stateRef.current;
      if (currentState.activeTree !== 'source') {
        return;
      }

      const node = flattenFiles(currentState.files).find(
        (file) => file.path === path,
      );
      if (!node || node.type !== 'file' || node.content !== undefined) {
        return;
      }

      try {
        const content = await fetchFileContent(currentState.url, path, {
          onRateLimitUpdate: handleGitHubRateLimitUpdate,
        });
        dispatch({
          type: 'update_file_content',
          payload: { path, content, tree: 'source' },
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        dispatch({
          type: 'update_file_content',
          payload: {
            path,
            content: `// Error loading content for ${path}\n// ${errorMessage}`,
            tree: 'source',
          },
        });
      }
    },
    [handleGitHubRateLimitUpdate],
  );

  const handleGeneratedFileEdit = useCallback(
    (path: string, content: string) => {
      dispatch({
        type: 'update_file_content',
        payload: { path, content, tree: 'target' },
      });
      dispatch({
        type: 'update_file_status',
        payload: { path, status: 'done', tree: 'target' },
      });
    },
    [],
  );

  const regenerateTargetFile = useCallback(
    async (path: string, instructions = '') => {
      const currentState = stateRef.current;

      if (isBusyStatus(currentState.status)) {
        addLog(
          'Please wait for the current operation to finish before regenerating a file.',
          'warning',
        );
        return;
      }

      if (activeControllerRef.current) {
        addLog(
          'Another operation is already running. Wait for it to finish, then try again.',
          'warning',
        );
        return;
      }

      if (!currentState.analysis) {
        addLog(
          'Run repository analysis first before regenerating individual files.',
          'warning',
        );
        return;
      }

      const targetNode = flattenFiles(currentState.generatedFiles).find(
        (node) => node.path === path,
      );
      if (!targetNode || targetNode.type !== 'file') {
        addLog(`Cannot regenerate unknown file: ${path}`, 'error');
        return;
      }

      const sourceContext =
        generationContextRef.current?.sourceContext ||
        currentState.sourceContext;
      if (!sourceContext.trim()) {
        addLog(
          'Source context is unavailable. Run Configure & Build before per-file regeneration.',
          'warning',
        );
        return;
      }

      const previousContent = targetNode.content || '';
      const controller = new AbortController();

      cancelRequestedRef.current = false;
      activeControllerRef.current = controller;
      setRegeneratingFilePath(path);
      dispatch({ type: 'set_active_tree', payload: 'target' });
      dispatch({ type: 'set_selected_file', payload: path });

      try {
        await runRegenerateFilePhase({
          targetPath: path,
          generatedFiles: currentState.generatedFiles,
          analysis: currentState.analysis,
          sourceContext,
          fileContents: generationContextRef.current?.fileContents || {},
          filesToRead: generationContextRef.current?.filesToRead || [],
          graph: generationContextRef.current?.graph || {},
          config: currentState.config,
          userInstructions: instructions.trim(),
          addLog,
          abortSignal: controller.signal,
          onFileStart: (filePath) => {
            dispatch({
              type: 'update_file_status',
              payload: { path: filePath, status: 'migrating', tree: 'target' },
            });
          },
          onFileChunk: (filePath, content) => {
            dispatch({
              type: 'update_file_content',
              payload: { path: filePath, content, tree: 'target' },
            });
          },
          onFileGenerated: (filePath, content) => {
            dispatch({
              type: 'update_file_content',
              payload: { path: filePath, content, tree: 'target' },
            });
            dispatch({
              type: 'update_file_status',
              payload: { path: filePath, status: 'done', tree: 'target' },
            });
          },
          onFileError: (filePath) => {
            dispatch({
              type: 'update_file_status',
              payload: { path: filePath, status: 'error', tree: 'target' },
            });
          },
        });

        addLog(`Regenerated ${path}.`, 'success', AgentStatus.COMPLETED);
      } catch (error: unknown) {
        dispatch({
          type: 'update_file_content',
          payload: { path, content: previousContent, tree: 'target' },
        });

        if (isAbortError(error)) {
          dispatch({
            type: 'update_file_status',
            payload: { path, status: 'done', tree: 'target' },
          });
          if (!cancelRequestedRef.current) {
            addLog(`Regeneration cancelled for ${path}.`, 'warning');
          }
          return;
        }

        dispatch({
          type: 'update_file_status',
          payload: { path, status: 'error', tree: 'target' },
        });
        const message = error instanceof Error ? error.message : String(error);
        addLog(`Failed to regenerate ${path}: ${message}`, 'error');
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
        }
        cancelRequestedRef.current = false;
        setRegeneratingFilePath(null);
      }
    },
    [addLog],
  );

  const selectedNode = useMemo(() => {
    if (!state.selectedFile) {
      return null;
    }

    const tree =
      state.activeTree === 'source' ? state.files : state.generatedFiles;
    return (
      flattenFiles(tree).find((file) => file.path === state.selectedFile) ||
      null
    );
  }, [state.activeTree, state.files, state.generatedFiles, state.selectedFile]);

  const isAnalyzed = Boolean(state.analysis);
  const isPreparingPlan =
    state.status === AgentStatus.PLANNING && !state.awaitingPlanApproval;
  const isAwaitingPlanApproval = state.awaitingPlanApproval;
  const isWorking =
    state.status !== AgentStatus.IDLE &&
    state.status !== AgentStatus.COMPLETED &&
    state.status !== AgentStatus.ERROR;

  const isBusy =
    state.status === AgentStatus.ANALYZING ||
    state.status === AgentStatus.CONVERTING ||
    state.status === AgentStatus.VERIFYING ||
    isPreparingPlan;

  return {
    state,
    isDiagramOpen,
    setIsDiagramOpen,
    showReport,
    setShowReport,
    showConfigModal,
    setShowConfigModal,
    isAnalyzed,
    isWorking,
    isBusy,
    isPreparingPlan,
    isAwaitingPlanApproval,
    regeneratingFilePath,
    selectedNode,
    setUrl,
    setConfig,
    setIncludeDirectories,
    setExcludeDirectories,
    setActiveTree,
    startRepoProcess,
    cancelCurrentRun,
    handleConfigConfirm,
    approveMigrationPlan,
    setPlaybookNotes,
    setClarificationAnswer,
    clearHistory,
    handleDownload,
    handleFileSelect,
    handleGeneratedFileEdit,
    regenerateTargetFile,
  };
};

export { isImageFile };

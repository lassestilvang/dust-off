import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import JSZip from 'jszip';
import {
  AgentStatus,
  FileNode,
  LogEntry,
  MigrationConfig,
  MigrationReport,
  RepoAnalysisResult,
  RepoState,
} from '../types';
import { fetchFileContent } from '../services/githubService';
import {
  flattenFiles,
  generateReport,
  isImageFile,
  runAnalyzePhase,
  runGeneratePhase,
  runScaffoldPhase,
  runVerificationPhase,
} from '../services/migrationOrchestrator';
import { useMigrationLogs } from './useMigrationLogs';
import { isAbortError } from '../services/abortUtils';

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
};

type RepoAction =
  | { type: 'set_url'; payload: string }
  | { type: 'set_status'; payload: AgentStatus }
  | { type: 'reset_for_analysis' }
  | { type: 'set_files'; payload: FileNode[] }
  | { type: 'set_analysis'; payload: RepoAnalysisResult }
  | { type: 'set_diagram'; payload: string | null }
  | { type: 'set_source_context'; payload: string }
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
        startTime: Date.now(),
      };

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

    case 'set_diagram':
      return { ...state, diagram: action.payload };

    case 'set_source_context':
      return { ...state, sourceContext: action.payload };

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
      return { ...state, config: action.payload };

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
  selectedNode: FileNode | null;
  setUrl: (url: string) => void;
  setConfig: (config: MigrationConfig) => void;
  setActiveTree: (tree: 'source' | 'target') => void;
  startRepoProcess: () => Promise<void>;
  cancelCurrentRun: () => void;
  handleConfigConfirm: () => void;
  handleDownload: () => Promise<void>;
  handleFileSelect: (path: string) => Promise<void>;
}

export const useRepoMigration = (): UseRepoMigrationResult => {
  const [state, dispatch] = useReducer(repoReducer, initialRepoState);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const activeControllerRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
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

  const setActiveTree = useCallback((tree: 'source' | 'target') => {
    dispatch({ type: 'set_active_tree', payload: tree });
  }, []);

  const cancelCurrentRun = useCallback(() => {
    if (!activeControllerRef.current) {
      return;
    }

    const currentStatus = stateRef.current.status;
    cancelRequestedRef.current = true;
    activeControllerRef.current.abort();
    activeControllerRef.current = null;
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
    const { url } = stateRef.current;

    if (!url) {
      addLog('Please enter a valid GitHub URL.', 'error');
      return;
    }

    dispatch({ type: 'reset_for_analysis' });
    cancelRequestedRef.current = false;
    const controller = new AbortController();
    activeControllerRef.current = controller;

    try {
      const result = await runAnalyzePhase({
        url,
        addLog,
        ensureDiagramApiKey,
        abortSignal: controller.signal,
      });

      dispatch({ type: 'set_files', payload: result.files });
      dispatch({ type: 'set_analysis', payload: result.analysis });

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
  }, [addLog, ensureDiagramApiKey]);

  const startMigration = useCallback(async () => {
    const currentState = stateRef.current;

    if (!currentState.analysis || !currentState.config) {
      return;
    }

    dispatch({ type: 'set_status', payload: AgentStatus.CONVERTING });
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
        abortSignal: controller.signal,
      });

      dispatch({
        type: 'set_source_context',
        payload: scaffoldResult.sourceContext,
      });

      dispatch({
        type: 'set_generated_files',
        payload: scaffoldResult.generatedFiles,
      });

      await runGeneratePhase({
        generatedFiles: scaffoldResult.generatedFiles,
        analysis: currentState.analysis,
        sourceContext: scaffoldResult.sourceContext,
        fileContents: scaffoldResult.fileContents,
        filesToRead: scaffoldResult.filesToRead,
        graph: scaffoldResult.graph,
        config: currentState.config,
        addLog,
        abortSignal: controller.signal,
        onFileStart: (path) => {
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

      dispatch({ type: 'set_status', payload: AgentStatus.VERIFYING });

      const verificationResult = await runVerificationPhase({
        generatedFiles: scaffoldResult.generatedFiles,
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
        scaffoldResult.generatedFiles,
        currentState.startTime || Date.now(),
        endTime,
        currentState.analysis,
      );

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
  }, [addLog]);

  const handleConfigConfirm = useCallback(() => {
    setShowConfigModal(false);
    void startMigration();
  }, [startMigration]);

  const handleDownload = useCallback(async () => {
    const { generatedFiles } = stateRef.current;

    if (generatedFiles.length === 0) {
      return;
    }

    const zip = new JSZip();

    const addNodeToZip = (nodes: FileNode[], folder: JSZip): void => {
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

  const handleFileSelect = useCallback(async (path: string) => {
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
      const content = await fetchFileContent(currentState.url, path);
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
  }, []);

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
  const isWorking =
    state.status !== AgentStatus.IDLE &&
    state.status !== AgentStatus.COMPLETED &&
    state.status !== AgentStatus.ERROR;

  const isBusy =
    state.status === AgentStatus.ANALYZING ||
    state.status === AgentStatus.CONVERTING ||
    state.status === AgentStatus.VERIFYING;

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
    selectedNode,
    setUrl,
    setConfig,
    setActiveTree,
    startRepoProcess,
    cancelCurrentRun,
    handleConfigConfirm,
    handleDownload,
    handleFileSelect,
  };
};

export { isImageFile };

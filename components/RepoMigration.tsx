import React from 'react';
import {
  Github,
  Play,
  Layers,
  ArrowRight,
  Loader2,
  GitBranch,
  Database,
  Layout,
  RotateCw,
  RefreshCw,
  Maximize2,
  X,
  Code2,
  Server,
  Download,
  PackageCheck,
  AlertCircle,
  ExternalLink,
  FileImage,
  Square,
  Clock3,
  Copy,
  Check,
} from 'lucide-react';
import AgentLogs from './AgentLogs';
import FileExplorer from './FileExplorer';
import CodeEditor from './CodeEditor';
import MigrationReportModal from './MigrationReportModal';
import MigrationConfigModal from './MigrationConfig';
import MigrationPlaybookPanel from './MigrationPlaybookPanel';
import MigrationHistoryDashboard from './MigrationHistoryDashboard';
import { NextjsIcon, ReactIcon, VueIcon, PythonIcon, PhpIcon } from './Icons';
import { AgentStatus, FileNode } from '../types';
import { useRepoMigration, isImageFile } from '../hooks/useRepoMigration';
import { normalizeGitHubRepoUrl } from '../services/githubService';

const flattenFilePaths = (nodes: FileNode[]): string[] => {
  const filePaths: string[] = [];

  const visit = (entries: FileNode[]) => {
    for (const node of entries) {
      if (node.type === 'file') {
        filePaths.push(node.path);
      }
      if (node.children) {
        visit(node.children);
      }
    }
  };

  visit(nodes);
  return filePaths;
};

const getFrameworkIcon = (name: string) => {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes('react')) {
    return <ReactIcon className="w-4 h-4 text-blue-400" />;
  }
  if (normalizedName.includes('vue')) {
    return <VueIcon className="w-4 h-4 text-green-400" />;
  }
  if (normalizedName.includes('python')) {
    return <PythonIcon className="w-4 h-4 text-blue-300" />;
  }
  if (normalizedName.includes('php') || normalizedName.includes('laravel')) {
    return <PhpIcon className="w-4 h-4 text-indigo-400" />;
  }
  return <Code2 className="w-4 h-4 text-gray-400" />;
};

const RepoMigration: React.FC = () => {
  const {
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
  } = useRepoMigration();

  const rateLimitResetLabel = state.githubRateLimit?.resetAt
    ? new Date(state.githubRateLimit.resetAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'n/a';

  const selectedIncludeSet = new Set(state.includeDirectories);
  const selectedExcludeSet = new Set(state.excludeDirectories);
  const [copyStatus, setCopyStatus] = React.useState<
    'idle' | 'copied' | 'error'
  >('idle');

  const activeFilePaths = React.useMemo(() => {
    const tree =
      state.activeTree === 'source' ? state.files : state.generatedFiles;
    return flattenFilePaths(tree);
  }, [state.activeTree, state.files, state.generatedFiles]);

  const generationPercent =
    state.generationProgress && state.generationProgress.total > 0
      ? Math.round(
          (state.generationProgress.current / state.generationProgress.total) *
            100,
        )
      : 0;

  const canCopyGeneratedCode = Boolean(
    state.activeTree === 'target' &&
    selectedNode &&
    selectedNode.type === 'file' &&
    !isImageFile(selectedNode.name) &&
    selectedNode.content,
  );
  const canRegenerateGeneratedCode = Boolean(
    (state.status === AgentStatus.COMPLETED ||
      state.status === AgentStatus.VERIFYING) &&
    state.activeTree === 'target' &&
    selectedNode &&
    selectedNode.type === 'file' &&
    !isImageFile(selectedNode.name),
  );
  const isRegeneratingSelectedFile = Boolean(
    selectedNode &&
    selectedNode.type === 'file' &&
    regeneratingFilePath === selectedNode.path,
  );
  const trimmedRepoUrl = state.url.trim();
  const normalizedRepoUrl = React.useMemo(
    () => normalizeGitHubRepoUrl(state.url),
    [state.url],
  );
  const isRepoUrlValid = Boolean(normalizedRepoUrl);
  const showRepoUrlError = trimmedRepoUrl.length > 0 && !isRepoUrlValid;
  const isAnalyzeDisabled =
    isBusy || trimmedRepoUrl.length === 0 || !isRepoUrlValid;

  const copyGeneratedCode = React.useCallback(async () => {
    if (
      !(
        selectedNode &&
        selectedNode.type === 'file' &&
        state.activeTree === 'target' &&
        selectedNode.content
      )
    ) {
      return;
    }

    const text = selectedNode.content;
    const fallbackCopy = (): boolean => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        return document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyStatus('copied');
        return;
      }

      setCopyStatus(fallbackCopy() ? 'copied' : 'error');
    } catch {
      setCopyStatus(fallbackCopy() ? 'copied' : 'error');
    }
  }, [selectedNode, state.activeTree]);

  React.useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyStatus('idle');
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyStatus]);

  const handleRepoUrlBlur = React.useCallback(() => {
    if (normalizedRepoUrl && normalizedRepoUrl !== state.url) {
      setUrl(normalizedRepoUrl);
    }
  }, [normalizedRepoUrl, setUrl, state.url]);

  const handleAnalyzeClick = React.useCallback(() => {
    if (isAnalyzeDisabled) {
      return;
    }
    void startRepoProcess();
  }, [isAnalyzeDisabled, startRepoProcess]);

  const handleApprovePlan = React.useCallback(() => {
    if (!isAwaitingPlanApproval) {
      return;
    }
    void approveMigrationPlan();
  }, [approveMigrationPlan, isAwaitingPlanApproval]);

  const handleRegenerateClick = React.useCallback(() => {
    if (
      !(
        selectedNode &&
        selectedNode.type === 'file' &&
        state.activeTree === 'target'
      )
    ) {
      return;
    }

    const instructions = window.prompt(
      'Optional instructions for this file regeneration (leave blank to use defaults).',
      '',
    );

    if (instructions === null) {
      return;
    }

    void regenerateTargetFile(selectedNode.path, instructions);
  }, [regenerateTargetFile, selectedNode, state.activeTree]);

  const handleRegenerateFromExplorer = React.useCallback(
    (path: string) => {
      if (
        state.status !== AgentStatus.COMPLETED &&
        state.status !== AgentStatus.VERIFYING
      ) {
        return;
      }

      const instructions = window.prompt(
        `Optional instructions for regenerating ${path} (leave blank to use defaults).`,
        '',
      );

      if (instructions === null) {
        return;
      }

      void regenerateTargetFile(path, instructions);
    },
    [regenerateTargetFile, state.status],
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableElement = Boolean(
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable),
      );

      if (event.key === 'Escape') {
        if (isDiagramOpen) {
          event.preventDefault();
          setIsDiagramOpen(false);
          return;
        }
        if (showReport) {
          event.preventDefault();
          setShowReport(false);
          return;
        }
        if (showConfigModal) {
          event.preventDefault();
          setShowConfigModal(false);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();

        if (isBusy || trimmedRepoUrl.length === 0 || !isRepoUrlValid) {
          return;
        }

        if (!isAnalyzed) {
          void startRepoProcess();
          return;
        }

        if (isAwaitingPlanApproval) {
          void approveMigrationPlan();
          return;
        }

        if (
          state.status === AgentStatus.PLANNING ||
          state.status === AgentStatus.CONVERTING ||
          state.status === AgentStatus.VERIFYING
        ) {
          return;
        }

        handleConfigConfirm();
        return;
      }

      if (isEditableElement) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveTree('source');
        return;
      }

      if (event.key === 'ArrowRight') {
        if (state.generatedFiles.length === 0) {
          return;
        }
        event.preventDefault();
        setActiveTree('target');
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }

      if (activeFilePaths.length === 0) {
        return;
      }

      event.preventDefault();

      const selectedIndex = state.selectedFile
        ? activeFilePaths.indexOf(state.selectedFile)
        : -1;

      if (event.key === 'ArrowDown') {
        const nextIndex =
          selectedIndex < 0
            ? 0
            : Math.min(selectedIndex + 1, activeFilePaths.length - 1);
        void handleFileSelect(activeFilePaths[nextIndex]);
        return;
      }

      const previousIndex =
        selectedIndex < 0
          ? activeFilePaths.length - 1
          : Math.max(selectedIndex - 1, 0);
      void handleFileSelect(activeFilePaths[previousIndex]);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    activeFilePaths,
    handleConfigConfirm,
    handleFileSelect,
    approveMigrationPlan,
    isAnalyzed,
    isAwaitingPlanApproval,
    isBusy,
    isRepoUrlValid,
    isDiagramOpen,
    setActiveTree,
    setIsDiagramOpen,
    setShowConfigModal,
    setShowReport,
    showConfigModal,
    showReport,
    startRepoProcess,
    state.generatedFiles.length,
    state.selectedFile,
    state.status,
    trimmedRepoUrl.length,
  ]);

  return (
    <>
      <div className="flex flex-col gap-6 h-full overflow-hidden">
        <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 flex flex-col gap-4 shrink-0 shadow-lg">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
              <span className="text-gray-500 font-medium uppercase tracking-wider w-full sm:w-auto">
                Try an example:
              </span>

              <div className="flex items-center rounded-md bg-dark-900 border border-dark-600 overflow-hidden transition-colors hover:border-accent-500/50">
                <button
                  onClick={() =>
                    setUrl(
                      'https://github.com/lassestilvang/example-php-github-copilot-cli-challenge',
                    )
                  }
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-dark-800 transition-colors text-gray-300 hover:text-foreground-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PhpIcon className="w-3.5 h-3.5 text-indigo-400" />
                  PHP (Legacy)
                </button>
                <a
                  href="https://github.com/lassestilvang/example-php-github-copilot-cli-challenge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1.5 hover:bg-dark-800 border-l border-dark-700 text-gray-500 hover:text-foreground-primary transition-colors flex items-center h-full"
                  title="View Repository"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center rounded-md bg-dark-900 border border-dark-600 overflow-hidden transition-colors hover:border-accent-500/50">
                <button
                  onClick={() =>
                    setUrl(
                      'https://github.com/lassestilvang/example-create-vue',
                    )
                  }
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-dark-800 transition-colors text-gray-300 hover:text-foreground-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <VueIcon className="w-3.5 h-3.5 text-green-400" />
                  Vue.js
                </button>
                <a
                  href="https://github.com/lassestilvang/example-create-vue"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1.5 hover:bg-dark-800 border-l border-dark-700 text-gray-500 hover:text-foreground-primary transition-colors flex items-center h-full"
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
                name="repo-url"
                id="repo-url"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                value={state.url}
                onChange={(event) => setUrl(event.target.value)}
                onBlur={handleRepoUrlBlur}
                disabled={isBusy}
                placeholder="https://github.com/username/repository"
                inputMode="url"
                aria-invalid={showRepoUrlError}
                className={`
                            w-full bg-dark-900 border rounded-lg pl-10 pr-4 py-3 text-gray-200 focus:outline-none transition-colors
                            ${state.status === AgentStatus.ERROR || showRepoUrlError ? 'border-red-500/50 focus:border-red-500' : 'border-dark-600 focus:border-accent-500'}
                        `}
              />
            </div>
            {showRepoUrlError && (
              <p className="text-xs text-red-300">
                Enter a GitHub repository URL like
                {' https://github.com/owner/repo'}.
              </p>
            )}
            {!showRepoUrlError && (
              <p className="text-xs text-gray-500">
                Paste any public GitHub repository link. We will normalize it
                for you.
              </p>
            )}
            {state.status === AgentStatus.ERROR && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-200 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>
                  Analysis failed. Please check the URL, repository privacy
                  settings, or GitHub API limits and try again.
                </span>
              </div>
            )}

            {state.githubRateLimit && (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-dark-900 border border-dark-600 text-xs text-gray-300">
                <div className="flex items-center gap-1.5 text-gray-400 uppercase tracking-wide font-mono">
                  <Github className="w-3.5 h-3.5" />
                  Rate Limit
                </div>
                <span className="px-2 py-0.5 rounded bg-dark-800 border border-dark-700 font-mono">
                  Remaining: {state.githubRateLimit.remaining ?? '--'} /{' '}
                  {state.githubRateLimit.limit ?? '--'}
                </span>
                <span className="flex items-center gap-1 text-gray-400 font-mono">
                  <Clock3 className="w-3.5 h-3.5" />
                  Reset {rateLimitResetLabel}
                </span>
              </div>
            )}

            {state.repoScope && (
              <div className="flex flex-col gap-3 p-3 rounded-lg bg-dark-900 border border-dark-600">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-300">
                  <span className="px-2 py-0.5 rounded bg-dark-800 border border-dark-700">
                    Files: {state.repoScope.filteredFiles} /{' '}
                    {state.repoScope.totalFiles}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-dark-800 border border-dark-700">
                    Analyzed: {state.repoScope.analyzedFiles}
                  </span>
                  {state.repoScope.truncated && (
                    <span className="px-2 py-0.5 rounded bg-yellow-900/30 border border-yellow-500/40 text-yellow-200">
                      Truncated to first {state.repoScope.analyzedFiles} files
                    </span>
                  )}
                </div>

                {state.repoScope.truncated && (
                  <p className="text-xs text-yellow-200">
                    Large repository detected. Select directories to include or
                    exclude, then click{' '}
                    <span className="font-semibold">Re-analyze Repo</span> for
                    better coverage.
                  </p>
                )}

                {state.repoScope.availableDirectories.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                        Include Directories
                      </label>
                      <select
                        multiple
                        disabled={isBusy}
                        value={state.includeDirectories}
                        onChange={(event) => {
                          const value = Array.from(
                            event.target.selectedOptions,
                          ).map((option) => option.value);
                          setIncludeDirectories(value);
                        }}
                        className="h-28 bg-dark-950 border border-dark-700 rounded-md px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent-500"
                      >
                        {state.repoScope.availableDirectories.map(
                          (directory) => (
                            <option
                              key={directory}
                              value={directory}
                              disabled={selectedExcludeSet.has(directory)}
                            >
                              {directory}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                        Exclude Directories
                      </label>
                      <select
                        multiple
                        disabled={isBusy}
                        value={state.excludeDirectories}
                        onChange={(event) => {
                          const value = Array.from(
                            event.target.selectedOptions,
                          ).map((option) => option.value);
                          setExcludeDirectories(value);
                        }}
                        className="h-28 bg-dark-950 border border-dark-700 rounded-md px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent-500"
                      >
                        {state.repoScope.availableDirectories.map(
                          (directory) => (
                            <option
                              key={directory}
                              value={directory}
                              disabled={selectedIncludeSet.has(directory)}
                            >
                              {directory}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleAnalyzeClick}
                disabled={isAnalyzeDisabled}
                className={`
                        flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap w-full md:w-auto
                        ${
                          !isAnalyzed && !isAnalyzeDisabled
                            ? 'bg-accent-600 hover:bg-accent-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                            : 'bg-dark-700 hover:bg-dark-600 text-gray-300 border border-dark-600'
                        }
                        ${isAnalyzeDisabled ? 'opacity-70 cursor-not-allowed' : ''}
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

              {state.status === AgentStatus.COMPLETED ? (
                <>
                  <button
                    onClick={() => void handleDownload()}
                    className="flex items-center justify-center gap-2 py-2 px-6 rounded-lg font-bold text-sm transition-all whitespace-nowrap w-full md:w-auto bg-green-600 hover:bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] animate-in fade-in zoom-in-95"
                  >
                    <Download className="w-4 h-4" />
                    Download Project
                  </button>
                  <button
                    onClick={() => setShowReport(true)}
                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap bg-dark-700 hover:bg-dark-600 text-foreground-primary border border-dark-600"
                  >
                    <PackageCheck className="w-4 h-4" />
                    View Report
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowConfigModal(true)}
                  disabled={
                    !isAnalyzed ||
                    isPreparingPlan ||
                    state.status === AgentStatus.CONVERTING ||
                    state.status === AgentStatus.VERIFYING
                  }
                  className={`
                            flex items-center justify-center gap-2 py-2 px-6 rounded-lg font-bold text-sm transition-all whitespace-nowrap w-full md:w-auto
                            ${
                              isAnalyzed
                                ? 'bg-accent-600 hover:bg-accent-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-in fade-in zoom-in-95'
                                : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-dark-700'
                            }
                            `}
                >
                  {isPreparingPlan ||
                  state.status === AgentStatus.CONVERTING ||
                  state.status === AgentStatus.VERIFYING ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GitBranch className="w-4 h-4" />
                  )}
                  {isPreparingPlan
                    ? 'Preparing Playbook...'
                    : state.status === AgentStatus.CONVERTING
                      ? 'Building Project...'
                      : state.status === AgentStatus.VERIFYING
                        ? 'Verifying Output...'
                        : isAwaitingPlanApproval
                          ? 'Playbook Ready'
                          : 'Configure & Build'}
                </button>
              )}
              {isBusy && (
                <button
                  onClick={cancelCurrentRun}
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap bg-red-700/90 hover:bg-red-600 text-white border border-red-500/40"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Cancel
                </button>
              )}
              {showConfigModal && (
                <MigrationConfigModal
                  config={state.config}
                  onChange={setConfig}
                  onConfirm={handleConfigConfirm}
                  onCancel={() => setShowConfigModal(false)}
                />
              )}
            </div>

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

          {state.status === AgentStatus.CONVERTING &&
            state.generationProgress &&
            state.generationProgress.total > 0 && (
              <div className="rounded-lg border border-accent-500/20 bg-accent-900/10 p-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-accent-100">
                    Generating file {state.generationProgress.current} of{' '}
                    {state.generationProgress.total}
                  </span>
                  <span className="text-accent-300/80">
                    {Math.max(0, Math.min(100, generationPercent))}%
                  </span>
                </div>
                <div className="h-2 w-full bg-dark-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-500 transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, generationPercent))}%`,
                    }}
                  />
                </div>
                {state.generationProgress.currentFile && (
                  <p className="text-[11px] text-gray-300 truncate font-mono">
                    {state.generationProgress.currentFile}
                  </p>
                )}
              </div>
            )}

          {state.analysis && (
            <div className="mt-2 pt-4 border-t border-dark-700 flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-top-2">
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-900 border border-dark-600">
                    {getFrameworkIcon(state.analysis.detectedFramework)}
                    <span className="text-gray-300 text-xs font-bold uppercase">
                      {state.analysis.detectedFramework}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-900/20 border border-accent-500/30">
                    <NextjsIcon className="w-4 h-4 text-accent-400" />
                    <span className="text-accent-100 text-xs font-bold uppercase">
                      Next.js 16.1
                    </span>
                  </div>

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

              <div className="shrink-0 relative">
                {state.diagram ? (
                  <div
                    onClick={() => setIsDiagramOpen(true)}
                    className="group relative w-48 h-28 bg-dark-900 rounded-lg border border-dark-600 overflow-hidden cursor-pointer hover:border-accent-500/50 transition-all shadow-md"
                  >
                    <img
                      src={state.diagram}
                      alt="Architecture"
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                      <div className="bg-dark-800/80 p-1.5 rounded-full border border-dark-500 text-foreground-primary">
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
                        <Loader2 className="w-5 h-5 animate-spin text-accent-500" />
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

        {isPreparingPlan && !state.playbook && (
          <div className="rounded-xl border border-accent-500/30 bg-accent-900/10 p-4 flex items-center gap-3 text-sm text-accent-100">
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing migration playbook, scaffold, and cost estimate...
          </div>
        )}

        {isAwaitingPlanApproval && state.playbook && (
          <MigrationPlaybookPanel
            playbook={state.playbook}
            costEstimate={state.costEstimate}
            answers={state.clarificationAnswers}
            notes={state.playbookNotes}
            isStartingGeneration={
              state.status === AgentStatus.CONVERTING ||
              state.status === AgentStatus.VERIFYING
            }
            onAnswerChange={setClarificationAnswer}
            onNotesChange={setPlaybookNotes}
            onApprove={handleApprovePlan}
            onOpenConfig={() => setShowConfigModal(true)}
          />
        )}

        {state.history.length > 0 && (
          <MigrationHistoryDashboard
            history={state.history}
            onClearHistory={clearHistory}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
          <div className="md:col-span-12 lg:col-span-4 flex flex-col h-full min-h-0 order-3 lg:order-1">
            <AgentLogs logs={state.logs} />
          </div>

          <div className="md:col-span-4 lg:col-span-2 flex flex-col h-full min-h-0 order-1 lg:order-2">
            <FileExplorer
              files={
                state.activeTree === 'source'
                  ? state.files
                  : state.generatedFiles
              }
              selectedFile={state.selectedFile}
              activeTree={state.activeTree}
              onToggleTree={setActiveTree}
              onSelectFile={(path) => void handleFileSelect(path)}
              onRegenerateFile={handleRegenerateFromExplorer}
            />
          </div>

          <div className="md:col-span-8 lg:col-span-6 flex flex-col h-full min-h-0 order-2 lg:order-3">
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
                  <div className="flex flex-col h-full min-h-0">
                    {(canCopyGeneratedCode || canRegenerateGeneratedCode) && (
                      <div className="px-3 py-2 border-b border-dark-700 bg-dark-900/80 flex justify-end">
                        <div className="inline-flex items-center gap-2">
                          {canRegenerateGeneratedCode && (
                            <button
                              onClick={handleRegenerateClick}
                              disabled={isRegeneratingSelectedFile}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border text-gray-200 bg-dark-800 border-dark-600 hover:bg-dark-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${isRegeneratingSelectedFile ? 'animate-spin' : ''}`}
                              />
                              {isRegeneratingSelectedFile
                                ? 'Regenerating...'
                                : 'Regenerate File'}
                            </button>
                          )}
                          {canCopyGeneratedCode && (
                            <button
                              onClick={() => void copyGeneratedCode()}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                                copyStatus === 'copied'
                                  ? 'text-green-200 bg-green-900/30 border-green-500/40'
                                  : copyStatus === 'error'
                                    ? 'text-red-200 bg-red-900/30 border-red-500/40'
                                    : 'text-gray-200 bg-dark-800 border-dark-600 hover:bg-dark-700'
                              }`}
                            >
                              {copyStatus === 'copied' ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              {copyStatus === 'copied'
                                ? 'Copied'
                                : copyStatus === 'error'
                                  ? 'Copy failed'
                                  : 'Copy Code'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-h-0">
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
                        readOnly={state.activeTree === 'source'}
                        onChange={(value) => {
                          if (state.activeTree === 'target') {
                            handleGeneratedFileEdit(selectedNode.path, value);
                          }
                        }}
                        highlight={
                          state.activeTree === 'target' &&
                          !!selectedNode.content
                        }
                      />
                    </div>
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
                  <div className="w-20 h-20 bg-dark-700/50 rounded-full flex items-center justify-center mb-6 border border-dark-600/50">
                    {state.activeTree === 'source' ? (
                      <Database className="w-10 h-10 text-amber-400/50" />
                    ) : (
                      <Layout className="w-10 h-10 text-accent-400/50" />
                    )}
                  </div>
                  <h3 className="text-xl font-display font-medium text-gray-200">
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

      {isDiagramOpen && state.diagram && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 p-4 sm:p-8"
          onClick={() => setIsDiagramOpen(false)}
        >
          <div
            className="relative w-full max-w-7xl max-h-full flex items-center justify-center overflow-auto rounded-lg shadow-2xl bg-dark-900 border border-dark-700"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setIsDiagramOpen(false)}
              aria-label="Close modal"
              className="absolute top-3 right-3 z-20 p-2.5 rounded-full bg-black/70 text-white hover:bg-black/85 border border-white/20 transition-colors shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={state.diagram}
              alt="Architecture Diagram"
              className="max-w-full max-h-full object-contain"
            />
            <div className="absolute bottom-4 left-4 bg-dark-800/90 px-3 py-1.5 rounded border border-dark-600 text-foreground-primary text-xs font-mono">
              LEGACY SYSTEM ARCHITECTURE
            </div>
          </div>
        </div>
      )}

      {showReport && state.report && (
        <MigrationReportModal
          report={state.report}
          onClose={() => setShowReport(false)}
          onDownload={() => void handleDownload()}
        />
      )}
    </>
  );
};

export default RepoMigration;

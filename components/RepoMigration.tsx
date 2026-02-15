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
import AgentLogs from './AgentLogs';
import FileExplorer from './FileExplorer';
import CodeEditor from './CodeEditor';
import MigrationReportModal from './MigrationReportModal';
import MigrationConfigModal from './MigrationConfig';
import { NextjsIcon, ReactIcon, VueIcon, PythonIcon, PhpIcon } from './Icons';
import { AgentStatus } from '../types';
import { useRepoMigration, isImageFile } from '../hooks/useRepoMigration';

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
    selectedNode,
    setUrl,
    setConfig,
    setActiveTree,
    startRepoProcess,
    handleConfigConfirm,
    handleDownload,
    handleFileSelect,
  } = useRepoMigration();

  return (
    <>
      <div className="flex flex-col gap-6 h-full overflow-hidden">
        <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 flex flex-col gap-4 shrink-0 shadow-lg">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3 text-xs mb-1">
              <span className="text-gray-500 font-medium uppercase tracking-wider">
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

              <div className="flex items-center rounded-md bg-dark-900 border border-dark-600 overflow-hidden transition-colors hover:border-accent-500/50">
                <button
                  onClick={() =>
                    setUrl(
                      'https://github.com/lassestilvang/example-create-vue',
                    )
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
                name="repo-url"
                id="repo-url"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                value={state.url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={isBusy}
                placeholder="https://github.com/username/repository"
                className={`
                            w-full bg-dark-900 border rounded-lg pl-10 pr-4 py-3 text-gray-200 focus:outline-none transition-colors
                            ${state.status === AgentStatus.ERROR ? 'border-red-500/50 focus:border-red-500' : 'border-dark-600 focus:border-accent-500'}
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

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => void startRepoProcess()}
                disabled={isBusy || !state.url}
                className={`
                        flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap w-full md:w-auto
                        ${
                          !isAnalyzed && state.url
                            ? 'bg-accent-600 hover:bg-accent-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
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
                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap bg-dark-700 hover:bg-dark-600 text-white border border-dark-600"
                  >
                    <PackageCheck className="w-4 h-4" />
                    View Report
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowConfigModal(true)}
                  disabled={
                    !isAnalyzed || state.status === AgentStatus.CONVERTING
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
                  {state.status === AgentStatus.CONVERTING ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GitBranch className="w-4 h-4" />
                  )}
                  {state.status === AgentStatus.CONVERTING
                    ? 'Building Project...'
                    : 'Configure & Build'}
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
          <div className="lg:col-span-4 flex flex-col h-full min-h-0 order-3 lg:order-1">
            <AgentLogs logs={state.logs} />
          </div>

          <div className="lg:col-span-2 flex flex-col h-full min-h-0 order-1 lg:order-2">
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
            />
          </div>

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

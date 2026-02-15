import React, { useState, useEffect } from 'react';
import StepIndicator from './StepIndicator';
import AgentLogs from './AgentLogs';
import CodeEditor from './CodeEditor';
import AnalysisPanel from './AnalysisPanel';
import { AgentStatus, MigrationState, LogEntry, LANGUAGES } from '../types';
import { DEFAULT_SOURCE_CODE } from '../constants';
import {
  analyzeCode,
  convertCode,
  validateGeminiApiKey,
  verifyCode,
} from '../services/geminiService';
import {
  Play,
  RotateCcw,
  ArrowRight,
  Code,
  Zap,
  FileCode2,
  Terminal,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const SnippetMigration: React.FC = () => {
  const [state, setState] = useState<MigrationState>({
    sourceLang: 'jquery',
    targetLang: 'react',
    sourceCode: DEFAULT_SOURCE_CODE,
    targetCode: '',
    status: AgentStatus.IDLE,
    logs: [],
    analysis: null,
    verification: null,
  });

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

  const startMigration = () => {
    if (!state.sourceCode.trim()) {
      addLog('Source code is empty. Aborting.', 'error');
      return;
    }
    setState((prev) => ({
      ...prev,
      status: AgentStatus.ANALYZING,
      targetCode: '',
      logs: [],
      analysis: null,
      verification: null,
    }));
    addLog('Initializing migration sequence...', 'info');
  };

  const reset = () => {
    setState((prev) => ({
      ...prev,
      status: AgentStatus.IDLE,
      targetCode: '',
      analysis: null,
      verification: null,
      logs: [],
    }));
  };

  // The Autonomous Agent Loop
  useEffect(() => {
    const runStep = async () => {
      try {
        if (state.status === AgentStatus.ANALYZING) {
          addLog('Validating Gemini API key...', 'info');
          await validateGeminiApiKey();
          addLog('Gemini API key validated.', 'success');
          addLog(
            `Analyzing ${state.sourceLang} source AST and dependencies...`,
            'info',
          );
          const analysis = await analyzeCode(
            state.sourceCode,
            state.sourceLang,
            state.targetLang,
          );

          setState((prev) => ({
            ...prev,
            analysis,
            status: AgentStatus.PLANNING,
          }));
          addLog(
            'Analysis complete. Complexity identified: ' + analysis.complexity,
            'success',
          );

          setTimeout(() => {
            setState((prev) => ({ ...prev, status: AgentStatus.CONVERTING }));
          }, 1500);
        } else if (state.status === AgentStatus.CONVERTING) {
          addLog(
            `Generating ${state.targetLang} code based on analysis strategy...`,
            'info',
          );
          if (state.analysis) {
            const converted = await convertCode(
              state.sourceCode,
              state.sourceLang,
              state.targetLang,
              state.analysis,
            );
            setState((prev) => ({
              ...prev,
              targetCode: converted,
              status: AgentStatus.VERIFYING,
            }));
            addLog(
              'Code generation complete. Initiating verification protocols...',
              'success',
            );
          } else {
            throw new Error('Analysis data missing');
          }
        } else if (state.status === AgentStatus.VERIFYING) {
          addLog(
            'Running simulated environment tests and static analysis...',
            'info',
          );
          const verification = await verifyCode(
            state.targetCode,
            state.sourceLang,
            state.targetLang,
          );

          if (verification.passed) {
            addLog('Verification passed. No critical issues found.', 'success');
            setState((prev) => ({
              ...prev,
              verification,
              status: AgentStatus.COMPLETED,
            }));
          } else {
            addLog(
              `Issues detected: ${verification.issues.join(', ')}`,
              'warning',
            );
            if (verification.fixedCode) {
              addLog('Auto-fix applied successfully.', 'success');
              setState((prev) => ({
                ...prev,
                verification,
                targetCode: verification.fixedCode!,
                status: AgentStatus.COMPLETED,
              }));
            } else {
              addLog('Could not auto-fix. Manual review required.', 'error');
              setState((prev) => ({
                ...prev,
                verification,
                status: AgentStatus.COMPLETED,
              }));
            }
          }
        }
      } catch (error: unknown) {
        console.error(error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        addLog(`Critical Failure: ${errorMessage}`, 'error');
        setState((prev) => ({ ...prev, status: AgentStatus.ERROR }));
      }
    };

    if (
      state.status !== AgentStatus.IDLE &&
      state.status !== AgentStatus.COMPLETED &&
      state.status !== AgentStatus.ERROR &&
      state.status !== AgentStatus.PLANNING
    ) {
      runStep();
    }
  }, [
    state.status,
    state.sourceCode,
    state.sourceLang,
    state.targetLang,
    state.analysis,
    state.targetCode,
  ]);

  return (
    <div className="flex flex-col gap-8 h-full">
      {/* Top: Process Indicators */}
      <div className="w-full max-w-4xl mx-auto shrink-0">
        <StepIndicator currentStatus={state.status} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start flex-1 min-h-0">
        {/* Left Column: Config & Logs */}
        <div className="lg:col-span-1 space-y-6 flex flex-col h-full min-h-0">
          <div className="bg-dark-800 p-5 rounded-xl border border-dark-700 shadow-xl shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Terminal className="w-24 h-24 text-white" />
            </div>

            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-accent-500" />
              Snippet Config
            </h2>

            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                  <Code className="w-3 h-3" />
                  SOURCE LANGUAGE
                </label>
                <div className="relative">
                  <select
                    value={state.sourceLang}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        sourceLang: e.target.value,
                      }))
                    }
                    disabled={state.status !== AgentStatus.IDLE}
                    className="w-full bg-dark-900 border border-dark-600 rounded-lg pl-3 pr-8 py-2.5 text-sm text-gray-200 focus:border-accent-500 focus:outline-none transition-colors appearance-none"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Code className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="bg-dark-900 rounded-full p-1.5 border border-dark-600">
                  <ArrowRight className="text-gray-400 w-4 h-4 rotate-90 md:rotate-0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  TARGET FRAMEWORK
                </label>
                <div className="relative">
                  <select
                    value={state.targetLang}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        targetLang: e.target.value,
                      }))
                    }
                    disabled={state.status !== AgentStatus.IDLE}
                    className="w-full bg-dark-900 border border-dark-600 rounded-lg pl-3 pr-8 py-2.5 text-sm text-gray-200 focus:border-accent-500 focus:outline-none transition-colors appearance-none"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Zap className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </div>

              <button
                onClick={
                  state.status === AgentStatus.IDLE ? startMigration : reset
                }
                className={`
                  w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all duration-300 mt-2
                  ${
                    state.status === AgentStatus.IDLE
                      ? 'bg-accent-600 hover:bg-accent-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                      : 'bg-dark-700 hover:bg-dark-600 text-gray-300'
                  }
                `}
              >
                {state.status === AgentStatus.IDLE ? (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    INITIATE MIGRATION
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    RESET AGENT
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="hidden lg:flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* AgentLogs with h-full now that outer container handles constraints */}
            <AgentLogs logs={state.logs} />
          </div>
        </div>

        {/* Right Column: Source, Analysis, Target */}
        <div className="lg:col-span-3 space-y-6 flex flex-col h-full min-h-0">
          {state.analysis && (
            <div className="shrink-0">
              <AnalysisPanel analysis={state.analysis} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
            <CodeEditor
              title="LEGACY SOURCE"
              language={state.sourceLang}
              code={state.sourceCode}
              onChange={(val) =>
                setState((prev) => ({ ...prev, sourceCode: val }))
              }
              readOnly={state.status !== AgentStatus.IDLE}
            />
            <CodeEditor
              title="TARGET OUTPUT"
              language={state.targetLang}
              code={state.targetCode}
              readOnly={true}
              highlight={state.status === AgentStatus.COMPLETED}
            />
          </div>

          <div className="lg:hidden h-48 shrink-0">
            <AgentLogs logs={state.logs} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SnippetMigration;

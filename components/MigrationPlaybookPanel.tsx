import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Coins,
  Settings2,
} from 'lucide-react';
import { MigrationCostEstimate, MigrationPlaybook } from '../types';

interface MigrationPlaybookPanelProps {
  playbook: MigrationPlaybook;
  costEstimate: MigrationCostEstimate | null;
  answers: Record<string, string>;
  notes: string;
  isStartingGeneration: boolean;
  onAnswerChange: (questionId: string, answer: string) => void;
  onNotesChange: (notes: string) => void;
  onApprove: () => void;
  onOpenConfig: () => void;
}

const MigrationPlaybookPanel: React.FC<MigrationPlaybookPanelProps> = ({
  playbook,
  costEstimate,
  answers,
  notes,
  isStartingGeneration,
  onAnswerChange,
  onNotesChange,
  onApprove,
  onOpenConfig,
}) => {
  const unresolvedRequired = playbook.questions.filter(
    (question) => question.required && !answers[question.id]?.trim(),
  );
  const canApprove = unresolvedRequired.length === 0 && !isStartingGeneration;

  return (
    <section className="rounded-xl border border-accent-500/40 bg-accent-950/20 p-4 flex flex-col gap-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-accent-100 uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Migration Playbook Review
          </h3>
          <p className="text-sm text-gray-200 mt-1">{playbook.overview}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenConfig}
            disabled={isStartingGeneration}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-dark-600 bg-dark-800 text-gray-200 hover:bg-dark-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Edit Config
          </button>
          <button
            onClick={onApprove}
            disabled={!canApprove}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-green-500/50 bg-green-900/30 text-green-100 hover:bg-green-900/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isStartingGeneration
              ? 'Starting...'
              : 'Approve & Start Generation'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg border border-dark-700 bg-dark-900 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Objective
          </h4>
          <p className="text-gray-200">{playbook.objective}</p>
        </div>
        <div className="rounded-lg border border-dark-700 bg-dark-900 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Planned Conversions
          </h4>
          <ul className="text-gray-200 space-y-1 text-xs">
            {playbook.conversionHighlights.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        <div className="rounded-lg border border-dark-700 bg-dark-900 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Execution Plan
          </h4>
          <ol className="space-y-1 text-gray-200">
            {playbook.executionPlan.map((step, index) => (
              <li key={step}>
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-lg border border-dark-700 bg-dark-900 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Risk Mitigations
          </h4>
          <ul className="space-y-1 text-gray-200">
            {playbook.riskMitigations.map((item) => (
              <li key={item} className="flex gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-300 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {costEstimate && (
        <div className="rounded-lg border border-dark-700 bg-dark-900 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-300" />
              Estimated Gemini Usage
            </h4>
            <span className="px-2 py-0.5 rounded bg-amber-900/20 border border-amber-500/40 text-amber-100 font-mono">
              ~${costEstimate.estimatedCostUsd.toFixed(4)}
            </span>
          </div>
          <p className="text-gray-300 mb-2">
            {costEstimate.totalTokens.toLocaleString()} total tokens (
            {costEstimate.inputTokens.toLocaleString()} in /{' '}
            {costEstimate.outputTokens.toLocaleString()} out)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {costEstimate.stageBreakdown.map((stage) => (
              <div
                key={`${stage.stage}-${stage.model}`}
                className="rounded border border-dark-700 bg-dark-950 px-2 py-1.5"
              >
                <p className="text-gray-200 font-semibold">{stage.stage}</p>
                <p className="text-gray-400 font-mono">{stage.model}</p>
                <p className="text-gray-300">
                  {stage.inputTokens.toLocaleString()} /{' '}
                  {stage.outputTokens.toLocaleString()} tokens
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-dark-700 bg-dark-900 p-3 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Human-In-The-Loop Decisions
        </h4>
        {playbook.questions.map((question) => (
          <div key={question.id} className="space-y-1">
            <label className="text-xs text-gray-200 font-semibold">
              {question.title}
            </label>
            <p className="text-xs text-gray-400">{question.question}</p>
            <select
              value={answers[question.id] || ''}
              onChange={(event) =>
                onAnswerChange(question.id, event.target.value)
              }
              className="w-full bg-dark-950 border border-dark-700 rounded-md px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-accent-500"
            >
              <option value="" disabled>
                Select an option
              </option>
              {question.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {question.recommendedOption && (
              <p className="text-[11px] text-accent-200">
                Recommended: {question.recommendedOption}
              </p>
            )}
            {question.rationale && (
              <p className="text-[11px] text-gray-500">{question.rationale}</p>
            )}
          </div>
        ))}

        <div className="space-y-1">
          <label className="text-xs text-gray-200 font-semibold">
            Additional Instructions (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            rows={3}
            placeholder="Example: prioritize SEO metadata, keep existing auth routes, generate minimal tests."
            className="w-full bg-dark-950 border border-dark-700 rounded-md px-2 py-2 text-xs text-gray-100 focus:outline-none focus:border-accent-500 resize-y"
          />
        </div>
      </div>
    </section>
  );
};

export default MigrationPlaybookPanel;

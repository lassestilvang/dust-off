import React from 'react';
import { AnalysisResult } from '../types';
import {
  AlertTriangle,
  Boxes,
  Code2,
  FileSearch,
  ShieldAlert,
  Package,
  Layers,
} from 'lucide-react';

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis }) => {
  if (!analysis) return null;

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-500 shadow-lg">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-dark-700">
        <FileSearch className="w-5 h-5 text-brand-400" />
        <h3 className="text-lg font-semibold text-white">Migration Analysis</h3>
      </div>

      <p className="text-gray-300 text-sm leading-relaxed border-l-2 border-brand-500/50 pl-3">
        {analysis.summary}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="bg-dark-900/50 rounded-lg p-3 border border-dark-700/50">
          <div className="flex items-center gap-2 mb-3 text-blue-400">
            <Boxes className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Dependencies
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.dependencies.length > 0 ? (
              analysis.dependencies.map((dep, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/10 text-blue-300 text-xs border border-blue-500/20 shadow-sm"
                >
                  <Package className="w-3 h-3 opacity-70" />
                  {dep}
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-xs italic">
                No external dependencies detected
              </span>
            )}
          </div>
        </div>

        <div className="bg-dark-900/50 rounded-lg p-3 border border-dark-700/50">
          <div className="flex items-center gap-2 mb-3 text-purple-400">
            <Code2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Patterns
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.patterns.length > 0 ? (
              analysis.patterns.map((pat, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 text-xs border border-purple-500/20 shadow-sm"
                >
                  <Layers className="w-3 h-3 opacity-70" />
                  {pat}
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-xs italic">
                Standard procedural
              </span>
            )}
          </div>
        </div>
      </div>

      {analysis.risks.length > 0 && (
        <div className="bg-orange-950/20 rounded-lg p-3 border border-orange-500/20">
          <div className="flex items-center gap-2 mb-2 text-orange-400">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Potential Risks
            </span>
          </div>
          <ul className="space-y-1.5 mt-2">
            {analysis.risks.map((risk, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-orange-200/80"
              >
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-orange-500/70" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AnalysisPanel;

import React from 'react';
import { MigrationReport } from '../types';
import {
  CheckCircle2,
  X,
  Download,
  ShieldCheck,
  Zap,
  TestTube,
  ArrowRight,
  Layers,
  Award,
} from 'lucide-react';

interface MigrationReportModalProps {
  report: MigrationReport;
  onClose: () => void;
  onDownload: () => void;
}

const MigrationReportModal: React.FC<MigrationReportModalProps> = ({
  report,
  onClose,
  onDownload,
}) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative">
        {/* Header */}
        <div className="p-6 border-b border-dark-700 flex items-start justify-between bg-gradient-to-r from-dark-900 to-dark-800">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground-primary tracking-tight">
                Migration Accomplished
              </h2>
              <div className="flex items-center gap-2 mt-1 text-gray-400 text-sm font-mono">
                <span>Duration: {report.duration}</span>
                <span className="w-1 h-1 bg-gray-600 rounded-full" />
                <span>{report.filesGenerated} Files Generated</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-gray-400 hover:text-foreground-primary"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dark-800 rounded-xl p-5 border border-dark-700 flex flex-col gap-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Award className="w-24 h-24" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Modernization Score
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${report.modernizationScore > 80 ? 'bg-accent-500/20 text-accent-400' : 'bg-yellow-500/20 text-yellow-400'}`}
                >
                  {report.modernizationScore > 80 ? 'EXCELLENT' : 'GOOD'}
                </span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-foreground-primary">
                  {report.modernizationScore}
                </span>
                <span className="text-lg text-gray-500 mb-1">/100</span>
              </div>
              <div className="w-full bg-dark-900 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all duration-1000"
                  style={{ width: `${report.modernizationScore}%` }}
                />
              </div>
            </div>

            <div className="bg-dark-800 rounded-xl p-5 border border-dark-700 flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <ShieldCheck className="w-24 h-24" />
              </div>
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Type Safety Coverage
              </span>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-blue-400">
                  {report.typeScriptCoverage}%
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-auto">
                Converted to strict TypeScript
              </div>
              <div className="w-full bg-dark-900 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                  style={{ width: `${report.typeScriptCoverage}%` }}
                />
              </div>
            </div>

            <div className="bg-dark-800 rounded-xl p-5 border border-dark-700 flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <TestTube className="w-24 h-24" />
              </div>
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Test Suite
              </span>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-purple-400">
                  {report.testsGenerated}
                </span>
                <span className="text-sm text-gray-400 mb-1.5">New Tests</span>
              </div>
              <div className="text-xs text-gray-500 mt-auto">
                ~{report.testCoverage}% estimated coverage
              </div>
              <div className="w-full bg-dark-900 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-1000"
                  style={{ width: `${report.testCoverage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tech Stack Transformation */}
          <div>
            <h3 className="text-lg font-bold text-foreground-primary mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-gray-400" />
              Tech Stack Transformation
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {report.techStackChanges.map((change, idx) => (
                <div
                  key={idx}
                  className="bg-dark-900/50 border border-dark-700 rounded-lg p-3 flex items-center gap-4"
                >
                  <span
                    className="text-sm text-gray-400 font-mono flex-1 text-right truncate"
                    title={change.from}
                  >
                    {change.from}
                  </span>
                  <div className="bg-dark-800 rounded-full p-1 border border-dark-700 shrink-0">
                    <ArrowRight className="w-4 h-4 text-accent-500" />
                  </div>
                  <span
                    className="text-sm text-foreground-primary font-mono font-semibold flex-1 text-left truncate"
                    title={change.to}
                  >
                    {change.to}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Key Wins */}
            <div>
              <h3 className="text-lg font-bold text-foreground-primary mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Key Engineering Wins
              </h3>
              <ul className="space-y-3">
                {report.keyImprovements.map((imp, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-sm text-gray-300"
                  >
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/20">
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                    </div>
                    {imp}
                  </li>
                ))}
              </ul>
            </div>

            {/* Details */}
            <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-5">
              <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wide">
                Project Statistics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-dark-700 pb-2">
                  <span className="text-gray-400 text-sm">
                    Total Files Processed
                  </span>
                  <span className="text-foreground-primary font-mono">
                    {report.totalFiles}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-dark-700 pb-2">
                  <span className="text-gray-400 text-sm">
                    New Dependencies Added
                  </span>
                  <span className="text-foreground-primary font-mono">
                    {report.newDependencies}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-dark-700 pb-2">
                  <span className="text-gray-400 text-sm">
                    Architecture Type
                  </span>
                  <span className="text-accent-400 font-mono text-sm">
                    App Router (Server Components)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-dark-700 bg-dark-800 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-bold text-sm bg-dark-700 hover:bg-dark-600 text-foreground-primary transition-colors border border-dark-600"
          >
            Review Code
          </button>
          <button
            onClick={onDownload}
            className="px-6 py-2.5 rounded-lg font-bold text-sm bg-accent-600 hover:bg-accent-500 text-white transition-colors shadow-lg shadow-accent-900/40 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default MigrationReportModal;

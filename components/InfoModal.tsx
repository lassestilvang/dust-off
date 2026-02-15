import React from 'react';
import { X, Bot, Zap, Code2, CheckCircle2, Workflow } from 'lucide-react';

interface InfoModalProps {
  type: 'about' | 'how-it-works' | null;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-foreground-primary hover:bg-dark-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {type === 'about' && (
          <div className="p-8">
            <div className="w-16 h-16 bg-accent-500/10 rounded-2xl flex items-center justify-center mb-6 border border-accent-500/20">
              <Bot className="w-8 h-8 text-accent-400" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground-primary mb-4">
              What is DustOff?
            </h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                The <strong className="text-foreground-primary">DustOff</strong>{' '}
                is an autonomous agent designed to solve one of software
                engineering's most tedious challenges:{' '}
                <span className="text-accent-400">Legacy Modernization</span>.
              </p>
              <p>
                Powered by Google's{' '}
                <strong className="text-foreground-primary">Gemini 3</strong>,
                it doesn't just translate syntax line-by-line. It understands
                the <em>intent</em> of your legacy code (whether it's jQuery,
                Python 2, or old PHP) and re-architects it into production-ready
                modern frameworks like{' '}
                <strong>Next.js 16.1, React, and TypeScript</strong>.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-dark-800 p-4 rounded-xl border border-dark-700">
                  <h3 className="font-semibold text-foreground-primary mb-1 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-blue-400" />
                    Context Aware
                  </h3>
                  <p className="text-xs text-gray-400">
                    Reads your entire repository structure to manage
                    dependencies and imports correctly.
                  </p>
                </div>
                <div className="bg-dark-800 p-4 rounded-xl border border-dark-700">
                  <h3 className="font-semibold text-foreground-primary mb-1 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Self-Healing
                  </h3>
                  <p className="text-xs text-gray-400">
                    Includes a verification step to detect issues and
                    auto-correct generated code.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {type === 'how-it-works' && (
          <div className="p-8 overflow-y-auto custom-scrollbar">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
              <Workflow className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground-primary mb-8">
              How it Works
            </h2>

            {/* Timeline Container */}
            <div className="relative space-y-12 pl-16 before:absolute before:left-7 before:top-3 before:bottom-3 before:w-0.5 before:bg-dark-700 before:-translate-x-1/2">
              <div className="relative">
                <div className="absolute -left-12 top-0.5 w-6 h-6 rounded-full bg-dark-900 border-2 border-accent-500 flex items-center justify-center z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                  <span className="w-2 h-2 rounded-full bg-accent-500"></span>
                </div>
                <h3 className="text-lg font-bold text-foreground-primary mb-2">
                  1. Deep Analysis
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  The agent scans your repository file tree and reads key files
                  (README, package.json) to construct a mental model of the
                  software architecture.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-12 top-0.5 w-6 h-6 rounded-full bg-dark-900 border-2 border-blue-500 flex items-center justify-center z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                </div>
                <h3 className="text-lg font-bold text-foreground-primary mb-2">
                  2. Strategic Planning
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  It designs a new project structure (e.g., Next.js App Router)
                  optimized for the target framework, generating a blueprint for
                  the migration.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-12 top-0.5 w-6 h-6 rounded-full bg-dark-900 border-2 border-purple-500 flex items-center justify-center z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                </div>
                <h3 className="text-lg font-bold text-foreground-primary mb-2">
                  3. Autonomous Refactoring
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Files are processed individually but with shared context. The
                  agent rewrites logic to use modern paradigms (e.g., Hooks,
                  Server Components).
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-12 top-0.5 w-6 h-6 rounded-full bg-dark-900 border-2 border-green-500 flex items-center justify-center z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground-primary mb-2">
                  4. Verification & Reporting
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  A final report assesses the quality of the migration,
                  providing a Modernization Score and allowing you to download
                  the result.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 bg-dark-800/50 border-t border-dark-700 mt-auto shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-dark-700 hover:bg-dark-600 text-foreground-primary rounded-xl font-bold transition-colors border border-dark-600 shadow-lg"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;

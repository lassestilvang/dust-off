import React, { useState } from 'react';
import Header from './components/Header';
import SnippetMigration from './components/SnippetMigration';
import RepoMigration from './components/RepoMigration';
import { Code2, GitBranch, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<'snippet' | 'repo'>('repo');

  return (
    <div className="h-screen flex flex-col font-sans selection:bg-brand-500/30 overflow-hidden bg-dark-900">
      <Header />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-4 flex flex-col gap-4 min-h-0">
        {/* Compact Hero Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 animate-in fade-in slide-in-from-top-4 duration-700 bg-dark-800/30 p-3 rounded-xl border border-dark-700/30">
          <div className="text-left flex-1">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Bring your old dusty side-projects into the{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-blue-500">
                Agentic Era
              </span>
              … 🚀
            </h2>
            <p className="text-gray-400 text-xs flex items-center gap-1.5 mt-1">
              <Sparkles className="w-3 h-3 text-brand-400" />
              Autonomous refactoring from legacy frameworks to modern
              architecture that Coding LLMs love.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex shrink-0">
            <div className="bg-dark-800 p-0.5 rounded-lg border border-dark-700 inline-flex shadow-sm">
              <button
                onClick={() => setMode('repo')}
                className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300
                            ${
                              mode === 'repo'
                                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/50'
                                : 'text-gray-400 hover:text-white hover:bg-dark-700'
                            }
                        `}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Repo DustOff
              </button>
              <button
                onClick={() => setMode('snippet')}
                className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300
                            ${
                              mode === 'snippet'
                                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/50'
                                : 'text-gray-400 hover:text-white hover:bg-dark-700'
                            }
                        `}
              >
                <Code2 className="w-3.5 h-3.5" />
                Snippet Mode
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
          {mode === 'snippet' ? <SnippetMigration /> : <RepoMigration />}
        </div>

        {/* Footer */}
        <footer className="text-center py-1 text-[10px] text-gray-600 font-mono shrink-0 select-none">
          Crafted in{' '}
          <a
            href="https://en.wikipedia.org/wiki/Copenhagen"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-brand-400 transition-colors border-b border-transparent hover:border-brand-400/50"
          >
            Copenhagen
          </a>{' '}
          with{' '}
          <a
            href="https://github.com/features/copilot/cli"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-blue-400 transition-colors border-b border-transparent hover:border-blue-400/50"
          >
            GitHub Copilot CLI
          </a>{' '}
          for{' '}
          <a
            href="https://dev.to/challenges/github-2026-01-21"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-purple-400 transition-colors border-b border-transparent hover:border-purple-400/50"
          >
            GitHub Copilot CLI Challenge
          </a>
          .
        </footer>
      </main>
    </div>
  );
};

export default App;

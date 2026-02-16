import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import SnippetMigration from './components/SnippetMigration';
import RepoMigration from './components/RepoMigration';
import { Code2, GitBranch, Sparkles } from 'lucide-react';

const CODE_RAIN_CHARS = [
  'jQuery',
  '$.ajax',
  'var ',
  'require(',
  'module.exports',
  'componentWillMount',
  'class App',
  'this.setState',
  'React.createClass',
  'mixins:',
  'callback(',
  '.done(',
  'Backbone.',
  'angular.module',
  '$scope.',
  'grunt.',
  'gulp.',
];

type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'dustoff-theme';
const hasConfiguredGeminiApiKey = Boolean(__DUSTOFF_GEMINI_API_KEY__.trim());

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const persisted = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (persisted === 'dark' || persisted === 'light') {
    return persisted;
  }

  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  return 'dark';
};

const App: React.FC = () => {
  const [mode, setMode] = useState<'snippet' | 'repo'>('repo');
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((previousTheme) => (previousTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="h-screen flex flex-col font-sans selection:bg-accent-500/30 overflow-hidden bg-dark-900 relative">
      {/* Code Rain — fixed full-page background */}
      <div
        className="fixed inset-0 overflow-hidden opacity-[0.04] pointer-events-none select-none z-0"
        aria-hidden="true"
      >
        <div className="absolute inset-0 flex justify-around font-mono text-[10px] text-accent-400 leading-relaxed whitespace-nowrap">
          {Array.from({ length: 20 }).map((_, col) => (
            <div
              key={col}
              className="flex flex-col gap-1 shrink-0"
              style={{
                animation: `codeRainFall ${14 + (col % 7) * 3}s linear infinite`,
                animationDelay: `${col * -1.2}s`,
              }}
            >
              {/* Repeat chars enough times to fill tall screens */}
              {Array.from({ length: 6 }).flatMap((_, rep) =>
                CODE_RAIN_CHARS.map((char, i) => (
                  <span key={`${rep}-${i}`}>{char}</span>
                )),
              )}
            </div>
          ))}
        </div>
      </div>

      <Header theme={theme} onToggleTheme={toggleTheme} />

      <main className="relative z-10 flex-1 w-full max-w-[1600px] mx-auto px-4 py-4 flex flex-col gap-4 min-h-0">
        {!hasConfiguredGeminiApiKey && (
          <div
            role="alert"
            className="shrink-0 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          >
            <span className="font-semibold">
              Add your Gemini API key to get started.
            </span>{' '}
            Create <code className="font-mono">.env.local</code> with{' '}
            <code className="font-mono">GEMINI_API_KEY=your_api_key_here</code>.
          </div>
        )}

        {/* Hero Section */}
        <div className="relative shrink-0 animate-in fade-in slide-in-from-top-4 duration-700 rounded-xl border border-dark-700/30 overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 bg-dark-800 p-4">
            <div className="text-left flex-1">
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 font-display">
                <span className="text-foreground-primary">
                  Dust off your legacy code.
                </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-accent-600">
                  Ship modern.
                </span>
              </h2>
              <p className="text-foreground-muted text-xs flex items-center gap-1.5 mt-1">
                <Sparkles className="w-3 h-3 text-accent-400" />
                Autonomous refactoring from legacy frameworks to modern
                architecture that Coding LLMs love.
              </p>

              {/* Visual Metaphor: Old → New */}
              <div className="flex items-center gap-3 mt-3">
                <span
                  className="font-mono text-[11px] text-foreground-subtle line-through opacity-60"
                  style={{ filter: 'sepia(0.8) brightness(0.7)' }}
                >
                  {'<'}div onClick={'{'}handler{'}'}
                  {'>'}
                </span>
                <span className="text-accent-500 text-xs font-bold tracking-widest">
                  →
                </span>
                <span className="font-mono text-[11px] text-accent-400/90">
                  {'<'}Button onClick={'{'}handler{'}'} {'/'}
                  {'>'} ✨
                </span>
              </div>
            </div>

            {/* Mode Switcher with Sliding Indicator */}
            <div className="flex shrink-0">
              <div className="relative bg-dark-800 p-0.5 rounded-lg border border-dark-700 inline-flex shadow-sm">
                {/* Sliding background indicator */}
                <div
                  className="mode-slider absolute top-0.5 bottom-0.5 rounded-md bg-accent-600 shadow-md shadow-accent-900/50"
                  style={{
                    width: 'calc(50% - 2px)',
                    transform:
                      mode === 'repo'
                        ? 'translateX(2px)'
                        : 'translateX(calc(100% + 2px))',
                  }}
                />
                <button
                  onClick={() => setMode('repo')}
                  className={`
                    relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-300
                    ${mode === 'repo' ? 'text-white' : 'text-foreground-subtle hover:text-foreground-muted'}
                  `}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  Repo DustOff
                </button>
                <button
                  onClick={() => setMode('snippet')}
                  className={`
                    relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-300
                    ${mode === 'snippet' ? 'text-white' : 'text-foreground-subtle hover:text-foreground-muted'}
                  `}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Snippet Mode
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
          {mode === 'snippet' ? <SnippetMigration /> : <RepoMigration />}
        </div>

        {/* Footer */}
        <footer className="text-center py-1 text-[10px] text-foreground-subtle font-mono shrink-0 select-none">
          Crafted in{' '}
          <a
            href="https://en.wikipedia.org/wiki/Copenhagen"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground-subtle hover:text-accent-400 transition-colors border-b border-transparent hover:border-accent-400/50"
          >
            Copenhagen
          </a>{' '}
          with{' '}
          <a
            href="https://github.com/features/copilot/cli"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground-subtle hover:text-accent-400 transition-colors border-b border-transparent hover:border-accent-400/50"
          >
            GitHub Copilot CLI
          </a>{' '}
          for{' '}
          <a
            href="https://dev.to/challenges/github-2026-01-21"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground-subtle hover:text-accent-400 transition-colors border-b border-transparent hover:border-accent-400/50"
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

import React, { useState } from 'react';
import { Bot, Terminal, HelpCircle, BookOpen, Moon, Sun } from 'lucide-react';
import InfoModal from './InfoModal';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, onToggleTheme }) => {
  const [infoModal, setInfoModal] = useState<'about' | 'how-it-works' | null>(
    null,
  );

  return (
    <>
      <header className="border-b border-dark-700 bg-dark-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-accent-500 blur-lg opacity-20 animate-pulse"></div>
              <div className="bg-accent-500/10 p-2 rounded-lg border border-accent-500/20 relative">
                <Bot className="w-6 h-6 text-accent-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold font-display bg-gradient-to-r from-foreground-primary to-foreground-muted bg-clip-text text-transparent">
                DustOff
              </h1>
              <p className="text-xs text-accent-500/70 font-mono tracking-wider">
                AUTONOMOUS MIGRATION AGENT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onToggleTheme}
              className="relative h-10 w-[82px] rounded-full border border-dark-600 bg-dark-800/80 p-1 transition-colors hover:border-accent-500/40 shadow-inner"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-400/70">
                <Moon className="w-3.5 h-3.5" />
              </span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-accent-500/70">
                <Sun className="w-3.5 h-3.5" />
              </span>
              <span
                className={`absolute top-1 h-8 w-8 rounded-full border border-dark-600 bg-dark-900 shadow-[0_6px_16px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-out flex items-center justify-center ${
                  theme === 'light' ? 'translate-x-[42px]' : 'translate-x-0'
                }`}
              >
                {theme === 'light' ? (
                  <Sun className="w-4 h-4 text-accent-500" />
                ) : (
                  <Moon className="w-4 h-4 text-blue-400" />
                )}
              </span>
            </button>

            <nav className="hidden md:flex items-center gap-1 bg-dark-800/50 p-1 rounded-lg border border-dark-700/50">
              <button
                onClick={() => setInfoModal('about')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground-muted hover:text-accent-400 hover:bg-dark-700 rounded-md transition-all"
              >
                <HelpCircle className="w-4 h-4" />
                <span>What is this?</span>
              </button>
              <div className="w-px h-4 bg-dark-700"></div>
              <button
                onClick={() => setInfoModal('how-it-works')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground-muted hover:text-accent-400 hover:bg-dark-700 rounded-md transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>How it Works</span>
              </button>
            </nav>

            <div className="hidden lg:flex items-center gap-2 text-sm text-accent-500/60 border-l border-dark-700 pl-6">
              <Terminal className="w-4 h-4" />
              <span className="font-mono">v2.1.0-beta</span>
            </div>
          </div>
        </div>
      </header>

      <InfoModal type={infoModal} onClose={() => setInfoModal(null)} />
    </>
  );
};

export default Header;

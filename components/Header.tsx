import React, { useState } from 'react';
import { Bot, Terminal, HelpCircle, BookOpen } from 'lucide-react';
import InfoModal from './InfoModal';

const Header: React.FC = () => {
  const [infoModal, setInfoModal] = useState<'about' | 'how-it-works' | null>(null);

  return (
    <>
      <header className="border-b border-dark-700 bg-dark-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-500 blur-lg opacity-20 animate-pulse"></div>
              <div className="bg-brand-500/10 p-2 rounded-lg border border-brand-500/20 relative">
                <Bot className="w-6 h-6 text-brand-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                DustOff
              </h1>
              <p className="text-xs text-gray-400 font-mono tracking-wider">AUTONOMOUS MIGRATION AGENT</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-1 bg-dark-800/50 p-1 rounded-lg border border-dark-700/50">
              <button
                onClick={() => setInfoModal('about')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-700 rounded-md transition-all"
              >
                <HelpCircle className="w-4 h-4" />
                <span>What is this?</span>
              </button>
              <div className="w-px h-4 bg-dark-700"></div>
              <button
                onClick={() => setInfoModal('how-it-works')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-700 rounded-md transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>How it Works</span>
              </button>
            </nav>

            <div className="hidden lg:flex items-center gap-2 text-sm text-gray-400 border-l border-dark-700 pl-6">
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
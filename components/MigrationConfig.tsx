import React from 'react';
import { MigrationConfig } from '../types';
import {
  Check,
  Grid,
  Layers,
  TestTube,
  Palette,
  Database,
  X,
} from 'lucide-react';

interface MigrationConfigProps {
  config: MigrationConfig;
  onChange: (config: MigrationConfig) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfigOption = ({
  selected,
  onClick,
  label,
  icon: Icon,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  icon: React.ElementType;
  description: string;
}) => (
  <button
    onClick={onClick}
    className={`
      flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left w-full h-full relative overflow-hidden group
      ${
        selected
          ? 'bg-accent-900/20 border-accent-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
          : 'bg-dark-800 border-dark-700 hover:border-dark-600 hover:bg-dark-750'
      }
    `}
  >
    {selected && (
      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center animate-in zoom-in">
        <Check className="w-3 h-3 text-white" strokeWidth={3} />
      </div>
    )}
    <Icon
      className={`w-6 h-6 mb-3 ${selected ? 'text-accent-400' : 'text-gray-500 group-hover:text-gray-400'}`}
    />
    <h3
      className={`font-semibold mb-1 ${selected ? 'text-white' : 'text-gray-300'}`}
    >
      {label}
    </h3>
    <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
  </button>
);

const MigrationConfigModal: React.FC<MigrationConfigProps> = ({
  config,
  onChange,
  onConfirm,
  onCancel,
}) => {
  const updateConfig = (key: keyof MigrationConfig, value: string) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-dark-900 w-full max-w-4xl rounded-2xl border border-dark-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-dark-700 flex items-center justify-between bg-dark-800/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent-400 to-orange-500 font-display">
                Configure Stack
              </span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Customize the architecture for your new Next.js application.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          {/* Section: UI Framework */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-accent-400" />
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                UI Framework
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ConfigOption
                label="Tailwind CSS (Standard)"
                icon={Grid}
                description="Clean, utility-first CSS. Best for custom designs and lightweight builds."
                selected={config.uiFramework === 'tailwind'}
                onClick={() => updateConfig('uiFramework', 'tailwind')}
              />
              <ConfigOption
                label="Shadcn/UI + Tailwind"
                icon={Layout}
                description="Pre-built accessible components. Recommended for modern, consistent UIs."
                selected={config.uiFramework === 'shadcn'}
                onClick={() => updateConfig('uiFramework', 'shadcn')}
              />
            </div>
          </section>

          {/* Section: State Management */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                State Management
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ConfigOption
                label="React Context"
                icon={Layers}
                description="Simple built-in state sharing. Good for small to medium apps."
                selected={config.stateManagement === 'context'}
                onClick={() => updateConfig('stateManagement', 'context')}
              />
              <ConfigOption
                label="Zustand"
                icon={Database}
                description="Small, fast, scalable state management. Great DX and performance."
                selected={config.stateManagement === 'zustand'}
                onClick={() => updateConfig('stateManagement', 'zustand')}
              />
              <ConfigOption
                label="Redux Toolkit"
                icon={Grid}
                description="Robust, opinionated state management. Best for complex enterprise apps."
                selected={config.stateManagement === 'redux'}
                onClick={() => updateConfig('stateManagement', 'redux')}
              />
            </div>
          </section>

          {/* Section: Testing Library */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TestTube className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                Testing Strategy
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ConfigOption
                label="Vitest (Recommended)"
                icon={TestTube}
                description="Fast, Vite-native testing framework. Compatible with Jest API."
                selected={config.testingLibrary === 'vitest'}
                onClick={() => updateConfig('testingLibrary', 'vitest')}
              />
              <ConfigOption
                label="Jest"
                icon={TestTube}
                description="Classic, widely adopted testing framework. Good for legacy compatibility."
                selected={config.testingLibrary === 'jest'}
                onClick={() => updateConfig('testingLibrary', 'jest')}
              />
              <ConfigOption
                label="None"
                icon={X}
                description="Skip test generation. Faster migration, but less safe."
                selected={config.testingLibrary === 'none'}
                onClick={() => updateConfig('testingLibrary', 'none')}
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-700 bg-dark-800/50 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-accent-600 hover:bg-accent-500 text-white font-bold rounded-lg shadow-lg shadow-accent-900/20 transition-all transform hover:scale-105"
          >
            Start Migration
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper icon
const Layout = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

export default MigrationConfigModal;

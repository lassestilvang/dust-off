import React from 'react';
import { FileNode } from '../types';
import { 
  Folder, FileCode, ChevronRight, ChevronDown, CheckCircle, Loader2, AlertCircle, 
  Database, Layout, FileJson, FileType, FileImage, Settings, Package, FileText, 
  Code2, Braces, Globe, Palette, FileDigit, Box, Coffee 
} from 'lucide-react';
import { ReactIcon, TypeScriptIcon, JavaScriptIcon, NextjsIcon, PythonIcon, ViteIcon, VueIcon, PhpIcon } from './Icons';

interface FileExplorerProps {
  files: FileNode[];
  onSelectFile: (path: string) => void;
  selectedFile: string | null;
  activeTree: 'source' | 'target';
  onToggleTree: (mode: 'source' | 'target') => void;
}

const getFileIconConfig = (filename: string) => {
  const name = filename.toLowerCase();
  
  // Specific filenames
  if (name === 'package.json') return { icon: Package, color: 'text-red-400' };
  if (name === 'tsconfig.json') return { icon: TypeScriptIcon, color: 'text-blue-500' };
  if (name.includes('vite.config')) return { icon: ViteIcon, color: 'text-purple-400' };
  if (name.includes('next.config')) return { icon: NextjsIcon, color: 'text-white' };
  if (name.includes('readme')) return { icon: FileText, color: 'text-gray-300' };
  if (name.includes('docker')) return { icon: Box, color: 'text-blue-500' };
  if (name.startsWith('.env')) return { icon: Settings, color: 'text-yellow-500' };
  
  // Extensions
  if (name.endsWith('.tsx')) return { icon: ReactIcon, color: 'text-blue-400' };
  if (name.endsWith('.ts')) return { icon: TypeScriptIcon, color: 'text-blue-500' };
  if (name.endsWith('.jsx')) return { icon: ReactIcon, color: 'text-yellow-400' };
  if (name.endsWith('.js')) return { icon: JavaScriptIcon, color: 'text-yellow-400' };
  if (name.endsWith('.vue')) return { icon: VueIcon, color: 'text-green-400' };
  if (name.endsWith('.php')) return { icon: PhpIcon, color: 'text-indigo-400' };
  if (name.endsWith('.css') || name.endsWith('.scss')) return { icon: Palette, color: 'text-pink-400' };
  if (name.endsWith('.html')) return { icon: Globe, color: 'text-orange-500' };
  if (name.endsWith('.json')) return { icon: Braces, color: 'text-yellow-600' };
  if (name.endsWith('.md')) return { icon: FileText, color: 'text-gray-400' };
  if (name.endsWith('.py')) return { icon: PythonIcon, color: 'text-blue-300' };
  if (name.endsWith('.java')) return { icon: Coffee, color: 'text-red-500' };
  if (name.match(/\.(png|jpg|jpeg|svg|ico|gif)$/)) return { icon: FileImage, color: 'text-purple-400' };
  
  return { icon: FileType, color: 'text-gray-500' };
};

const FileItem: React.FC<{ 
  node: FileNode; 
  depth: number; 
  onSelect: (path: string) => void;
  selected: boolean;
}> = ({ node, depth, onSelect, selected }) => {
  const [isOpen, setIsOpen] = React.useState(true);

  // Styling constants
  const baseIndent = 12; // Base padding
  const depthIndent = 14; // Pixels per depth level

  // Calculated indent style for the content container
  const rowStyle = { paddingLeft: `${baseIndent + (depth * depthIndent)}px` };

  if (node.type === 'dir') {
    return (
      <div>
        <div 
          className="flex items-center gap-1 py-1.5 pr-2 hover:bg-dark-800 cursor-pointer text-gray-400 transition-colors select-none group"
          style={rowStyle}
          onClick={() => setIsOpen(!isOpen)}
        >
          {/* Chevron container to ensure alignment */}
          <span className="w-4 h-4 flex items-center justify-center shrink-0 text-gray-500 group-hover:text-gray-300">
             {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          
          <Folder className="w-4 h-4 text-blue-400/80 group-hover:text-blue-400 shrink-0 mr-1.5 fill-blue-500/10" />
          <span className="text-xs font-medium truncate group-hover:text-gray-300 transition-colors">{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div>
            {node.children.map(child => (
              <FileItem 
                key={child.path} 
                node={child} 
                depth={depth + 1} 
                onSelect={onSelect}
                selected={selected}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const { icon: Icon, color } = getFileIconConfig(node.name);

  return (
    <div 
      className={`
        flex items-center py-1.5 pr-2 cursor-pointer transition-all border-l-2 gap-1 group relative overflow-hidden
        ${selected ? 'bg-brand-900/20 border-brand-500 text-brand-100' : 'border-transparent hover:bg-dark-800 text-gray-400'}
      `}
      style={rowStyle}
      onClick={() => onSelect(node.path)}
    >
      {selected && <div className="absolute inset-0 bg-brand-500/5 pointer-events-none" />}

      {/* Spacer to align with chevron */}
      <span className="w-4 h-4 shrink-0" />
      
      <Icon className={`w-4 h-4 shrink-0 mr-1.5 ${selected ? color : `${color} opacity-70 group-hover:opacity-100`}`} />
      
      <span className={`text-xs truncate flex-1 transition-colors ${selected ? 'font-medium' : 'font-normal'}`}>{node.name}</span>
      
      {/* Status Icons aligned to right */}
      {node.status === 'migrating' && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400 shrink-0" />}
      {node.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
      {node.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
    </div>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ files, onSelectFile, selectedFile, activeTree, onToggleTree }) => {
  return (
    <div className="h-full flex flex-col bg-dark-900 rounded-xl border border-dark-700 overflow-hidden shadow-inner">
      <div className="px-2 py-2 border-b border-dark-700 bg-dark-900 flex gap-1">
        <button
          onClick={() => onToggleTree('source')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${
            activeTree === 'source' ? 'bg-dark-800 text-white shadow-sm ring-1 ring-dark-700' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-800/50'
          }`}
        >
          <Database className={`w-3.5 h-3.5 ${activeTree === 'source' ? 'text-blue-400' : 'text-gray-500'}`} />
          Legacy
        </button>
        <button
          onClick={() => onToggleTree('target')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${
            activeTree === 'target' ? 'bg-brand-900/20 text-brand-400 border border-brand-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-800/50'
          }`}
        >
          <Layout className={`w-3.5 h-3.5 ${activeTree === 'target' ? 'text-brand-400' : 'text-gray-500'}`} />
          Next.js
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-gray-600">
            {activeTree === 'source' ? (
               <>
                 <Database className="w-8 h-8 mb-2 opacity-20" />
                 <p className="text-xs italic">Load a repository to view source files</p>
               </>
            ) : (
               <>
                 <Layout className="w-8 h-8 mb-2 opacity-20" />
                 <p className="text-xs italic">Project structure pending...</p>
               </>
            )}
          </div>
        ) : (
          files.map(node => (
            <FileItem 
              key={node.path} 
              node={node} 
              depth={0} 
              onSelect={onSelectFile}
              selected={selectedFile === node.path}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
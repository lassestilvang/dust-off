import React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import { FileType, FileText, Braces, Palette } from 'lucide-react';
import { ReactIcon, TypeScriptIcon, JavaScriptIcon, PythonIcon } from './Icons';

interface CodeEditorProps {
  title: string;
  code: string;
  onChange?: (val: string) => void;
  language: string;
  readOnly?: boolean;
  highlight?: boolean; // This refers to the border glow effect
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  title,
  code,
  onChange,
  language,
  readOnly = false,
  highlight = false,
}) => {
  const normalizeLanguage = (lang: string) => {
    const lower = lang.toLowerCase();
    const map: Record<string, string> = {
      python2: 'python',
      python3: 'python',
      react: 'tsx',
      nextjs: 'tsx',
      vue2: 'javascript', // basic fallback
      vue3: 'javascript',
      angular: 'typescript',
      jquery: 'javascript',
      astro: 'typescript',
      js: 'javascript',
      ts: 'typescript',
      shell: 'bash',
    };
    return map[lower] || lower;
  };

  const highlightCode = (code: string) => {
    const normLang = normalizeLanguage(language);
    const grammar = Prism.languages[normLang] || Prism.languages.javascript;
    return Prism.highlight(code, grammar, normLang);
  };

  const getHeaderIcon = () => {
    const name = title.toLowerCase();
    if (name.includes('json'))
      return <Braces className="w-4 h-4 text-yellow-500" />;
    if (name.includes('css'))
      return <Palette className="w-4 h-4 text-pink-400" />;
    if (name.includes('md'))
      return <FileText className="w-4 h-4 text-gray-400" />;
    if (name.includes('tsx') || name.includes('jsx'))
      return <ReactIcon className="w-4 h-4 text-blue-400" />;
    if (name.endsWith('.ts'))
      return <TypeScriptIcon className="w-4 h-4 text-blue-500" />;
    if (name.endsWith('.js'))
      return <JavaScriptIcon className="w-4 h-4 text-yellow-400" />;
    if (name.endsWith('.py'))
      return <PythonIcon className="w-4 h-4 text-blue-300" />;
    return <FileType className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div
      className={`flex flex-col h-full rounded-xl overflow-hidden border transition-all duration-300 ${highlight ? 'border-brand-500/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'border-dark-700'}`}
    >
      <div className="bg-dark-900 px-4 py-2 border-b border-dark-700 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          {getHeaderIcon()}
          <span className="text-sm font-semibold text-gray-300">{title}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-dark-700 text-gray-400 font-mono uppercase">
          {language}
        </span>
      </div>
      <div className="relative flex-1 bg-dark-800 overflow-y-auto">
        <Editor
          value={code}
          onValueChange={(code) => !readOnly && onChange?.(code)}
          highlight={highlightCode}
          padding={16}
          disabled={readOnly}
          className="prism-editor"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 14,
            minHeight: '100%',
          }}
          textareaClassName="focus:outline-none"
        />
        {!code && !readOnly && (
          <div className="absolute top-4 left-4 text-gray-600 pointer-events-none font-mono text-sm">
            // Paste your code here...
          </div>
        )}
        {!code && readOnly && (
          <div className="absolute top-4 left-4 text-gray-600 pointer-events-none font-mono text-sm">
            // Waiting for output...
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeEditor;

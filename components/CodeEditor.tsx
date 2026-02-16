import React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import { FileType, FileText, Braces, Palette } from 'lucide-react';
import { ReactIcon, TypeScriptIcon, JavaScriptIcon, PythonIcon } from './Icons';
import { ensurePrismLanguage } from '../services/prismLanguageLoader';

interface CodeEditorProps {
  title: string;
  code: string;
  onChange?: (val: string) => void;
  language: string;
  readOnly?: boolean;
  highlight?: boolean; // This refers to the border glow effect
}

const normalizeLanguage = (lang: string): string => {
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

const CodeEditor: React.FC<CodeEditorProps> = ({
  title,
  code,
  onChange,
  language,
  readOnly = false,
  highlight = false,
}) => {
  const normalizedLanguage = React.useMemo(
    () => normalizeLanguage(language),
    [language],
  );
  const [, setGrammarVersion] = React.useState(0);

  React.useEffect(() => {
    let isCancelled = false;

    const loadLanguage = async () => {
      try {
        await ensurePrismLanguage(normalizedLanguage);
        if (!isCancelled) {
          setGrammarVersion((version) => version + 1);
        }
      } catch (error) {
        console.error(
          `Failed to load Prism language '${normalizedLanguage}'.`,
          error,
        );
      }
    };

    void loadLanguage();

    return () => {
      isCancelled = true;
    };
  }, [normalizedLanguage]);

  const highlightCode = (code: string) => {
    const grammar =
      Prism.languages[normalizedLanguage] || Prism.languages.javascript;
    return Prism.highlight(code, grammar, normalizedLanguage);
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
      className={`flex flex-col h-full rounded-xl overflow-hidden border transition-all duration-300 ${highlight ? 'border-accent-500/50 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'border-dark-700'}`}
    >
      <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-700/80 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          {getHeaderIcon()}
          <span className="text-sm font-semibold text-slate-200">{title}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono uppercase">
          {language}
        </span>
      </div>
      <div className="relative flex-1 bg-slate-950 overflow-y-auto">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-slate-600/60 mb-3">
              <span className="font-mono text-3xl font-light tracking-wider">
                &lt;/&gt;
              </span>
            </div>
            <span className="text-slate-500 font-mono text-sm">
              // Paste your legacy code here...
            </span>
          </div>
        )}
        {!code && readOnly && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-slate-600/40 mb-3">
              <span className="font-mono text-2xl tracking-wider opacity-60">
                ▸ _
              </span>
            </div>
            <span className="text-slate-500 font-mono text-sm">
              // Awaiting generation...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeEditor;

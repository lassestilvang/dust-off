import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal } from 'lucide-react';

interface AgentLogsProps {
  logs: LogEntry[];
}

const AgentLogs: React.FC<AgentLogsProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden flex flex-col h-full">
      <div className="bg-dark-900/80 px-4 py-2 border-b border-dark-700 flex items-center gap-2 shrink-0">
        <Terminal className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-mono text-gray-400 uppercase">
          Agent Process Stream
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2"
      >
        {logs.length === 0 && (
          <div className="text-gray-600 italic">Waiting for input...</div>
        )}
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300"
          >
            <span className="text-dark-500 shrink-0 select-none">
              {log.timestamp.toLocaleTimeString(
                [],
                {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  third: '2-digit',
                }.replace('third', 'second'),
              )}
            </span>
            <div className="flex-1 break-words">
              <span
                className={`
                ${log.type === 'info' ? 'text-blue-400' : ''}
                ${log.type === 'success' ? 'text-brand-400' : ''}
                ${log.type === 'warning' ? 'text-yellow-400' : ''}
                ${log.type === 'error' ? 'text-red-400' : ''}
              `}
              >
                [{log.step}]
              </span>{' '}
              <span className="text-gray-300">{log.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentLogs;

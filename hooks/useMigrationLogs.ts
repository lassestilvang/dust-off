import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AgentStatus, LogEntry } from '../types';

interface UseMigrationLogsInput {
  appendLog: (entry: LogEntry) => void;
  getCurrentStep: () => AgentStatus;
}

export const useMigrationLogs = ({
  appendLog,
  getCurrentStep,
}: UseMigrationLogsInput) => {
  const addLog = useCallback(
    (
      message: string,
      type: LogEntry['type'] = 'info',
      step?: AgentStatus,
    ): void => {
      appendLog({
        id: uuidv4(),
        timestamp: new Date(),
        step: step ?? getCurrentStep(),
        message,
        type,
      });
    },
    [appendLog, getCurrentStep],
  );

  return { addLog };
};

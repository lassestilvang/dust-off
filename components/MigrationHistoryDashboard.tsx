import React from 'react';
import { BarChart3, Clock3, Coins, Gauge, Trash2 } from 'lucide-react';
import { MigrationHistoryEntry } from '../types';

interface MigrationHistoryDashboardProps {
  history: MigrationHistoryEntry[];
  onClearHistory: () => void;
}

const formatSigned = (value: number, suffix = ''): string => {
  if (value === 0) {
    return `0${suffix}`;
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
};

const MigrationHistoryDashboard: React.FC<MigrationHistoryDashboardProps> = ({
  history,
  onClearHistory,
}) => {
  const sortedHistory = React.useMemo(
    () => [...history].sort((a, b) => b.timestamp - a.timestamp),
    [history],
  );

  const [leftRunId, setLeftRunId] = React.useState<string>('');
  const [rightRunId, setRightRunId] = React.useState<string>('');

  React.useEffect(() => {
    if (sortedHistory.length === 0) {
      setLeftRunId('');
      setRightRunId('');
      return;
    }

    const newest = sortedHistory[0];
    const previous = sortedHistory[1] || sortedHistory[0];

    if (!leftRunId || !sortedHistory.find((entry) => entry.id === leftRunId)) {
      setLeftRunId(newest.id);
    }
    if (
      !rightRunId ||
      !sortedHistory.find((entry) => entry.id === rightRunId)
    ) {
      setRightRunId(previous.id);
    }
  }, [leftRunId, rightRunId, sortedHistory]);

  if (sortedHistory.length === 0) {
    return null;
  }

  const leftRun =
    sortedHistory.find((entry) => entry.id === leftRunId) || sortedHistory[0];
  const rightRun =
    sortedHistory.find((entry) => entry.id === rightRunId) ||
    sortedHistory[1] ||
    sortedHistory[0];

  const scoreDelta = leftRun.modernizationScore - rightRun.modernizationScore;
  const durationDelta = leftRun.durationSeconds - rightRun.durationSeconds;
  const costDelta = leftRun.estimatedCostUsd - rightRun.estimatedCostUsd;

  return (
    <section className="rounded-xl border border-dark-700 bg-dark-800 p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground-primary uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          Migration History
        </h3>
        <button
          onClick={onClearHistory}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-dark-600 bg-dark-900 text-gray-300 hover:bg-dark-700"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col gap-1 text-gray-400">
          Compare run A
          <select
            value={leftRun.id}
            onChange={(event) => setLeftRunId(event.target.value)}
            className="bg-dark-900 border border-dark-700 rounded-md px-2 py-1 text-gray-100"
          >
            {sortedHistory.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {new Date(entry.timestamp).toLocaleString()} ·{' '}
                {entry.sourceFramework}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-gray-400">
          Compare run B
          <select
            value={rightRun.id}
            onChange={(event) => setRightRunId(event.target.value)}
            className="bg-dark-900 border border-dark-700 rounded-md px-2 py-1 text-gray-100"
          >
            {sortedHistory.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {new Date(entry.timestamp).toLocaleString()} ·{' '}
                {entry.sourceFramework}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-dark-700 bg-dark-900 px-3 py-2">
          <p className="text-gray-400 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-green-300" />
            Modernization Score
          </p>
          <p className="text-gray-100 font-semibold mt-1">
            {leftRun.modernizationScore} vs {rightRun.modernizationScore}
          </p>
          <p
            className={
              scoreDelta >= 0 ? 'text-green-300 mt-1' : 'text-red-300 mt-1'
            }
          >
            {formatSigned(scoreDelta, ' pts')}
          </p>
        </div>
        <div className="rounded-lg border border-dark-700 bg-dark-900 px-3 py-2">
          <p className="text-gray-400 flex items-center gap-1.5">
            <Clock3 className="w-3.5 h-3.5 text-blue-300" />
            Duration
          </p>
          <p className="text-gray-100 font-semibold mt-1">
            {leftRun.durationSeconds}s vs {rightRun.durationSeconds}s
          </p>
          <p
            className={
              durationDelta <= 0
                ? 'text-green-300 mt-1'
                : 'text-yellow-200 mt-1'
            }
          >
            {formatSigned(durationDelta, 's')}
          </p>
        </div>
        <div className="rounded-lg border border-dark-700 bg-dark-900 px-3 py-2">
          <p className="text-gray-400 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-300" />
            Estimated Cost
          </p>
          <p className="text-gray-100 font-semibold mt-1">
            ${leftRun.estimatedCostUsd.toFixed(4)} vs $
            {rightRun.estimatedCostUsd.toFixed(4)}
          </p>
          <p
            className={
              costDelta <= 0 ? 'text-green-300 mt-1' : 'text-yellow-200 mt-1'
            }
          >
            {formatSigned(Number(costDelta.toFixed(4)), ' USD')}
          </p>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs text-left border-separate border-spacing-y-1">
          <thead>
            <tr className="text-gray-400">
              <th className="font-semibold px-2">Date</th>
              <th className="font-semibold px-2">Repo</th>
              <th className="font-semibold px-2">Score</th>
              <th className="font-semibold px-2">Duration</th>
              <th className="font-semibold px-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.slice(0, 10).map((entry) => (
              <tr key={entry.id} className="bg-dark-900 border border-dark-700">
                <td className="px-2 py-1 text-gray-300">
                  {new Date(entry.timestamp).toLocaleString()}
                </td>
                <td className="px-2 py-1 text-gray-300 font-mono truncate max-w-[220px]">
                  {entry.repoUrl}
                </td>
                <td className="px-2 py-1 text-gray-100">
                  {entry.modernizationScore}
                </td>
                <td className="px-2 py-1 text-gray-100">
                  {entry.durationSeconds}s
                </td>
                <td className="px-2 py-1 text-gray-100">
                  ${entry.estimatedCostUsd.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MigrationHistoryDashboard;

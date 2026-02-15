import { render, screen, fireEvent } from '@testing-library/react';
import MigrationReportModal from './MigrationReportModal';

describe('MigrationReportModal', () => {
  const report = {
    duration: '00:03:12',
    totalFiles: 48,
    filesGenerated: 29,
    modernizationScore: 88,
    typeScriptCoverage: 100,
    testCoverage: 74,
    testsGenerated: 11,
    techStackChanges: [
      { from: 'React Router', to: 'Next.js App Router' },
      { from: 'CSS Modules', to: 'Tailwind CSS' },
    ],
    keyImprovements: [
      'Converted class components to server-first architecture',
      'Consolidated API calls into route handlers',
    ],
    newDependencies: 4,
  };

  it('renders report metrics and transformations', () => {
    render(
      <MigrationReportModal
        report={report}
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.getByText('Migration Accomplished')).toBeInTheDocument();
    expect(screen.getByText('Duration: 00:03:12')).toBeInTheDocument();
    expect(screen.getByText('29 Files Generated')).toBeInTheDocument();
    expect(screen.getByText('React Router')).toBeInTheDocument();
    expect(screen.getByText('Next.js App Router')).toBeInTheDocument();
    expect(
      screen.getByText('Consolidated API calls into route handlers'),
    ).toBeInTheDocument();
  });

  it('calls close and download actions', () => {
    const onClose = vi.fn();
    const onDownload = vi.fn();

    render(
      <MigrationReportModal
        report={report}
        onClose={onClose}
        onDownload={onDownload}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Review Code/i }));
    fireEvent.click(screen.getByRole('button', { name: /Download Project/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});

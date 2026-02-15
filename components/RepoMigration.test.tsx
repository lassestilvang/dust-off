import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RepoMigration from './RepoMigration';

const {
  mockValidateGeminiApiKey,
  mockRunAnalyzePhase,
  mockRunScaffoldPhase,
  mockRunGeneratePhase,
  mockRunVerificationPhase,
  mockGenerateReport,
} = vi.hoisted(() => ({
  mockValidateGeminiApiKey: vi.fn(),
  mockRunAnalyzePhase: vi.fn(),
  mockRunScaffoldPhase: vi.fn(),
  mockRunGeneratePhase: vi.fn(),
  mockRunVerificationPhase: vi.fn(),
  mockGenerateReport: vi.fn(),
}));

vi.mock('../services/geminiService', () => ({
  validateGeminiApiKey: mockValidateGeminiApiKey,
}));

vi.mock('react-simple-code-editor', () => ({
  default: ({
    value,
    onValueChange,
    className,
    disabled,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <textarea
      data-testid="code-editor-mock"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      className={className}
      disabled={disabled}
    />
  ),
}));

vi.mock('../services/migrationOrchestrator', () => {
  const flattenFiles = (
    nodes: Array<{
      children?: Array<{ children?: unknown[] }>;
    }> = [],
  ): Array<{ children?: unknown[] }> => {
    const flattened: Array<{ children?: unknown[] }> = [];

    const visit = (entries: Array<{ children?: unknown[] }>) => {
      entries.forEach((entry) => {
        flattened.push(entry);
        if (Array.isArray(entry.children)) {
          visit(entry.children as Array<{ children?: unknown[] }>);
        }
      });
    };

    visit(nodes as Array<{ children?: unknown[] }>);
    return flattened;
  };

  return {
    flattenFiles,
    generateReport: mockGenerateReport,
    isImageFile: (filename: string) =>
      /\.(png|jpg|jpeg|gif|ico|svg|webp|bmp)$/i.test(filename),
    runAnalyzePhase: mockRunAnalyzePhase,
    runScaffoldPhase: mockRunScaffoldPhase,
    runGeneratePhase: mockRunGeneratePhase,
    runVerificationPhase: mockRunVerificationPhase,
  };
});

describe('RepoMigration', () => {
  const analysis = {
    summary: 'Legacy React app with mixed client patterns.',
    complexity: 'Medium' as const,
    dependencies: ['react', 'axios'],
    patterns: ['class components'],
    risks: ['state sprawl'],
    detectedFramework: 'React',
    recommendedTarget: 'Next.js + TypeScript',
    architectureDescription: 'Legacy layered architecture.',
    semanticFileMappings: [],
    migrationNotes: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    mockValidateGeminiApiKey.mockResolvedValue(undefined);
    mockRunAnalyzePhase.mockResolvedValue({
      files: [
        {
          name: 'src',
          path: 'src',
          type: 'dir',
          status: 'pending',
          children: [
            {
              name: 'index.js',
              path: 'src/index.js',
              type: 'file',
              status: 'pending',
            },
          ],
        },
      ],
      analysis,
      diagram: null,
      repoScope: {
        totalFiles: 10,
        filteredFiles: 8,
        analyzedFiles: 8,
        truncated: false,
        availableDirectories: ['src'],
      },
    });

    mockRunScaffoldPhase.mockResolvedValue({
      sourceContext: 'source context',
      fileContents: {},
      filesToRead: [],
      graph: {},
      generatedFilePaths: ['app/page.tsx'],
      generatedFiles: [
        {
          name: 'app',
          path: 'app',
          type: 'dir',
          status: 'pending',
          children: [
            {
              name: 'page.tsx',
              path: 'app/page.tsx',
              type: 'file',
              status: 'pending',
            },
          ],
        },
      ],
    });

    mockRunGeneratePhase.mockImplementation(
      async (input: {
        onFileStart: (path: string) => void;
        onFileChunk: (path: string, content: string) => void;
        onFileGenerated: (path: string, content: string) => void;
      }) => {
        input.onFileStart('app/page.tsx');
        input.onFileChunk('app/page.tsx', 'export default function Page() {');
        input.onFileGenerated(
          'app/page.tsx',
          'export default function Page() { return <main>Hello</main>; }',
        );
      },
    );

    mockRunVerificationPhase.mockResolvedValue({
      passed: true,
      issues: [],
      fixedFilesApplied: 0,
    });

    mockGenerateReport.mockReturnValue({
      duration: '00:00:05',
      totalFiles: 8,
      filesGenerated: 1,
      modernizationScore: 92,
      typeScriptCoverage: 100,
      testCoverage: 70,
      testsGenerated: 2,
      techStackChanges: [{ from: 'React', to: 'Next.js' }],
      keyImprovements: ['App Router structure'],
      newDependencies: 3,
    });
  });

  it('analyzes a repository from the URL input', async () => {
    render(<RepoMigration />);

    fireEvent.change(
      screen.getByPlaceholderText('https://github.com/username/repository'),
      {
        target: { value: 'https://github.com/example-org/legacy-app' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: /Analyze Repo/i }));

    await waitFor(() => {
      expect(mockValidateGeminiApiKey).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockRunAnalyzePhase).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://github.com/example-org/legacy-app',
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText('Legacy React app with mixed client patterns.'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /Re-analyze Repo/i }),
    ).toBeInTheDocument();
  });

  it('runs configure and build after analysis and opens the report', async () => {
    render(<RepoMigration />);

    fireEvent.change(
      screen.getByPlaceholderText('https://github.com/username/repository'),
      {
        target: { value: 'https://github.com/example-org/legacy-app' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /Analyze Repo/i }));

    await waitFor(() => {
      expect(mockRunAnalyzePhase).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Configure & Build/i }));

    expect(screen.getByText('Configure Stack')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Start Migration/i }));

    await waitFor(() => {
      expect(mockRunScaffoldPhase).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockRunGeneratePhase).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockRunVerificationPhase).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Migration Accomplished')).toBeInTheDocument();
    });

    expect(mockGenerateReport).toHaveBeenCalledTimes(1);
  });
});

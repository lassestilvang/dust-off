import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SnippetMigration from './SnippetMigration';

const {
  mockAnalyzeCode,
  mockConvertCode,
  mockValidateGeminiApiKey,
  mockVerifyCode,
} = vi.hoisted(() => ({
  mockAnalyzeCode: vi.fn(),
  mockConvertCode: vi.fn(),
  mockValidateGeminiApiKey: vi.fn(),
  mockVerifyCode: vi.fn(),
}));

vi.mock('../services/geminiService', () => ({
  analyzeCode: mockAnalyzeCode,
  convertCode: mockConvertCode,
  validateGeminiApiKey: mockValidateGeminiApiKey,
  verifyCode: mockVerifyCode,
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

describe('SnippetMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockValidateGeminiApiKey.mockResolvedValue(undefined);
    mockAnalyzeCode.mockResolvedValue({
      summary: 'Detected legacy jQuery callbacks.',
      complexity: 'Medium',
      dependencies: ['jquery'],
      patterns: ['callback hell'],
      risks: ['Global mutable state'],
    });
    mockConvertCode.mockResolvedValue(
      'export default function App() { return null; }',
    );
    mockVerifyCode.mockResolvedValue({
      passed: true,
      issues: [],
    });
  });

  it('runs a complete snippet migration flow', async () => {
    render(<SnippetMigration />);

    fireEvent.click(
      screen.getByRole('button', { name: /INITIATE MIGRATION/i }),
    );

    await waitFor(() => {
      expect(mockValidateGeminiApiKey).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockAnalyzeCode).toHaveBeenCalledTimes(1);
    });

    await waitFor(
      () => {
        expect(mockConvertCode).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 },
    );

    await waitFor(() => {
      expect(mockVerifyCode).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByDisplayValue(
        'export default function App() { return null; }',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Verification passed/i).length).toBeGreaterThan(
      0,
    );
  });

  it('stops early when source code is empty', async () => {
    render(<SnippetMigration />);

    const editors = screen.getAllByTestId('code-editor-mock');
    fireEvent.change(editors[0], { target: { value: '   ' } });

    fireEvent.click(
      screen.getByRole('button', { name: /INITIATE MIGRATION/i }),
    );

    await waitFor(() => {
      expect(
        screen.getAllByText('Source code is empty. Aborting.').length,
      ).toBeGreaterThan(0);
    });

    expect(mockValidateGeminiApiKey).not.toHaveBeenCalled();
    expect(mockAnalyzeCode).not.toHaveBeenCalled();
  });
});

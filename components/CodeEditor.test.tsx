import { render, screen } from '@testing-library/react';
import CodeEditor from './CodeEditor';

// Mock react-simple-code-editor as it relies on refs/DOM that might be tricky in JSDOM or just simpler to mock
vi.mock('react-simple-code-editor', () => {
    return {
        default: ({ value, onValueChange, className }: any) => (
            <textarea
                data-testid="code-editor-mock"
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                className={className}
            />
        )
    }
});

describe('CodeEditor', () => {
    it('renders with title and language', () => {
        render(
            <CodeEditor
                title="test.ts"
                code="const a = 1;"
                language="typescript"
            />
        );

        expect(screen.getByText('test.ts')).toBeInTheDocument();
        expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('displays code in editor', () => {
        render(
            <CodeEditor
                title="test.ts"
                code="const a = 1;"
                language="typescript"
            />
        );

        expect(screen.getByTestId('code-editor-mock')).toHaveValue('const a = 1;');
    });
});

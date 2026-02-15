import { render, screen, fireEvent } from '@testing-library/react';
import FileExplorer from './FileExplorer';
import { FileNode } from '../types';

const mockFiles: FileNode[] = [
    {
        name: 'src',
        path: 'src',
        type: 'dir',
        status: 'pending',
        children: [
            {
                name: 'index.ts',
                path: 'src/index.ts',
                type: 'file',
                status: 'pending',
            }
        ]
    },
    {
        name: 'README.md',
        path: 'README.md',
        type: 'file',
        status: 'pending',
    }
];

describe('FileExplorer', () => {
    const mockOnSelectFile = vi.fn();
    const mockOnToggleTree = vi.fn();

    it('renders files and directories', () => {
        render(
            <FileExplorer
                files={mockFiles}
                onSelectFile={mockOnSelectFile}
                selectedFile={null}
                activeTree="source"
                onToggleTree={mockOnToggleTree}
            />
        );

        expect(screen.getByText('src')).toBeInTheDocument();
        expect(screen.getByText('README.md')).toBeInTheDocument();
        // Initially open? Component defaults isOpen=true for FileItem
        expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    it('handles file selection', () => {
        render(
            <FileExplorer
                files={mockFiles}
                onSelectFile={mockOnSelectFile}
                selectedFile={null}
                activeTree="source"
                onToggleTree={mockOnToggleTree}
            />
        );

        fireEvent.click(screen.getByText('README.md'));
        expect(mockOnSelectFile).toHaveBeenCalledWith('README.md');
    });

    it('toggles tree view', () => {
        render(
            <FileExplorer
                files={mockFiles}
                onSelectFile={mockOnSelectFile}
                selectedFile={null}
                activeTree="source"
                onToggleTree={mockOnToggleTree}
            />
        );

        fireEvent.click(screen.getByText('Next.js'));
        expect(mockOnToggleTree).toHaveBeenCalledWith('target');
    });

    it('highlights selected file', () => {
        render(
            <FileExplorer
                files={mockFiles}
                onSelectFile={mockOnSelectFile}
                selectedFile="README.md"
                activeTree="source"
                onToggleTree={mockOnToggleTree}
            />
        );
        // We can check for a class that indicates selection
        const readme = screen.getByText('README.md').closest('div');
        expect(readme).toHaveClass('border-brand-500'); // Based on FileItem implementation
    });
});

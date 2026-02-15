import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseGitHubUrl, fetchRepoStructure, fetchFileContent } from './githubService';

// Mock fetch global
const globalFetch = global.fetch;

describe('githubService', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = globalFetch;
        vi.restoreAllMocks();
    });

    describe('parseGitHubUrl', () => {
        it('parses valid URLs correctly', () => {
            expect(parseGitHubUrl('https://github.com/owner/repo')).toEqual({
                owner: 'owner',
                repo: 'repo',
                branch: 'main',
            });
            expect(parseGitHubUrl('github.com/owner/repo')).toEqual({
                owner: 'owner',
                repo: 'repo',
                branch: 'main',
            });
        });

        it('returns null for invalid URLs', () => {
            expect(parseGitHubUrl('https://google.com')).toBeNull();
            expect(parseGitHubUrl('invalid-url')).toBeNull();
            expect(parseGitHubUrl('https://github.com/owner')).toBeNull(); // Missing repo
        });
    });

    describe('fetchRepoStructure', () => {
        it('fetched and builds file tree successfully', async () => {
            const mockRepoDetails = { default_branch: 'main' };
            const mockTreeResponse = {
                tree: [
                    { path: 'README.md', type: 'blob', url: '...' },
                    { path: 'src', type: 'tree', url: '...' },
                    { path: 'src/index.ts', type: 'blob', url: '...' },
                ],
            };

            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockRepoDetails,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => mockTreeResponse,
                });

            const result = await fetchRepoStructure('https://github.com/owner/repo');

            expect(result).toHaveLength(2); // README.md and src
            expect(result.find(n => n.name === 'README.md')).toBeDefined();
            expect(result.find(n => n.name === 'src')?.children).toHaveLength(1); // src/index.ts
        });

        it('throws error on invalid URL', async () => {
            await expect(fetchRepoStructure('invalid')).rejects.toThrow('Invalid GitHub URL');
        });

        it('throws error when repo not found', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            await expect(fetchRepoStructure('https://github.com/owner/repo')).rejects.toThrow();
        });
    });

    describe('fetchFileContent', () => {
        it('fetches file content successfully', async () => {
            const mockContent = {
                content: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
                encoding: 'base64'
            };

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockContent
            });

            const content = await fetchFileContent('https://github.com/owner/repo', 'README.md');
            expect(content).toBe('Hello World');
        });

        it('fetches image content as data URI', async () => {
            const mockContent = {
                content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                encoding: 'base64'
            };

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockContent
            });

            const content = await fetchFileContent('https://github.com/owner/repo', 'image.png');
            expect(content).toContain('data:image/png;base64,');
        });
    })
});

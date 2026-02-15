import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeCode, generateProjectStructure } from './geminiService';
import { GoogleGenAI } from '@google/genai';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: vi.fn(function () {
            return {
                models: {
                    generateContent: mockGenerateContent,
                },
            };
        }),
    };
});

describe('geminiService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.API_KEY = 'test-api-key';
    });

    afterEach(() => {
        delete process.env.API_KEY;
    });

    describe('analyzeCode', () => {
        it('analyzes code successfully', async () => {
            const mockResponse = {
                text: JSON.stringify({
                    summary: 'Test Summary',
                    complexity: 'Low',
                    dependencies: [],
                    patterns: [],
                    risks: [],
                }),
            };

            mockGenerateContent.mockResolvedValue(mockResponse);

            const result = await analyzeCode(
                'source code',
                'javascript',
                'typescript',
            );

            expect(result.summary).toBe('Test Summary');
            expect(result.complexity).toBe('Low');
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        it('handles API errors gracefully', async () => {
            mockGenerateContent.mockRejectedValue(new Error('API Error'));

            const result = await analyzeCode('source', 'js', 'ts');

            expect(result.summary).toContain('Failed to');
            expect(result.risks).toContain('API Error / Parsing Failed');
        });
    });

    describe('generateProjectStructure', () => {
        it('generates project structure successfully', async () => {
            const mockStructure = ['package.json', 'src/index.ts'];
            const mockResponse = {
                text: JSON.stringify(mockStructure),
            };

            mockGenerateContent.mockResolvedValue(mockResponse);

            const result = await generateProjectStructure('summary');

            expect(result).toEqual(mockStructure);
        });

        it('returns fallback on error', async () => {
            mockGenerateContent.mockRejectedValue(new Error('API Error'));

            const result = await generateProjectStructure('summary');

            expect(result).toContain('package.json');
            expect(result).toContain('app/page.tsx');
        });
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeCode,
  generateProjectStructure,
  validateGeminiApiKey,
} from './geminiService';

const mockFetch = vi.fn();

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('analyzeCode', () => {
    it('analyzes code successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          text: JSON.stringify({
            summary: 'Test Summary',
            complexity: 'Low',
            dependencies: [],
            patterns: [],
            risks: [],
          }),
        }),
      });

      const result = await analyzeCode(
        'source code',
        'javascript',
        'typescript',
      );

      expect(result.summary).toBe('Test Summary');
      expect(result.complexity).toBe('Low');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gemini',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('handles API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      const result = await analyzeCode('source', 'js', 'ts');

      expect(result.summary).toContain('Failed to');
      expect(result.risks).toContain('API Error / Parsing Failed');
    });
  });

  describe('generateProjectStructure', () => {
    it('generates project structure successfully', async () => {
      const mockStructure = ['package.json', 'src/index.ts'];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          text: JSON.stringify(mockStructure),
        }),
      });

      const result = await generateProjectStructure('summary', {
        uiFramework: 'tailwind',
        stateManagement: 'context',
        testingLibrary: 'vitest',
      });

      expect(result).toEqual(mockStructure);
    });

    it('returns fallback on error', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      const result = await generateProjectStructure('summary', {
        uiFramework: 'tailwind',
        stateManagement: 'context',
        testingLibrary: 'vitest',
      });

      expect(result).toContain('package.json');
      expect(result).toContain('app/page.tsx');
    });
  });

  describe('validateGeminiApiKey', () => {
    it('throws a server configuration error when key is missing server-side', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Missing key' }),
      });

      await expect(validateGeminiApiKey()).rejects.toThrow(
        'Gemini API key is missing on the server. Configure GEMINI_API_KEY in server environment variables.',
      );
    });
  });
});

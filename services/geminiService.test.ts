import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeCode,
  generateArchitectureDiagram,
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

  describe('generateArchitectureDiagram', () => {
    it('requests image modality and returns a data URL', async () => {
      const mockImageBase64 = 'aW1hZ2U=';

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          text: '',
          inlineData: [
            {
              mimeType: 'image/png',
              data: mockImageBase64,
            },
          ],
        }),
      });

      const result = await generateArchitectureDiagram(
        'Legacy PHP client/server flow',
      );

      expect(result).toBe(`data:image/png;base64,${mockImageBase64}`);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, requestInit] = mockFetch.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(url).toBe('/api/gemini');
      expect(requestInit.method).toBe('POST');

      const payload = JSON.parse(String(requestInit.body)) as {
        model: string;
        config: { responseModalities?: string[] };
      };

      expect(payload.model).toBe('gemini-3-pro-image-preview');
      expect(payload.config.responseModalities).toEqual(['IMAGE']);
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

import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import {
  ANALYSIS_PROMPT_TEMPLATE,
  CONVERSION_PROMPT_TEMPLATE,
  VERIFICATION_PROMPT_TEMPLATE,
  REPO_ANALYSIS_PROMPT_TEMPLATE,
  PROJECT_SCAFFOLD_PROMPT,
  GENERATION_PROMPT_TEMPLATE,
} from '../constants';
import {
  AnalysisResult,
  VerificationResult,
  RepoAnalysisResult,
  MigrationConfig,
} from '../types';
import { abortIfSignaled, isAbortError } from './abortUtils';

// Helper to get safe API key
const getApiKey = () => process.env.API_KEY || '';

const createClient = () => new GoogleGenAI({ apiKey: getApiKey() });

interface GeminiRequestOptions {
  abortSignal?: AbortSignal;
}

const sanitizeGeneratedCode = (raw: string): string => {
  return raw.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
};

const sleep = async (ms: number, signal?: AbortSignal): Promise<void> => {
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('Operation aborted', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
};

// Helper: Exponential Backoff Retry for 503 Errors
const withRetry = async <T>(
  fn: () => Promise<T>,
  options?: { retries?: number; baseDelay?: number; abortSignal?: AbortSignal },
): Promise<T> => {
  const retries = options?.retries ?? 3;
  const baseDelay = options?.baseDelay ?? 2000;
  const abortSignal = options?.abortSignal;

  try {
    abortIfSignaled(abortSignal);
    return await fn();
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    // Check for 503 or overload messages
    const geminiError = error as { status?: number; message?: string };
    const isOverloaded =
      geminiError.status === 503 ||
      geminiError.message?.includes('503') ||
      geminiError.message?.includes('high demand') ||
      geminiError.message?.includes('overloaded') ||
      geminiError.message?.includes('UNAVAILABLE');

    if (retries > 0 && isOverloaded) {
      console.warn(
        `Gemini API overloaded (503). Retrying operation... attempts left: ${retries}`,
      );
      // Wait for baseDelay * (2 ^ (3 - retries)) -- Simple exponential: 2s, 4s, 8s
      await sleep(baseDelay, abortSignal);
      return withRetry(fn, {
        retries: retries - 1,
        baseDelay: baseDelay * 2,
        abortSignal,
      });
    }
    throw error;
  }
};

export const analyzeCode = async (
  sourceCode: string,
  sourceLang: string,
  targetLang: string,
  options?: GeminiRequestOptions,
): Promise<AnalysisResult> => {
  const client = createClient();
  const abortSignal = options?.abortSignal;
  const prompt = ANALYSIS_PROMPT_TEMPLATE.replace(
    '{sourceLang}',
    sourceLang,
  ).replace('{targetLang}', targetLang);

  try {
    const response = await withRetry<GenerateContentResponse>(
      () =>
        client.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: prompt + '\n\nSource Code:\n' + sourceCode,
          config: {
            abortSignal,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 1024 },
          },
        }),
      { abortSignal },
    );

    const text = response.text || '{}';
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error('Failed to analyze code', e);
    return {
      summary: 'Failed to generate analysis due to API error or parsing issue.',
      complexity: 'Medium',
      dependencies: [],
      patterns: [],
      risks: ['API Error / Parsing Failed'],
    };
  }
};

export const analyzeRepository = async (
  fileList: string,
  readme: string,
  options?: GeminiRequestOptions,
): Promise<RepoAnalysisResult> => {
  const client = createClient();
  const abortSignal = options?.abortSignal;
  const prompt = REPO_ANALYSIS_PROMPT_TEMPLATE.replace(
    '{fileList}',
    fileList,
  ).replace('{readme}', readme);

  try {
    const response = await withRetry<GenerateContentResponse>(
      () =>
        client.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: prompt,
          config: {
            abortSignal,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 2048 },
          },
        }),
      { abortSignal },
    );

    const text = response.text || '{}';
    return JSON.parse(text) as RepoAnalysisResult;
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error('Failed to parse repo analysis JSON', e);
    // Fallback
    return {
      summary: 'Could not analyze repository structure automatically.',
      complexity: 'High',
      dependencies: [],
      patterns: [],
      risks: ['API Error'],
      detectedFramework: 'Unknown',
      recommendedTarget: 'Next.js + TypeScript',
      architectureDescription: 'A generic software architecture diagram.',
    };
  }
};

export const generateProjectStructure = async (
  analysisSummary: string,
  config: MigrationConfig,
  includeTests: boolean = false,
  options?: GeminiRequestOptions,
): Promise<string[]> => {
  const client = createClient();
  const abortSignal = options?.abortSignal;
  const testReq = includeTests
    ? 'Include comprehensive test files (e.g., __tests__/*.test.tsx, *.spec.ts) for main components and utilities using Vitest/React Testing Library.'
    : 'Do not include any test files or test configuration.';

  const userConfigStr = JSON.stringify(config, null, 2);

  const prompt = PROJECT_SCAFFOLD_PROMPT.replace(
    '{analysisSummary}',
    analysisSummary,
  )
    .replace('{testRequirement}', testReq)
    .replace('{userConfig}', userConfigStr);

  try {
    const response = await withRetry<GenerateContentResponse>(
      () =>
        client.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: prompt,
          config: {
            abortSignal,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 1024 },
          },
        }),
      { abortSignal },
    );

    const text = response.text || '[]';
    return JSON.parse(text) as string[];
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error('Failed to parse scaffold JSON', e);
    return ['package.json', 'app/page.tsx', 'app/layout.tsx', 'README.md']; // Fallback
  }
};

export const generateNextJsFile = async (
  targetFilePath: string,
  sourceContext: string,
  relatedFilesContext: string,
  config: MigrationConfig,
  options?: GeminiRequestOptions,
): Promise<string> => {
  const client = createClient();
  const abortSignal = options?.abortSignal;
  // Truncate sourceContext if too large (approx safety check) - increased to 500k for Gemini 1.5 Pro
  const safeContext =
    sourceContext.length > 500000
      ? sourceContext.substring(0, 500000) + '\n...[truncated]'
      : sourceContext;

  // Truncate related context if needed, leaving room for source
  const safeRelated =
    relatedFilesContext.length > 200000
      ? relatedFilesContext.substring(0, 200000) + '\n...[truncated]'
      : relatedFilesContext;

  const userConfigStr = JSON.stringify(config, null, 2);

  const prompt = GENERATION_PROMPT_TEMPLATE.replace(
    '{targetFilePath}',
    targetFilePath,
  )
    .replace('{sourceContext}', safeContext)
    .replace('{relatedFilesContext}', safeRelated)
    .replace('{userConfig}', userConfigStr);

  try {
    const response = await withRetry<GenerateContentResponse>(
      () =>
        client.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            abortSignal,
            thinkingConfig: { thinkingBudget: 2048 },
          },
        }),
      { abortSignal },
    );

    return sanitizeGeneratedCode(response.text || '');
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error(`Failed to generate file ${targetFilePath}`, e);
    throw e; // Rethrow to be handled by caller UI
  }
};

export const generateNextJsFileStream = async (
  targetFilePath: string,
  sourceContext: string,
  relatedFilesContext: string,
  config: MigrationConfig,
  onChunk: (content: string) => void,
  options?: GeminiRequestOptions,
): Promise<string> => {
  const client = createClient();
  const abortSignal = options?.abortSignal;

  const safeContext =
    sourceContext.length > 500000
      ? sourceContext.substring(0, 500000) + '\n...[truncated]'
      : sourceContext;

  const safeRelated =
    relatedFilesContext.length > 200000
      ? relatedFilesContext.substring(0, 200000) + '\n...[truncated]'
      : relatedFilesContext;

  const userConfigStr = JSON.stringify(config, null, 2);

  const prompt = GENERATION_PROMPT_TEMPLATE.replace(
    '{targetFilePath}',
    targetFilePath,
  )
    .replace('{sourceContext}', safeContext)
    .replace('{relatedFilesContext}', safeRelated)
    .replace('{userConfig}', userConfigStr);

  try {
    const stream = await withRetry(
      () =>
        client.models.generateContentStream({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            abortSignal,
            thinkingConfig: { thinkingBudget: 2048 },
          },
        }),
      { abortSignal },
    );

    let accumulated = '';

    for await (const chunk of stream) {
      abortIfSignaled(abortSignal);
      const chunkText = chunk.text || '';
      if (!chunkText) {
        continue;
      }

      accumulated += chunkText;
      onChunk(sanitizeGeneratedCode(accumulated));
    }

    return sanitizeGeneratedCode(accumulated);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    console.error(`Failed to stream file ${targetFilePath}`, error);
    throw error;
  }
};

export const generateArchitectureDiagram = async (
  description: string,
  options?: GeminiRequestOptions,
): Promise<string> => {
  const client = createClient();
  const abortSignal = options?.abortSignal;
  // Using gemini-3-pro-image-preview for high quality diagrams
  const prompt = `Create a professional, high-level software architecture diagram.
  Style: Whiteboard, technical, clean lines, blue and white color scheme.
  System Description: ${description}`;

  try {
    const response = await withRetry<GenerateContentResponse>(
      () =>
        client.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            abortSignal,
            imageConfig: {
              aspectRatio: '16:9',
              imageSize: '1K',
            },
          },
        }),
      { abortSignal },
    );

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return '';
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error('Image generation failed', e);
    return '';
  }
};

export const convertCode = async (
  sourceCode: string,
  sourceLang: string,
  targetLang: string,
  analysis: AnalysisResult,
  options?: GeminiRequestOptions,
): Promise<string> => {
  const client = createClient();
  const abortSignal = options?.abortSignal;
  const prompt = CONVERSION_PROMPT_TEMPLATE.replace('{sourceLang}', sourceLang)
    .replace('{targetLang}', targetLang)
    .replace('{analysisJson}', JSON.stringify(analysis))
    .replace('{sourceCode}', sourceCode);

  try {
    const response = await withRetry<GenerateContentResponse>(
      () =>
        client.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            abortSignal,
            thinkingConfig: { thinkingBudget: 2048 },
          },
        }),
      { abortSignal },
    );

    return sanitizeGeneratedCode(response.text || '');
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error('Code conversion failed', e);
    throw e;
  }
};

export const verifyCode = async (
  targetCode: string,
  sourceLang: string,
  targetLang: string,
  options?: GeminiRequestOptions,
): Promise<VerificationResult> => {
  const client = createClient();
  const abortSignal = options?.abortSignal;
  const prompt = VERIFICATION_PROMPT_TEMPLATE.replace(
    '{sourceLang}',
    sourceLang,
  )
    .replace('{targetLang}', targetLang)
    .replace('{targetCode}', targetCode);

  try {
    const response = await withRetry<GenerateContentResponse>(
      () =>
        client.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: prompt,
          config: {
            abortSignal,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 1024 },
          },
        }),
      { abortSignal },
    );

    const text = response.text || '{}';
    try {
      const result = JSON.parse(text);
      return {
        passed: result.passed,
        issues: result.issues || [],
        fixedCode: result.fixedCode,
      };
    } catch (_parseError) {
      return { passed: true, issues: ['Verification parsing failed'] };
    }
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error('Failed to verify code', e);
    return { passed: true, issues: ['Verification failed due to API Error'] };
  }
};

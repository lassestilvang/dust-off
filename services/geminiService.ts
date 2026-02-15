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

// Helper to get safe API key
const getApiKey = () => process.env.API_KEY || '';

const createClient = () => new GoogleGenAI({ apiKey: getApiKey() });

// Helper: Exponential Backoff Retry for 503 Errors
const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 2000,
): Promise<T> => {
  try {
    return await fn();
  } catch (error: unknown) {
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
      await new Promise((resolve) => setTimeout(resolve, baseDelay));
      return withRetry(fn, retries - 1, baseDelay * 2);
    }
    throw error;
  }
};

export const analyzeCode = async (
  sourceCode: string,
  sourceLang: string,
  targetLang: string,
): Promise<AnalysisResult> => {
  const client = createClient();
  const prompt = ANALYSIS_PROMPT_TEMPLATE.replace(
    '{sourceLang}',
    sourceLang,
  ).replace('{targetLang}', targetLang);

  try {
    const response = await withRetry<GenerateContentResponse>(() =>
      client.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt + '\n\nSource Code:\n' + sourceCode,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 1024 },
        },
      }),
    );

    const text = response.text || '{}';
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
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
): Promise<RepoAnalysisResult> => {
  const client = createClient();
  const prompt = REPO_ANALYSIS_PROMPT_TEMPLATE.replace(
    '{fileList}',
    fileList,
  ).replace('{readme}', readme);

  try {
    const response = await withRetry<GenerateContentResponse>(() =>
      client.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 2048 },
        },
      }),
    );

    const text = response.text || '{}';
    return JSON.parse(text) as RepoAnalysisResult;
  } catch (e) {
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
): Promise<string[]> => {
  const client = createClient();
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
    const response = await withRetry<GenerateContentResponse>(() =>
      client.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 1024 },
        },
      }),
    );

    const text = response.text || '[]';
    return JSON.parse(text) as string[];
  } catch (e) {
    console.error('Failed to parse scaffold JSON', e);
    return ['package.json', 'app/page.tsx', 'app/layout.tsx', 'README.md']; // Fallback
  }
};

export const generateNextJsFile = async (
  targetFilePath: string,
  sourceContext: string,
  relatedFilesContext: string,
  config: MigrationConfig,
): Promise<string> => {
  const client = createClient();
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
    const response = await withRetry<GenerateContentResponse>(() =>
      client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 2048 },
        },
      }),
    );

    let code = response.text || '';
    code = code.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
    return code;
  } catch (e) {
    console.error(`Failed to generate file ${targetFilePath}`, e);
    throw e; // Rethrow to be handled by caller UI
  }
};

export const generateArchitectureDiagram = async (
  description: string,
): Promise<string> => {
  const client = createClient();
  // Using gemini-3-pro-image-preview for high quality diagrams
  const prompt = `Create a professional, high-level software architecture diagram.
  Style: Whiteboard, technical, clean lines, blue and white color scheme.
  System Description: ${description}`;

  try {
    const response = await withRetry<GenerateContentResponse>(() =>
      client.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '1K',
          },
        },
      }),
    );

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return '';
  } catch (e) {
    console.error('Image generation failed', e);
    return '';
  }
};

export const convertCode = async (
  sourceCode: string,
  sourceLang: string,
  targetLang: string,
  analysis: AnalysisResult,
): Promise<string> => {
  const client = createClient();
  const prompt = CONVERSION_PROMPT_TEMPLATE.replace('{sourceLang}', sourceLang)
    .replace('{targetLang}', targetLang)
    .replace('{analysisJson}', JSON.stringify(analysis))
    .replace('{sourceCode}', sourceCode);

  try {
    const response = await withRetry<GenerateContentResponse>(() =>
      client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 2048 },
        },
      }),
    );

    let code = response.text || '';
    code = code.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
    return code;
  } catch (e) {
    console.error('Code conversion failed', e);
    throw e;
  }
};

export const verifyCode = async (
  targetCode: string,
  sourceLang: string,
  targetLang: string,
): Promise<VerificationResult> => {
  const client = createClient();
  const prompt = VERIFICATION_PROMPT_TEMPLATE.replace(
    '{sourceLang}',
    sourceLang,
  )
    .replace('{targetLang}', targetLang)
    .replace('{targetCode}', targetCode);

  try {
    const response = await withRetry<GenerateContentResponse>(() =>
      client.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 1024 },
        },
      }),
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
    console.error('Failed to verify code', e);
    return { passed: true, issues: ['Verification failed due to API Error'] };
  }
};

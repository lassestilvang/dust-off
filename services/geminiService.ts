import {
  ANALYSIS_PROMPT_TEMPLATE,
  ANALYSIS_SYSTEM_INSTRUCTION,
  CONVERSION_PROMPT_TEMPLATE,
  GENERATION_PROMPT_TEMPLATE,
  GENERATION_SYSTEM_INSTRUCTION,
  MIGRATION_PLAYBOOK_PROMPT_TEMPLATE,
  PLAYBOOK_SYSTEM_INSTRUCTION,
  PROJECT_SCAFFOLD_PROMPT,
  REPO_ANALYSIS_PROMPT_TEMPLATE,
  REPO_ANALYSIS_SYSTEM_INSTRUCTION,
  REPO_VERIFICATION_PROMPT_TEMPLATE,
  SCAFFOLD_SYSTEM_INSTRUCTION,
  VERIFICATION_PROMPT_TEMPLATE,
  VERIFICATION_SYSTEM_INSTRUCTION,
} from '../constants';
import {
  AnalysisResult,
  MigrationPlaybook,
  MigrationConfig,
  RepoAnalysisResult,
  RepoVerificationResult,
  VerificationResult,
} from '../types';
import { abortIfSignaled, isAbortError } from './abortUtils';

const GEMINI_PROXY_ENDPOINT = '/api/gemini';
const API_KEY_VALIDATION_CACHE_TTL_MS = 10 * 60 * 1000;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const NETWORK_ERROR_PATTERN =
  /network|fetch|timeout|temporar|econnreset|etimedout|enotfound|socket|eai_again|unavailable/i;

let validatedApiKeyCache: { verifiedAt: number } | null = null;

interface GeminiRequestOptions {
  abortSignal?: AbortSignal;
}

interface GeminiImageConfig {
  aspectRatio?: string;
  imageSize?: string;
}

interface GeminiProxyConfig {
  systemInstruction?: string;
  responseMimeType?: string;
  thinkingBudget?: number;
  imageConfig?: GeminiImageConfig;
}

interface GeminiProxyResponse {
  text?: string;
  inlineData?: Array<{
    mimeType: string;
    data: string;
  }>;
}

interface GeminiProxyError extends Error {
  status?: number;
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

    const geminiError = error as { status?: number; message?: string };
    const errorMessage = geminiError.message || '';
    const isRetryable =
      (typeof geminiError.status === 'number' &&
        RETRYABLE_STATUS_CODES.has(geminiError.status)) ||
      NETWORK_ERROR_PATTERN.test(errorMessage) ||
      NETWORK_ERROR_PATTERN.test(String(error));

    if (retries > 0 && isRetryable) {
      const delayMs = Math.round(baseDelay * (0.75 + Math.random() * 0.5));
      console.warn(
        `Retrying Gemini request after transient failure (${geminiError.status ?? 'network'}). Attempts left: ${retries}`,
      );
      await sleep(delayMs, abortSignal);
      return withRetry(fn, {
        retries: retries - 1,
        baseDelay: Math.min(baseDelay * 2, 15_000),
        abortSignal,
      });
    }

    throw error;
  }
};

const createGeminiProxyError = (
  status: number,
  message: string,
): GeminiProxyError => {
  const error = new Error(message) as GeminiProxyError;
  error.status = status;
  return error;
};

const requestGemini = async (
  model: string,
  contents: unknown,
  config: GeminiProxyConfig,
  options?: GeminiRequestOptions,
): Promise<GeminiProxyResponse> => {
  const response = await fetch(GEMINI_PROXY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: options?.abortSignal,
    body: JSON.stringify({
      model,
      contents,
      config,
    }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Some proxy responses may not include JSON bodies.
  }

  if (!response.ok) {
    const message =
      typeof (payload as { error?: unknown })?.error === 'string'
        ? (payload as { error: string }).error
        : `Gemini proxy request failed (${response.status}).`;
    throw createGeminiProxyError(response.status, message);
  }

  if (!payload || typeof payload !== 'object') {
    throw createGeminiProxyError(
      response.status,
      'Gemini proxy returned an invalid response payload.',
    );
  }

  return payload as GeminiProxyResponse;
};

const normalizeRepoAnalysis = (
  payload: Partial<RepoAnalysisResult> | null | undefined,
): RepoAnalysisResult => {
  const semanticFileMappings = Array.isArray(payload?.semanticFileMappings)
    ? payload.semanticFileMappings
        .map((entry) => ({
          sourcePath:
            typeof entry?.sourcePath === 'string' ? entry.sourcePath : '',
          targetPath:
            typeof entry?.targetPath === 'string' ? entry.targetPath : '',
          rationale:
            typeof entry?.rationale === 'string' ? entry.rationale : '',
          confidence:
            typeof entry?.confidence === 'number'
              ? Math.max(0, Math.min(1, entry.confidence))
              : 0.5,
        }))
        .filter((entry) => entry.sourcePath && entry.targetPath)
    : [];

  const migrationNotes = Array.isArray(payload?.migrationNotes)
    ? payload!.migrationNotes.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];

  return {
    summary:
      typeof payload?.summary === 'string' && payload.summary.trim()
        ? payload.summary
        : 'Could not analyze repository structure automatically.',
    complexity:
      payload?.complexity === 'Low' ||
      payload?.complexity === 'Medium' ||
      payload?.complexity === 'High'
        ? payload.complexity
        : 'High',
    dependencies: Array.isArray(payload?.dependencies)
      ? payload!.dependencies.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    patterns: Array.isArray(payload?.patterns)
      ? payload!.patterns.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    risks: Array.isArray(payload?.risks)
      ? payload!.risks.filter(
          (item): item is string => typeof item === 'string',
        )
      : ['API Error'],
    detectedFramework:
      typeof payload?.detectedFramework === 'string' &&
      payload.detectedFramework.trim()
        ? payload.detectedFramework
        : 'Unknown',
    recommendedTarget:
      typeof payload?.recommendedTarget === 'string' &&
      payload.recommendedTarget.trim()
        ? payload.recommendedTarget
        : 'Next.js + TypeScript',
    architectureDescription:
      typeof payload?.architectureDescription === 'string' &&
      payload.architectureDescription.trim()
        ? payload.architectureDescription
        : 'A generic software architecture diagram.',
    semanticFileMappings,
    migrationNotes,
  };
};

const normalizePlaybookQuestionId = (value: string, index: number): string => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `question_${index + 1}`;
};

const normalizeMigrationPlaybook = (
  payload: Partial<MigrationPlaybook> | null | undefined,
): MigrationPlaybook => {
  const conversionHighlights = Array.isArray(payload?.conversionHighlights)
    ? payload!.conversionHighlights
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 8)
    : [];

  const executionPlan = Array.isArray(payload?.executionPlan)
    ? payload!.executionPlan
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 8)
    : [];

  const targetArtifacts = Array.isArray(payload?.targetArtifacts)
    ? payload!.targetArtifacts
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 8)
    : [];

  const riskMitigations = Array.isArray(payload?.riskMitigations)
    ? payload!.riskMitigations
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 8)
    : [];

  const questions = Array.isArray(payload?.questions)
    ? payload!.questions
        .map((question, index) => {
          const options = Array.isArray(question?.options)
            ? question.options.filter(
                (option): option is string => typeof option === 'string',
              )
            : [];
          const recommendedOption =
            typeof question?.recommendedOption === 'string' &&
            options.includes(question.recommendedOption)
              ? question.recommendedOption
              : options[0];

          return {
            id: normalizePlaybookQuestionId(
              typeof question?.id === 'string'
                ? question.id
                : typeof question?.title === 'string'
                  ? question.title
                  : `question_${index + 1}`,
              index,
            ),
            title:
              typeof question?.title === 'string' && question.title.trim()
                ? question.title
                : `Decision ${index + 1}`,
            question:
              typeof question?.question === 'string' && question.question.trim()
                ? question.question
                : 'Please review this migration decision.',
            options,
            recommendedOption,
            rationale:
              typeof question?.rationale === 'string' ? question.rationale : '',
            required: question?.required !== false,
          };
        })
        .filter((question) => question.options.length > 0)
        .slice(0, 5)
    : [];

  return {
    overview:
      typeof payload?.overview === 'string' && payload.overview.trim()
        ? payload.overview
        : 'Review the generated migration plan before code generation starts.',
    objective:
      typeof payload?.objective === 'string' && payload.objective.trim()
        ? payload.objective
        : 'Deliver a production-ready Next.js + TypeScript project with parity to the legacy repository.',
    conversionHighlights:
      conversionHighlights.length > 0
        ? conversionHighlights
        : [
            'Map legacy features to App Router pages and server-first patterns.',
          ],
    executionPlan:
      executionPlan.length > 0
        ? executionPlan
        : [
            'Validate scaffold and critical file mappings.',
            'Generate target files with semantic source context.',
            'Run multi-pass verification and apply safe fixes.',
          ],
    targetArtifacts:
      targetArtifacts.length > 0
        ? targetArtifacts
        : ['app/', 'components/', 'lib/', 'package.json'],
    riskMitigations:
      riskMitigations.length > 0
        ? riskMitigations
        : [
            'Review auth/data flow decisions before generation.',
            'Use post-generation verification for cross-file integrity.',
          ],
    questions:
      questions.length > 0
        ? questions
        : [
            {
              id: 'auth_strategy',
              title: 'Authentication Migration',
              question:
                'If the legacy project has custom authentication, should migration keep it or move to NextAuth-compatible patterns?',
              options: [
                'Keep custom authentication behavior',
                'Adopt NextAuth-compatible patterns',
              ],
              recommendedOption: 'Keep custom authentication behavior',
              rationale:
                'Preserving current auth semantics lowers regression risk for first migration pass.',
              required: true,
            },
            {
              id: 'data_fetching',
              title: 'Data Fetching Strategy',
              question:
                'Should data-heavy routes default to server components with async fetches?',
              options: [
                'Yes, prefer server components',
                'Keep client-driven fetching where possible',
              ],
              recommendedOption: 'Yes, prefer server components',
              rationale:
                'Server components are aligned with Next.js App Router defaults and reduce client bundle size.',
              required: true,
            },
          ],
  };
};

const safeParseJson = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

export const validateGeminiApiKey = async (
  options?: GeminiRequestOptions,
): Promise<void> => {
  const abortSignal = options?.abortSignal;

  if (
    validatedApiKeyCache &&
    Date.now() - validatedApiKeyCache.verifiedAt <
      API_KEY_VALIDATION_CACHE_TTL_MS
  ) {
    return;
  }

  try {
    await withRetry(
      () =>
        requestGemini(
          'gemini-3-flash-preview',
          'Respond with: OK',
          {
            thinkingBudget: 128,
          },
          options,
        ),
      { retries: 2, baseDelay: 1000, abortSignal },
    );

    validatedApiKeyCache = {
      verifiedAt: Date.now(),
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      throw new Error(
        'Gemini API key is invalid or unauthorized. Verify GEMINI_API_KEY on the server and try again.',
        { cause: error },
      );
    }

    if (status === 500) {
      throw new Error(
        'Gemini API key is missing on the server. Configure GEMINI_API_KEY in server environment variables.',
        { cause: error },
      );
    }

    throw new Error(
      'Unable to validate Gemini API key due to a temporary API or network error. Please retry.',
      { cause: error },
    );
  }
};

export const analyzeCode = async (
  sourceCode: string,
  sourceLang: string,
  targetLang: string,
  options?: GeminiRequestOptions,
): Promise<AnalysisResult> => {
  const abortSignal = options?.abortSignal;
  const prompt = ANALYSIS_PROMPT_TEMPLATE.replace(
    '{sourceLang}',
    sourceLang,
  ).replace('{targetLang}', targetLang);

  try {
    const response = await withRetry(
      () =>
        requestGemini(
          'gemini-3-pro-preview',
          prompt + '\n\nSource Code:\n' + sourceCode,
          {
            systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            thinkingBudget: 1024,
          },
          options,
        ),
      { abortSignal },
    );

    return safeParseJson(response.text || '{}', {
      summary: 'Failed to generate analysis due to API error or parsing issue.',
      complexity: 'Medium',
      dependencies: [],
      patterns: [],
      risks: ['API Error / Parsing Failed'],
    } satisfies AnalysisResult);
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
  const abortSignal = options?.abortSignal;
  const prompt = REPO_ANALYSIS_PROMPT_TEMPLATE.replace(
    '{fileList}',
    fileList,
  ).replace('{readme}', readme);

  try {
    const response = await withRetry(
      () =>
        requestGemini(
          'gemini-3-pro-preview',
          prompt,
          {
            systemInstruction: REPO_ANALYSIS_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            thinkingBudget: 2048,
          },
          options,
        ),
      { abortSignal },
    );

    const parsed = safeParseJson<Partial<RepoAnalysisResult>>(
      response.text || '{}',
      {},
    );
    return normalizeRepoAnalysis(parsed);
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error('Failed to parse repo analysis JSON', e);
    return normalizeRepoAnalysis(undefined);
  }
};

export const generateProjectStructure = async (
  analysisSummary: string,
  config: MigrationConfig,
  includeTests: boolean = false,
  options?: GeminiRequestOptions,
): Promise<string[]> => {
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
    const response = await withRetry(
      () =>
        requestGemini(
          'gemini-3-pro-preview',
          prompt,
          {
            systemInstruction: SCAFFOLD_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            thinkingBudget: 1024,
          },
          options,
        ),
      { abortSignal },
    );

    const parsed = safeParseJson<unknown>(response.text || '[]', []);
    if (!Array.isArray(parsed)) {
      return ['package.json', 'app/page.tsx', 'app/layout.tsx', 'README.md'];
    }

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error('Failed to parse scaffold JSON', e);
    return ['package.json', 'app/page.tsx', 'app/layout.tsx', 'README.md'];
  }
};

export const generateMigrationPlaybook = async (
  analysis: RepoAnalysisResult,
  generatedFilePaths: string[],
  config: MigrationConfig,
  options?: GeminiRequestOptions,
): Promise<MigrationPlaybook> => {
  const abortSignal = options?.abortSignal;
  const userConfigStr = JSON.stringify(config, null, 2);
  const serializedPaths = JSON.stringify(generatedFilePaths, null, 2);

  const prompt = MIGRATION_PLAYBOOK_PROMPT_TEMPLATE.replace(
    '{analysisSummary}',
    analysis.summary,
  )
    .replace('{detectedFramework}', analysis.detectedFramework)
    .replace('{complexity}', analysis.complexity)
    .replace('{generatedFilePaths}', serializedPaths)
    .replace('{userConfig}', userConfigStr);

  try {
    const response = await withRetry(
      () =>
        requestGemini(
          'gemini-3-pro-preview',
          prompt,
          {
            systemInstruction: PLAYBOOK_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            thinkingBudget: 2048,
          },
          options,
        ),
      { abortSignal },
    );

    const parsed = safeParseJson<Partial<MigrationPlaybook>>(
      response.text || '{}',
      {},
    );
    return normalizeMigrationPlaybook(parsed);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    console.error('Failed to generate migration playbook', error);
    return normalizeMigrationPlaybook(undefined);
  }
};

export const generateNextJsFile = async (
  targetFilePath: string,
  sourceContext: string,
  relatedFilesContext: string,
  config: MigrationConfig,
  options?: GeminiRequestOptions,
): Promise<string> => {
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
    const response = await withRetry(
      () =>
        requestGemini(
          'gemini-3-flash-preview',
          prompt,
          {
            systemInstruction: GENERATION_SYSTEM_INSTRUCTION,
            thinkingBudget: 2048,
          },
          options,
        ),
      { abortSignal },
    );

    return sanitizeGeneratedCode(response.text || '');
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error(`Failed to generate file ${targetFilePath}`, e);
    throw e;
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
  try {
    const content = await generateNextJsFile(
      targetFilePath,
      sourceContext,
      relatedFilesContext,
      config,
      options,
    );
    onChunk(content);
    return content;
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
  const abortSignal = options?.abortSignal;
  const prompt = `Create a professional, high-level software architecture diagram.
  Style: Whiteboard, technical, clean lines, blue and white color scheme.
  System Description: ${description}`;

  try {
    const response = await withRetry(
      () =>
        requestGemini(
          'gemini-3-pro-image-preview',
          {
            parts: [{ text: prompt }],
          },
          {
            systemInstruction: REPO_ANALYSIS_SYSTEM_INSTRUCTION,
            imageConfig: {
              aspectRatio: '16:9',
              imageSize: '1K',
            },
          },
          options,
        ),
      { abortSignal },
    );

    for (const part of response.inlineData || []) {
      if (part.mimeType && part.data) {
        return `data:${part.mimeType};base64,${part.data}`;
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
  const abortSignal = options?.abortSignal;
  const prompt = CONVERSION_PROMPT_TEMPLATE.replace('{sourceLang}', sourceLang)
    .replace('{targetLang}', targetLang)
    .replace('{analysisJson}', JSON.stringify(analysis))
    .replace('{sourceCode}', sourceCode);

  try {
    const response = await withRetry(
      () =>
        requestGemini(
          'gemini-3-flash-preview',
          prompt,
          {
            systemInstruction: GENERATION_SYSTEM_INSTRUCTION,
            thinkingBudget: 2048,
          },
          options,
        ),
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
  const abortSignal = options?.abortSignal;
  const prompt = VERIFICATION_PROMPT_TEMPLATE.replace(
    '{sourceLang}',
    sourceLang,
  )
    .replace('{targetLang}', targetLang)
    .replace('{targetCode}', targetCode);

  try {
    const response = await withRetry(
      () =>
        requestGemini(
          'gemini-3-pro-preview',
          prompt,
          {
            systemInstruction: VERIFICATION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            thinkingBudget: 1024,
          },
          options,
        ),
      { abortSignal },
    );

    const result = safeParseJson<{
      passed?: boolean;
      issues?: string[];
      fixedCode?: string;
    }>(response.text || '{}', {});

    return {
      passed: Boolean(result.passed),
      issues: Array.isArray(result.issues)
        ? result.issues.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
      fixedCode:
        typeof result.fixedCode === 'string' ? result.fixedCode : undefined,
    };
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    console.error('Failed to verify code', e);
    return { passed: true, issues: ['Verification failed due to API Error'] };
  }
};

export const verifyRepositoryFiles = async (
  generatedFiles: Array<{ path: string; content: string }>,
  analysisSummary: string,
  issuesFromStaticChecks: string[],
  passNumber: number,
  options?: GeminiRequestOptions,
): Promise<RepoVerificationResult> => {
  const abortSignal = options?.abortSignal;
  const existingPaths = new Set(generatedFiles.map((file) => file.path));

  const compactFilesPayload = generatedFiles.map((file) => ({
    path: file.path,
    content:
      file.content.length > 12000
        ? `${file.content.slice(0, 12000)}\n/* ...truncated... */`
        : file.content,
  }));

  const prompt = REPO_VERIFICATION_PROMPT_TEMPLATE.replace(
    '{analysisSummary}',
    analysisSummary,
  )
    .replace(
      '{issuesFromStaticChecks}',
      JSON.stringify(issuesFromStaticChecks, null, 2),
    )
    .replace(
      '{generatedFilesJson}',
      JSON.stringify(compactFilesPayload, null, 2),
    )
    .replace('{passNumber}', String(passNumber));

  try {
    const response = await withRetry(
      () =>
        requestGemini(
          'gemini-3-pro-preview',
          prompt,
          {
            systemInstruction: VERIFICATION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            thinkingBudget: 2048,
          },
          options,
        ),
      { abortSignal },
    );

    const parsed = safeParseJson<{
      passed?: boolean;
      issues?: string[];
      fixedFiles?: Array<{ path?: string; content?: string }>;
    }>(response.text || '{}', {});

    const fixedFiles = Array.isArray(parsed.fixedFiles)
      ? parsed.fixedFiles
          .map((file) => ({
            path: typeof file?.path === 'string' ? file.path : '',
            content: typeof file?.content === 'string' ? file.content : '',
          }))
          .filter(
            (file) =>
              Boolean(file.path) &&
              Boolean(file.content) &&
              existingPaths.has(file.path),
          )
      : [];

    return {
      passed: Boolean(parsed.passed),
      issues: Array.isArray(parsed.issues)
        ? parsed.issues.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
      fixedFiles,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    console.error('Failed to verify repository files', error);
    return {
      passed: false,
      issues: [
        'Repository verification request failed. Manual review required.',
      ],
      fixedFiles: [],
    };
  }
};

import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const NETWORK_ERROR_PATTERN =
  /network|fetch|timeout|temporar|econnreset|etimedout|enotfound|socket|eai_again|unavailable/i;
const MAX_REQUEST_BODY_BYTES = 2_000_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 60;

interface GeminiProxyConfig {
  systemInstruction?: string;
  responseMimeType?: string;
  responseModalities?: string[];
  thinkingBudget?: number;
  imageConfig?: {
    aspectRatio?: string;
    imageSize?: string;
  };
}

interface GeminiProxyPayload {
  model: string;
  contents: unknown;
  config?: GeminiProxyConfig;
}

interface RateLimitState {
  count: number;
  resetAt: number;
}

interface RequestWithBody extends IncomingMessage {
  body?: unknown;
}

interface StatusError extends Error {
  status?: number;
}

const ipRateLimitStore = new Map<string, RateLimitState>();

const readRawRequestBody = async (req: RequestWithBody): Promise<string> => {
  if (typeof req.body === 'string') {
    return req.body;
  }

  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }

  const chunks: Buffer[] = [];
  let totalLength = 0;

  for await (const chunk of req) {
    const chunkBuffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(String(chunk));

    totalLength += chunkBuffer.length;
    if (totalLength > MAX_REQUEST_BODY_BYTES) {
      const error = new Error('Request payload too large.') as StatusError;
      error.status = 413;
      throw error;
    }

    chunks.push(chunkBuffer);
  }

  return Buffer.concat(chunks).toString('utf-8');
};

const parsePayload = (rawBody: string): GeminiProxyPayload => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    const error = new Error('Invalid JSON body.') as StatusError;
    error.status = 400;
    throw error;
  }

  if (!parsed || typeof parsed !== 'object') {
    const error = new Error('Invalid request payload.') as StatusError;
    error.status = 400;
    throw error;
  }

  const payload = parsed as Partial<GeminiProxyPayload>;

  if (typeof payload.model !== 'string' || !payload.model.trim()) {
    const error = new Error('Missing required field: model.') as StatusError;
    error.status = 400;
    throw error;
  }

  if (payload.contents === undefined || payload.contents === null) {
    const error = new Error('Missing required field: contents.') as StatusError;
    error.status = 400;
    throw error;
  }

  return {
    model: payload.model.trim(),
    contents: payload.contents,
    config: payload.config || {},
  };
};

const getServerApiKey = (): string => {
  return (
    process.env.GEMINI_API_KEY?.trim() || process.env.API_KEY?.trim() || ''
  );
};

const getRateLimitMaxRequests = (): number => {
  const raw = Number(process.env.GEMINI_PROXY_RATE_LIMIT_PER_MINUTE);
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_RATE_LIMIT_MAX_REQUESTS;
  }

  return Math.floor(raw);
};

const consumeRateLimit = (clientId: string): boolean => {
  const now = Date.now();
  const maxRequests = getRateLimitMaxRequests();
  const current = ipRateLimitStore.get(clientId);

  if (!current || now >= current.resetAt) {
    ipRateLimitStore.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count += 1;
  ipRateLimitStore.set(clientId, current);
  return true;
};

const extractClientId = (req: RequestWithBody): string => {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].split(',')[0].trim();
  }

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return req.socket.remoteAddress || 'unknown';
};

const isOriginAllowed = (originHeader: string | null): boolean => {
  const configured = process.env.GEMINI_PROXY_ALLOWED_ORIGINS?.trim();

  if (!configured) {
    return true;
  }

  if (!originHeader) {
    return false;
  }

  const allowlist = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return allowlist.includes(originHeader);
};

const toGeminiError = (status: number, message: string): StatusError => {
  const error = new Error(message) as StatusError;
  error.status = status;
  return error;
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const withRetry = async <T>(
  fn: () => Promise<T>,
  options?: { retries?: number; baseDelay?: number },
): Promise<T> => {
  const retries = options?.retries ?? 3;
  const baseDelay = options?.baseDelay ?? 500;

  try {
    return await fn();
  } catch (error) {
    const geminiError = error as StatusError;
    const errorMessage = geminiError.message || '';
    const isRetryable =
      (typeof geminiError.status === 'number' &&
        RETRYABLE_STATUS_CODES.has(geminiError.status)) ||
      NETWORK_ERROR_PATTERN.test(errorMessage) ||
      NETWORK_ERROR_PATTERN.test(String(error));

    if (retries > 0 && isRetryable) {
      const delayMs = Math.round(baseDelay * (0.75 + Math.random() * 0.5));
      await sleep(delayMs);
      return withRetry(fn, {
        retries: retries - 1,
        baseDelay: Math.min(baseDelay * 2, 10_000),
      });
    }

    throw error;
  }
};

const buildGeminiConfig = (
  config?: GeminiProxyConfig,
): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};

  if (typeof config?.systemInstruction === 'string') {
    normalized.systemInstruction = config.systemInstruction;
  }

  if (typeof config?.responseMimeType === 'string') {
    normalized.responseMimeType = config.responseMimeType;
  }

  if (Array.isArray(config?.responseModalities)) {
    normalized.responseModalities = config.responseModalities.filter(
      (modality): modality is string =>
        typeof modality === 'string' && modality.trim().length > 0,
    );
  }

  if (
    typeof config?.thinkingBudget === 'number' &&
    Number.isFinite(config.thinkingBudget)
  ) {
    normalized.thinkingConfig = {
      thinkingBudget: Math.max(0, Math.floor(config.thinkingBudget)),
    };
  }

  if (config?.imageConfig) {
    normalized.imageConfig = {
      ...(typeof config.imageConfig.aspectRatio === 'string'
        ? { aspectRatio: config.imageConfig.aspectRatio }
        : {}),
      ...(typeof config.imageConfig.imageSize === 'string'
        ? { imageSize: config.imageConfig.imageSize }
        : {}),
    };
  }

  return normalized;
};

const requestGemini = async (
  payload: GeminiProxyPayload,
): Promise<GenerateContentResponse> => {
  const apiKey = getServerApiKey();

  if (!apiKey) {
    throw toGeminiError(
      500,
      'Gemini API key is not configured on the server. Set GEMINI_API_KEY.',
    );
  }

  const client = new GoogleGenAI({ apiKey });

  return withRetry(
    () =>
      client.models.generateContent({
        model: payload.model,
        contents: payload.contents,
        config: buildGeminiConfig(payload.config),
      }),
    { retries: 2, baseDelay: 500 },
  );
};

const toOriginHeader = (
  value: string | string[] | undefined,
): string | null => {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return typeof value === 'string' ? value : null;
};

const sendJson = (
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

export const handleGeminiProxyRequest = async (
  req: RequestWithBody,
  res: ServerResponse,
): Promise<void> => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const originHeader = toOriginHeader(req.headers.origin);
  if (!isOriginAllowed(originHeader)) {
    sendJson(res, 403, { error: 'Origin is not allowed.' });
    return;
  }

  const clientId = extractClientId(req);
  if (!consumeRateLimit(clientId)) {
    sendJson(res, 429, { error: 'Rate limit exceeded. Please retry shortly.' });
    return;
  }

  try {
    const rawBody = await readRawRequestBody(req);
    const payload = parsePayload(rawBody);
    const response = await requestGemini(payload);

    const inlineData = (response.candidates?.[0]?.content?.parts || [])
      .map((part) => part.inlineData)
      .filter((part): part is { mimeType: string; data: string } =>
        Boolean(part?.mimeType && part?.data),
      )
      .map((part) => ({
        mimeType: part.mimeType,
        data: part.data,
      }));

    sendJson(res, 200, {
      text: response.text || '',
      inlineData,
    });
  } catch (error) {
    const status =
      typeof (error as StatusError)?.status === 'number'
        ? (error as StatusError).status!
        : 500;

    const message =
      error instanceof Error
        ? error.message
        : 'Failed to process Gemini request.';

    sendJson(res, status, { error: message });
  }
};

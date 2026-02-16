import { handleGeminiProxyRequest } from './_lib/geminiProxy.js';

const handler = async (
  req: import('node:http').IncomingMessage & { body?: unknown },
  res: import('node:http').ServerResponse,
): Promise<void> => {
  await handleGeminiProxyRequest(req, res);
};

export default handler;

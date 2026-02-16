import { FileNode, GitHubRateLimitInfo } from '../types';
import { abortIfSignaled, isAbortError } from './abortUtils';

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubRequestOptions {
  signal?: AbortSignal;
  onRateLimitUpdate?: (info: GitHubRateLimitInfo) => void;
}

const MIN_GITHUB_REQUEST_INTERVAL_MS = 120;
const LOW_REMAINING_THRESHOLD = 8;
const CRITICAL_REMAINING_THRESHOLD = 2;
const MAX_QUEUE_DELAY_MS = 20_000;

let githubQueue: Promise<void> = Promise.resolve();
let lastGitHubRequestAt = 0;
let lastKnownRateLimit: GitHubRateLimitInfo = {
  limit: null,
  remaining: null,
  resetAt: null,
};

const sleepWithAbort = async (
  ms: number,
  signal?: AbortSignal,
): Promise<void> => {
  if (ms <= 0) {
    return;
  }

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

const parseRateLimitNumber = (raw: string | null): number | null => {
  if (!raw) {
    return null;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
};

const parseRateLimitInfo = (
  headers?: Pick<Headers, 'get'> | null,
): GitHubRateLimitInfo => {
  const limit = parseRateLimitNumber(headers?.get('x-ratelimit-limit') || null);
  const remaining = parseRateLimitNumber(
    headers?.get('x-ratelimit-remaining') || null,
  );
  const resetSeconds = parseRateLimitNumber(
    headers?.get('x-ratelimit-reset') || null,
  );

  return {
    limit,
    remaining,
    resetAt: resetSeconds !== null ? resetSeconds * 1000 : null,
  };
};

const mergeRateLimitInfo = (
  next: GitHubRateLimitInfo,
  onRateLimitUpdate?: (info: GitHubRateLimitInfo) => void,
) => {
  const merged: GitHubRateLimitInfo = {
    limit: next.limit ?? lastKnownRateLimit.limit,
    remaining: next.remaining ?? lastKnownRateLimit.remaining,
    resetAt: next.resetAt ?? lastKnownRateLimit.resetAt,
  };
  lastKnownRateLimit = merged;
  onRateLimitUpdate?.(merged);
};

const getAdaptiveDelay = (rateLimit: GitHubRateLimitInfo): number => {
  const now = Date.now();
  const resetAt = rateLimit.resetAt;
  const remaining = rateLimit.remaining;

  if (
    remaining !== null &&
    resetAt !== null &&
    remaining <= CRITICAL_REMAINING_THRESHOLD &&
    resetAt > now
  ) {
    const windowMs = resetAt - now;
    const perRequestDelay = Math.ceil(windowMs / Math.max(remaining + 1, 1));
    return Math.min(Math.max(perRequestDelay, 2000), MAX_QUEUE_DELAY_MS);
  }

  if (remaining !== null && remaining <= LOW_REMAINING_THRESHOLD) {
    return 650;
  }

  return 0;
};

const enqueueGitHubRequest = async <T>(
  task: () => Promise<T>,
  options?: GitHubRequestOptions,
): Promise<T> => {
  const signal = options?.signal;

  const previous = githubQueue;
  let releaseQueue = () => {};
  githubQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previous;

  try {
    abortIfSignaled(signal);
    const now = Date.now();
    const minIntervalWait = Math.max(
      MIN_GITHUB_REQUEST_INTERVAL_MS - (now - lastGitHubRequestAt),
      0,
    );
    await sleepWithAbort(minIntervalWait, signal);

    const adaptiveDelay = getAdaptiveDelay(lastKnownRateLimit);
    await sleepWithAbort(adaptiveDelay, signal);

    const result = await task();
    lastGitHubRequestAt = Date.now();
    return result;
  } finally {
    releaseQueue();
  }
};

const githubFetch = async (
  url: string,
  options?: GitHubRequestOptions,
): Promise<Response> => {
  const signal = options?.signal;
  const onRateLimitUpdate = options?.onRateLimitUpdate;

  const response = await enqueueGitHubRequest(
    () => fetch(url, { signal }),
    options,
  );

  mergeRateLimitInfo(parseRateLimitInfo(response.headers), onRateLimitUpdate);
  return response;
};

const getMimeType = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'ico':
      return 'image/x-icon';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    default:
      return 'application/octet-stream';
  }
};

const GITHUB_HOSTNAMES = new Set(['github.com', 'www.github.com']);
const GITHUB_OWNER_REGEX = /^[A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?$/;
const GITHUB_REPO_REGEX = /^[A-Za-z\d._-]+$/;

const withProtocol = (input: string): string => {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
  return `https://${input}`;
};

export const normalizeGitHubRepoUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const urlObj = new URL(withProtocol(trimmed));
    const hostname = urlObj.hostname.toLowerCase();
    if (!GITHUB_HOSTNAMES.has(hostname)) {
      return null;
    }

    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    const owner = parts[0];
    const rawRepo = parts[1];
    const repo = rawRepo.endsWith('.git')
      ? rawRepo.slice(0, rawRepo.length - 4)
      : rawRepo;

    if (!owner || !repo) {
      return null;
    }

    if (!GITHUB_OWNER_REGEX.test(owner) || !GITHUB_REPO_REGEX.test(repo)) {
      return null;
    }

    return `https://github.com/${owner}/${repo}`;
  } catch {
    return null;
  }
};

export const parseGitHubUrl = (url: string) => {
  const normalizedUrl = normalizeGitHubRepoUrl(url);
  if (!normalizedUrl) {
    return null;
  }

  try {
    const urlObj = new URL(normalizedUrl);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    return {
      owner: parts[0],
      repo: parts[1],
      // For simplicity in this demo, we ignore sub-paths for the root fetch and assume root of repo
      // unless we want to support partial repo fetch. Let's stick to root for "Auto-detect".
      branch: 'main', // default fallback, logic can be enhanced to detect default branch
    };
  } catch {
    return null;
  }
};

const buildFileTree = (items: GitHubTreeItem[]): FileNode[] => {
  const root: FileNode[] = [];
  const map: Record<string, FileNode> = {};

  // Sort by path length to ensure parents are created before children if we were building sequentially,
  // but we use a 2-pass approach so order doesn't strictly matter for existence, but helps.
  items.sort((a, b) => a.path.localeCompare(b.path));

  // 1. Create all nodes
  items.forEach((item) => {
    // We only care about blobs (files) and trees (dirs)
    if (item.type !== 'blob' && item.type !== 'tree') return;

    const name = item.path.split('/').pop() || '';
    map[item.path] = {
      name: name,
      path: item.path,
      type: item.type === 'tree' ? 'dir' : 'file',
      status: 'pending',
      children: item.type === 'tree' ? [] : undefined,
    };
  });

  // 2. Attach to parents
  items.forEach((item) => {
    const node = map[item.path];
    if (!node) return;

    const parts = item.path.split('/');
    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = map[parentPath];
      if (parent && parent.children) {
        parent.children.push(node);
      } else {
        // If parent not found (shouldn't happen with recursive=1 unless truncated), add to root
        root.push(node);
      }
    }
  });

  // 3. Sort nodes (Dirs first, then alphabetical)
  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });
    nodes.forEach((n) => {
      if (n.children) sortNodes(n.children);
    });
  };
  sortNodes(root);

  return root;
};

export const fetchRepoStructure = async (
  url: string,
  options?: GitHubRequestOptions,
): Promise<FileNode[]> => {
  const { signal } = options || {};
  const onRateLimitUpdate = options?.onRateLimitUpdate;
  abortIfSignaled(signal);

  const repoInfo = parseGitHubUrl(url);
  if (!repoInfo)
    throw new Error(
      'Invalid GitHub URL. Format should be: https://github.com/owner/repo',
    );

  // 1. Get the default branch
  let branch = 'main';
  try {
    abortIfSignaled(signal);
    const repoDetailsRes = await githubFetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`,
      { signal, onRateLimitUpdate },
    );

    if (repoDetailsRes.ok) {
      const details = await repoDetailsRes.json();
      branch = details.default_branch || 'main';
    } else if (repoDetailsRes.status === 404) {
      throw new Error(
        'Repository not found (404). Check if private or URL is incorrect.',
      );
    } else if (repoDetailsRes.status === 403 || repoDetailsRes.status === 429) {
      throw new Error('GitHub API rate limit exceeded.');
    }
  } catch (e: unknown) {
    if (isAbortError(e)) {
      throw e;
    }
    if (e instanceof Error) {
      if (e.message.includes('rate limit') || e.message.includes('not found'))
        throw e;
    }
    console.warn("Could not fetch repo details, assuming 'main' branch.", e);
  }

  // 2. Fetch Recursive Tree
  const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${branch}?recursive=1`;

  abortIfSignaled(signal);
  const response = await githubFetch(apiUrl, { signal, onRateLimitUpdate });

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error(
        'GitHub API rate limit exceeded. Please try again later or use a different IP.',
      );
    }
    if (response.status === 404) {
      throw new Error(
        `Repository structure not found (404) for branch '${branch}'.`,
      );
    }
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    throw new Error(
      `Failed to fetch repo tree: ${response.status}${statusText}`,
    );
  }

  const data: GitHubTreeResponse = await response.json();
  return buildFileTree(data.tree);
};

export const fetchFileContent = async (
  url: string,
  path: string,
  options?: GitHubRequestOptions,
): Promise<string> => {
  const { signal } = options || {};
  const onRateLimitUpdate = options?.onRateLimitUpdate;
  abortIfSignaled(signal);

  const repoInfo = parseGitHubUrl(url);
  if (!repoInfo) throw new Error('Invalid URL');

  const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${path}`;

  const response = await githubFetch(apiUrl, { signal, onRateLimitUpdate });

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error('GitHub API rate limit exceeded.');
    }
    if (response.status === 404) {
      throw new Error(`File not found: ${path}`);
    }
    throw new Error(`Failed to fetch file: ${response.status}`);
  }

  const data = await response.json();

  // Handle Images: Return Data URI or Download URL
  if (/\.(png|jpg|jpeg|gif|ico|svg|webp|bmp)$/i.test(path)) {
    if (data.content && data.encoding === 'base64') {
      const mimeType = getMimeType(path);
      const cleanBase64 = String(data.content).replace(/\n/g, '');
      return `data:${mimeType};base64,${cleanBase64}`;
    }
    if (data.download_url) {
      return data.download_url as string;
    }
  }

  if (data.content && data.encoding === 'base64') {
    // Robust decoding using TextDecoder for unicode support
    try {
      const binaryString = atob(String(data.content).replace(/\n/g, ''));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch (_e) {
      // Legacy fallback
      try {
        return decodeURIComponent(
          escape(atob(String(data.content).replace(/\n/g, ''))),
        );
      } catch (_e2) {
        return atob(String(data.content).replace(/\n/g, ''));
      }
    }
  }

  throw new Error('Could not decode file content or format not supported.');
};

// Mock data with nested structure
export const getMockRepo = (): FileNode[] => [
  {
    name: 'src',
    path: 'src',
    type: 'dir',
    status: 'pending',
    children: [
      {
        name: 'components',
        path: 'src/components',
        type: 'dir',
        status: 'pending',
        children: [
          {
            name: 'Header.js',
            path: 'src/components/Header.js',
            type: 'file',
            status: 'pending',
          },
          {
            name: 'Footer.js',
            path: 'src/components/Footer.js',
            type: 'file',
            status: 'pending',
          },
        ],
      },
      { name: 'app.js', path: 'src/app.js', type: 'file', status: 'pending' },
      {
        name: 'utils.js',
        path: 'src/utils.js',
        type: 'file',
        status: 'pending',
      },
      {
        name: 'config.js',
        path: 'src/config.js',
        type: 'file',
        status: 'pending',
      },
    ],
  },
  {
    name: 'public',
    path: 'public',
    type: 'dir',
    status: 'pending',
    children: [
      {
        name: 'index.html',
        path: 'public/index.html',
        type: 'file',
        status: 'pending',
      },
      {
        name: 'favicon.ico',
        path: 'public/favicon.ico',
        type: 'file',
        status: 'pending',
      },
    ],
  },
  {
    name: 'package.json',
    path: 'package.json',
    type: 'file',
    status: 'pending',
  },
  { name: 'README.md', path: 'README.md', type: 'file', status: 'pending' },
  { name: 'styles.css', path: 'styles.css', type: 'file', status: 'pending' },
];

export const getMockReadme = () => `
# Legacy Todo App
This is a simple jQuery based Todo application.
Structure:
- src/app.js: Main logic
`;

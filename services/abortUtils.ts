export const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (error.name === 'AbortError' || message.includes('aborted')) {
      return true;
    }
  }

  const maybeError = error as {
    name?: string;
    code?: string;
    message?: string;
  };

  if (maybeError?.name === 'AbortError' || maybeError?.code === 'ABORT_ERR') {
    return true;
  }

  return Boolean(
    maybeError?.message?.toLowerCase().includes('aborted') ||
    maybeError?.message?.toLowerCase().includes('abort'),
  );
};

export const abortIfSignaled = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new DOMException('Operation aborted', 'AbortError');
  }
};

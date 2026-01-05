/**
 * nostr-battle-room - Retry Utilities
 * Exponential backoff retry logic for network operations
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Called on each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) {
        break;
      }

      // Call onRetry callback if provided
      opts.onRetry?.(attempt, lastError, delay);

      // Wait before next retry
      await sleep(delay);

      // Increase delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Create a promise that rejects after specified timeout
 *
 * @example
 * ```typescript
 * const result = await Promise.race([
 *   fetchData(),
 *   timeout(5000, 'Fetch timed out')
 * ]);
 * ```
 */
export function timeout<T = never>(ms: number, message = 'Operation timed out'): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Execute a function with timeout
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => fetchData(),
 *   5000,
 *   'Fetch timed out'
 * );
 * ```
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
  message = 'Operation timed out'
): Promise<T> {
  return Promise.race([fn(), timeout<T>(ms, message)]);
}

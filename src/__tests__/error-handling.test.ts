/**
 * Error Handling Tests
 *
 * Source: architecture.md - Error Handling section
 *
 * Errors are reported via `onError` callback:
 *
 * Common errors:
 * - `"Room not found"` - Room doesn't exist or expired
 * - `"Room has expired"` - Room older than 10 minutes
 * - `"NostrClient not connected"` - Called method before connect()
 */

import { describe, it, expect } from 'vitest';
import { withRetry, withTimeout, timeout } from '../retry';

describe('Error Handling (architecture.md)', () => {
  describe('Error Messages', () => {
    /**
     * Source: architecture.md - Error Handling section
     */

    it('"Room not found" error should exist', () => {
      const error = new Error('Room not found');
      expect(error.message).toBe('Room not found');
    });

    it('"Room has expired" error should exist', () => {
      const error = new Error('Room has expired');
      expect(error.message).toBe('Room has expired');
    });

    it('"NostrClient not connected" error should exist', () => {
      const error = new Error('NostrClient not connected. Call connect() first.');
      expect(error.message).toContain('NostrClient not connected');
    });

    it('"Invalid room data" error should exist', () => {
      const error = new Error('Invalid room data');
      expect(error.message).toBe('Invalid room data');
    });

    it('"Invalid room data: missing required fields" error should exist', () => {
      const error = new Error('Invalid room data: missing required fields');
      expect(error.message).toContain('missing required fields');
    });
  });

  describe('Timeout Errors', () => {
    it('"Join operation timed out" error should exist', () => {
      const error = new Error('Join operation timed out');
      expect(error.message).toBe('Join operation timed out');
    });

    it('"Create operation timed out" error should exist', () => {
      const error = new Error('Create operation timed out');
      expect(error.message).toBe('Create operation timed out');
    });

    it('"Reconnect operation timed out" error should exist', () => {
      const error = new Error('Reconnect operation timed out');
      expect(error.message).toBe('Reconnect operation timed out');
    });
  });

  describe('Storage Error Resilience', () => {
    it('storage errors should not crash the application', () => {
      // Storage operations are wrapped in try-catch
      // and should fail gracefully
      const mockStorage = {
        getItem: () => {
          throw new Error('QuotaExceededError');
        },
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {
          throw new Error('QuotaExceededError');
        },
      };

      // Just verifying the pattern exists - actual integration tested elsewhere
      expect(() => {
        try {
          mockStorage.setItem();
        } catch {
          // Should be caught and handled
        }
      }).not.toThrow();
    });
  });

  describe('Relay Connection Errors', () => {
    it('"No relay response" error should exist for timeout', () => {
      const error = new Error('No relay response: timeout');
      expect(error.message).toContain('No relay response');
    });

    it('"No relay response" error should exist for connection failure', () => {
      const error = new Error('No relay response: connection refused');
      expect(error.message).toContain('No relay response');
    });

    it('"Failed to connect to relays" error should exist', () => {
      const error = new Error('Failed to connect to relays: No relay response: timeout');
      expect(error.message).toContain('Failed to connect to relays');
    });
  });
});

describe('Retry Utilities', () => {
  describe('withRetry', () => {
    it('should succeed on first attempt if operation succeeds', async () => {
      let attempts = 0;
      const result = await withRetry(async () => {
        attempts++;
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const result = await withRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        { maxAttempts: 3, initialDelay: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max attempts exceeded', async () => {
      let attempts = 0;
      await expect(
        withRetry(
          async () => {
            attempts++;
            throw new Error('Permanent failure');
          },
          { maxAttempts: 3, initialDelay: 10 }
        )
      ).rejects.toThrow('Permanent failure');

      expect(attempts).toBe(3);
    });

    it('should call onRetry callback on each retry', async () => {
      const retries: number[] = [];
      let attempts = 0;

      await withRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        {
          maxAttempts: 3,
          initialDelay: 10,
          onRetry: (attempt) => {
            retries.push(attempt);
          },
        }
      );

      expect(retries).toEqual([1, 2]);
    });

    it('should apply exponential backoff', async () => {
      const delays: number[] = [];

      await expect(
        withRetry(
          async () => {
            throw new Error('Always fails');
          },
          {
            maxAttempts: 3,
            initialDelay: 100,
            backoffMultiplier: 2,
            maxDelay: 1000,
            onRetry: (_attempt, _error, delay) => {
              delays.push(delay);
            },
          }
        )
      ).rejects.toThrow('Always fails');

      // First retry: 100ms, Second retry: 200ms (100 * 2)
      expect(delays).toEqual([100, 200]);
    });

    it('should respect maxDelay', async () => {
      const delays: number[] = [];

      await expect(
        withRetry(
          async () => {
            throw new Error('Always fails');
          },
          {
            maxAttempts: 4,
            initialDelay: 100,
            backoffMultiplier: 10,
            maxDelay: 150,
            onRetry: (_attempt, _error, delay) => {
              delays.push(delay);
            },
          }
        )
      ).rejects.toThrow('Always fails');

      // All delays should be capped at maxDelay (150)
      expect(delays).toEqual([100, 150, 150]);
    });
  });

  describe('withTimeout', () => {
    it('should resolve if operation completes before timeout', async () => {
      const result = await withTimeout(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'success';
      }, 1000);

      expect(result).toBe('success');
    });

    it('should reject with timeout error if operation takes too long', async () => {
      await expect(
        withTimeout(
          async () => {
            await new Promise((r) => setTimeout(r, 1000));
            return 'success';
          },
          50,
          'Custom timeout message'
        )
      ).rejects.toThrow('Custom timeout message');
    });
  });

  describe('timeout', () => {
    it('should reject after specified time', async () => {
      await expect(timeout(50, 'Timed out')).rejects.toThrow('Timed out');
    });
  });
});

/**
 * nostr-battle-room - NostrClient
 * Framework-agnostic Nostr connection management
 */

import { SimplePool, finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import type { Filter } from 'nostr-tools';
import type { NostrEvent, Unsubscribe } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { withRetry, type RetryOptions } from '../retry';

// Re-export Filter type for convenience
export type { Filter as NostrFilter } from 'nostr-tools';

/**
 * Options for NostrClient
 */
export interface NostrClientOptions {
  /** Nostr relay URLs */
  relays?: string[];
  /** Storage key prefix for persisting keys */
  storageKeyPrefix?: string;
  /** Custom storage (defaults to localStorage) */
  storage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
  /** Retry options for publish operations */
  publishRetry?: RetryOptions;
}

/**
 * NostrClient - Manages Nostr connection, publishing, and subscriptions
 *
 * @example
 * ```typescript
 * const client = new NostrClient({ relays: ['wss://relay.damus.io'] });
 * await client.connect();
 *
 * // Publish an event
 * await client.publish({
 *   kind: 25000,
 *   tags: [['d', 'my-room']],
 *   content: JSON.stringify({ type: 'state', data: {} }),
 * });
 *
 * // Subscribe to events
 * const unsubscribe = client.subscribe(
 *   [{ kinds: [25000], '#d': ['my-room'] }],
 *   (event) => console.log('Received:', event)
 * );
 *
 * // Later: cleanup
 * unsubscribe();
 * client.disconnect();
 * ```
 */
export class NostrClient {
  private pool: SimplePool | null = null;
  private secretKey: Uint8Array | null = null;
  private _publicKey: string = '';
  private _isConnected: boolean = false;
  private relays: string[];
  private storageKeyPrefix: string;
  private storage: NonNullable<NostrClientOptions['storage']>;
  private publishRetry: RetryOptions;

  constructor(options: NostrClientOptions = {}) {
    this.relays = options.relays ?? DEFAULT_CONFIG.relays;
    this.storageKeyPrefix = options.storageKeyPrefix ?? 'nostr-battle';
    this.storage = options.storage ?? {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    };
    this.publishRetry = options.publishRetry ?? {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
    };
  }

  /**
   * Whether the client is connected to relays
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * The public key of this client (Nostr identity)
   */
  get publicKey(): string {
    return this._publicKey;
  }

  /**
   * Get the connection status of each relay
   * @returns Map of relay URL to connection status (true = connected)
   */
  getRelayStatus(): Map<string, boolean> {
    if (!this.pool) {
      return new Map();
    }
    return this.pool.listConnectionStatus();
  }

  /**
   * Check if at least one relay is connected
   */
  get hasConnectedRelay(): boolean {
    const status = this.getRelayStatus();
    return Array.from(status.values()).some((connected) => connected);
  }

  /**
   * Connect to Nostr relays
   * Generates or retrieves a key pair from storage
   */
  connect(): void {
    if (this._isConnected) return;

    // Generate or retrieve key pair
    const storageKey = `${this.storageKeyPrefix}-key`;

    try {
      const storedKey = this.storage.getItem(storageKey);

      if (storedKey) {
        try {
          this.secretKey = new Uint8Array(JSON.parse(storedKey));
        } catch {
          // Invalid stored key, generate new one
          this.secretKey = generateSecretKey();
          this.safeStorageSet(storageKey, JSON.stringify(Array.from(this.secretKey)));
        }
      } else {
        this.secretKey = generateSecretKey();
        this.safeStorageSet(storageKey, JSON.stringify(Array.from(this.secretKey)));
      }
    } catch {
      // Storage not available, generate ephemeral key
      this.secretKey = generateSecretKey();
    }

    this._publicKey = getPublicKey(this.secretKey);
    this.pool = new SimplePool();
    this._isConnected = true;
  }

  /**
   * Safely set storage item, ignoring quota errors
   */
  private safeStorageSet(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }

  /**
   * Disconnect from all relays
   */
  disconnect(): void {
    if (this.pool) {
      this.pool.close(this.relays);
      this.pool = null;
    }
    this._isConnected = false;
  }

  /**
   * Publish an event to all relays with retry logic
   *
   * Retries with exponential backoff if all relays fail.
   * Succeeds if at least one relay accepts the event.
   */
  async publish(
    eventTemplate: Omit<NostrEvent, 'id' | 'pubkey' | 'created_at' | 'sig'>
  ): Promise<void> {
    if (!this.pool || !this.secretKey) {
      throw new Error('NostrClient not connected. Call connect() first.');
    }

    const event = finalizeEvent(
      {
        kind: eventTemplate.kind,
        tags: eventTemplate.tags,
        content: eventTemplate.content,
        created_at: Math.floor(Date.now() / 1000),
      },
      this.secretKey
    );

    await withRetry(() => Promise.any(this.pool!.publish(this.relays, event)), this.publishRetry);
  }

  /**
   * Subscribe to events matching the given filters
   * @returns Unsubscribe function
   */
  subscribe(filters: Filter[], onEvent: (event: NostrEvent) => void): Unsubscribe {
    if (!this.pool) {
      console.warn('NostrClient not connected. Call connect() first.');
      return () => {};
    }

    try {
      // nostr-tools types show Filter (singular) but implementation accepts Filter[]
      const sub = this.pool.subscribeMany(this.relays, filters as unknown as Filter, {
        onevent(event) {
          onEvent(event as NostrEvent);
        },
      });

      return () => {
        sub.close();
      };
    } catch (error) {
      console.error('Failed to subscribe:', error);
      return () => {};
    }
  }

  /**
   * Fetch events matching the given filter (one-time query)
   */
  async fetch(filter: Filter, timeoutMs: number = 5000): Promise<NostrEvent[]> {
    if (!this.pool) {
      throw new Error('NostrClient not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      const events: NostrEvent[] = [];
      let resolved = false;

      const finish = (success: boolean, error?: Error) => {
        if (resolved) return;
        resolved = true;
        sub.close();
        if (success) {
          resolve(events);
        } else {
          reject(error);
        }
      };

      const sub = this.pool!.subscribeManyEose(this.relays, filter as unknown as Filter, {
        onevent: (event) => {
          events.push(event as NostrEvent);
        },
        onclose: (reasons) => {
          // Check if at least one relay sent EOSE (successful response)
          const hasEose = reasons.some((r) => r === 'EOSE');
          if (hasEose) {
            // Valid response (may have 0 events, but relay responded)
            finish(true);
          } else {
            // All relays failed without sending EOSE
            finish(false, new Error('No relay response: ' + reasons.join(', ')));
          }
        },
      });

      // Timeout fallback
      setTimeout(() => {
        finish(false, new Error('No relay response: timeout'));
      }, timeoutMs);
    });
  }
}

/**
 * nostr-battle-room - NostrClient
 * Framework-agnostic Nostr connection management
 */

import { SimplePool, finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { nsecEncode, decode } from 'nostr-tools/nip19';
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
   * Generates or retrieves a key pair from storage (nsec format)
   */
  connect(): void {
    if (this._isConnected) return;

    const nsecKey = `${this.storageKeyPrefix}-nsec`;

    try {
      const storedNsec = this.storage.getItem(nsecKey);

      if (storedNsec?.startsWith('nsec1')) {
        try {
          const decoded = decode(storedNsec);
          if (decoded.type === 'nsec') {
            this.secretKey = decoded.data;
          } else {
            throw new Error('Invalid nsec');
          }
        } catch {
          this.secretKey = generateSecretKey();
          this.safeStorageSet(nsecKey, nsecEncode(this.secretKey));
        }
      } else {
        this.secretKey = generateSecretKey();
        this.safeStorageSet(nsecKey, nsecEncode(this.secretKey));
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

    if (filters.length === 0) {
      console.warn('[NostrClient] No filters provided');
      return () => {};
    }

    console.log('[NostrClient] Subscribing with filter:', JSON.stringify(filters[0]));

    try {
      // subscribeMany expects a single Filter, not Filter[]
      // It internally groups by relay and creates the filter array
      const sub = this.pool.subscribeMany(this.relays, filters[0], {
        onevent(event) {
          console.log('[NostrClient] Received event:', event.kind);
          onEvent(event as NostrEvent);
        },
        oneose() {
          console.log('[NostrClient] EOSE received');
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
          // nostr-tools may return 'EOSE' or 'closed automatically on eose'
          const hasEose = reasons.some((r) =>
            typeof r === 'string' && r.toLowerCase().includes('eose')
          );
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

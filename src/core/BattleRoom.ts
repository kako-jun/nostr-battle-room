/**
 * nostr-battle-room - BattleRoom
 * Main class for managing multiplayer game rooms over Nostr
 */

import { NostrClient } from './NostrClient';
import type {
  BattleRoomConfig,
  BattleRoomCallbacks,
  RoomState,
  OpponentBase,
  NostrEvent,
  StoredRoomData,
  Unsubscribe,
} from '../types';
import {
  DEFAULT_CONFIG,
  INITIAL_ROOM_STATE,
  NOSTR_KINDS,
  createRoomTag,
  generateSeed,
  generateRoomId,
} from '../types';
import { withTimeout } from '../retry';

/**
 * Internal opponent state (mutable)
 */
interface InternalOpponentState<TGameState> extends OpponentBase {
  gameState: TGameState | null;
}

/**
 * BattleRoom - Manages a multiplayer game room over Nostr
 *
 * @example
 * ```typescript
 * interface MyGameState {
 *   score: number;
 *   position: { x: number; y: number };
 * }
 *
 * const room = new BattleRoom<MyGameState>({
 *   gameId: 'my-game',
 *   relays: ['wss://relay.damus.io'],
 * });
 *
 * room.on('opponentState', (state) => {
 *   console.log('Opponent score:', state.score);
 * });
 *
 * const url = await room.create();
 * console.log('Share this URL:', url);
 * ```
 */
export class BattleRoom<TGameState = Record<string, unknown>> {
  private client: NostrClient;
  private config: Required<BattleRoomConfig>;
  private callbacks: BattleRoomCallbacks<TGameState> = {};

  private _roomState: RoomState = { ...INITIAL_ROOM_STATE };
  private _opponent: InternalOpponentState<TGameState> | null = null;

  private unsubscribe: Unsubscribe | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private disconnectCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastStateUpdate: number = 0;

  private storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };

  constructor(config: BattleRoomConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.client = new NostrClient({
      relays: this.config.relays,
      storageKeyPrefix: this.config.gameId,
    });

    // Default to localStorage, with fallback for non-browser environments
    this.storage =
      typeof localStorage !== 'undefined'
        ? localStorage
        : {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
  }

  // ===========================================================================
  // Public Getters
  // ===========================================================================

  /** Current room state */
  get roomState(): Readonly<RoomState> {
    return this._roomState;
  }

  /** Current opponent state (null if no opponent) */
  get opponent(): Readonly<InternalOpponentState<TGameState>> | null {
    return this._opponent;
  }

  /** Whether connected to Nostr relays */
  get isConnected(): boolean {
    return this.client.isConnected;
  }

  /** This player's public key */
  get publicKey(): string {
    return this.client.publicKey;
  }

  /**
   * Get the connection status of each relay
   */
  getRelayStatus(): Map<string, boolean> {
    return this.client.getRelayStatus();
  }

  /**
   * Check if at least one relay is connected
   */
  get hasConnectedRelay(): boolean {
    return this.client.hasConnectedRelay;
  }

  // ===========================================================================
  // Event Registration
  // ===========================================================================

  /**
   * Register event callback for opponentJoin
   */
  onOpponentJoin(callback: (publicKey: string) => void): this {
    this.callbacks.onOpponentJoin = callback;
    return this;
  }

  /**
   * Register event callback for opponentState
   */
  onOpponentState(callback: (state: TGameState) => void): this {
    this.callbacks.onOpponentState = callback;
    return this;
  }

  /**
   * Register event callback for opponentDisconnect
   */
  onOpponentDisconnect(callback: () => void): this {
    this.callbacks.onOpponentDisconnect = callback;
    return this;
  }

  /**
   * Register event callback for opponentGameOver
   */
  onOpponentGameOver(callback: (reason: string, finalScore?: number) => void): this {
    this.callbacks.onOpponentGameOver = callback;
    return this;
  }

  /**
   * Register event callback for rematchRequested
   */
  onRematchRequested(callback: () => void): this {
    this.callbacks.onRematchRequested = callback;
    return this;
  }

  /**
   * Register event callback for rematchStart
   */
  onRematchStart(callback: (newSeed: number) => void): this {
    this.callbacks.onRematchStart = callback;
    return this;
  }

  /**
   * Register event callback for error
   */
  onError(callback: (error: Error) => void): this {
    this.callbacks.onError = callback;
    return this;
  }

  // ===========================================================================
  // Connection
  // ===========================================================================

  /**
   * Connect to Nostr relays
   */
  connect(): void {
    this.client.connect();
  }

  /**
   * Disconnect from relays and clean up
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.stopDisconnectCheck();
    this.unsubscribe?.();
    this.client.disconnect();
  }

  // ===========================================================================
  // Room Management
  // ===========================================================================

  /**
   * Create a new room
   *
   * Times out after joinTimeout (default: 30 seconds)
   * @returns Room URL (e.g., "https://example.com/battle/abc123")
   */
  async create(baseUrl?: string): Promise<string> {
    const timeoutMs = this.config.joinTimeout ?? DEFAULT_CONFIG.joinTimeout;

    try {
      return await withTimeout(
        () => this.createInternal(baseUrl),
        timeoutMs,
        'Create operation timed out'
      );
    } catch (error) {
      // Reset state on any error
      this._roomState = { ...INITIAL_ROOM_STATE };
      this.clearRoom();
      throw error;
    }
  }

  /**
   * Internal create implementation
   */
  private async createInternal(baseUrl?: string): Promise<string> {
    if (!this.client.isConnected) {
      this.client.connect();
    }

    const roomId = generateRoomId();
    const seed = generateSeed();
    const createdAt = Date.now();

    this._roomState = {
      roomId,
      status: 'creating',
      isHost: true,
      seed,
      createdAt,
    };

    // Publish room creation event
    await this.client.publish({
      kind: NOSTR_KINDS.ROOM,
      tags: [
        ['d', createRoomTag(this.config.gameId, roomId)],
        ['t', this.config.gameId],
      ],
      content: JSON.stringify({
        type: 'room',
        status: 'waiting',
        seed,
        hostPubkey: this.client.publicKey,
      }),
    });

    // Only save and subscribe after successful publish
    this._roomState = { ...this._roomState, status: 'waiting' };
    this.saveRoom({ roomId, isHost: true, seed, createdAt });
    this.subscribeToRoom(roomId);

    const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}/battle/${roomId}`;
  }

  /**
   * Join an existing room
   *
   * Times out after joinTimeout (default: 30 seconds)
   */
  async join(roomId: string): Promise<void> {
    const timeoutMs = this.config.joinTimeout ?? DEFAULT_CONFIG.joinTimeout;

    try {
      await withTimeout(() => this.joinInternal(roomId), timeoutMs, 'Join operation timed out');
    } catch (error) {
      // Reset state on any error
      this._roomState = { ...INITIAL_ROOM_STATE };
      throw error;
    }
  }

  /**
   * Internal join implementation
   */
  private async joinInternal(roomId: string): Promise<void> {
    if (!this.client.isConnected) {
      this.client.connect();
    }

    this._roomState = {
      ...this._roomState,
      roomId,
      status: 'joining',
      isHost: false,
    };

    // Fetch room info
    let roomEvents: NostrEvent[];
    try {
      roomEvents = await this.client.fetch(
        {
          kinds: [NOSTR_KINDS.ROOM],
          '#d': [createRoomTag(this.config.gameId, roomId)],
          limit: 1,
        },
        2000
      );
    } catch (error) {
      // Relay connection failed
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to relays: ${message}`);
    }

    if (roomEvents.length === 0) {
      throw new Error('Room not found');
    }

    let roomContent: { seed: number; hostPubkey: string };
    try {
      roomContent = JSON.parse(roomEvents[0].content);
    } catch {
      throw new Error('Invalid room data');
    }

    if (!roomContent.seed || !roomContent.hostPubkey) {
      throw new Error('Invalid room data: missing required fields');
    }

    const roomCreatedAt = (roomEvents[0].created_at ?? 0) * 1000;

    if (this.isExpired(roomCreatedAt)) {
      throw new Error('Room has expired');
    }

    this._roomState = {
      ...this._roomState,
      seed: roomContent.seed,
      status: 'ready',
      createdAt: roomCreatedAt,
    };

    this._opponent = this.createInitialOpponent(roomContent.hostPubkey);

    this.saveRoom({
      roomId,
      isHost: false,
      seed: roomContent.seed,
      createdAt: roomCreatedAt,
      opponentPubkey: roomContent.hostPubkey,
    });

    // Send join event
    await this.client.publish({
      kind: NOSTR_KINDS.EPHEMERAL,
      tags: [['d', createRoomTag(this.config.gameId, roomId)]],
      content: JSON.stringify({
        type: 'join',
        playerPubkey: this.client.publicKey,
      }),
    });

    this.subscribeToRoom(roomId);
  }

  /**
   * Leave the current room
   */
  leave(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.stopHeartbeat();
    this.stopDisconnectCheck();
    this.clearRoom();
    this._roomState = { ...INITIAL_ROOM_STATE };
    this._opponent = null;
  }

  /**
   * Attempt to reconnect to a previously joined room
   */
  async reconnect(): Promise<boolean> {
    const timeoutMs = this.config.joinTimeout ?? DEFAULT_CONFIG.joinTimeout;

    try {
      return await withTimeout(
        () => this.reconnectInternal(),
        timeoutMs,
        'Reconnect operation timed out'
      );
    } catch {
      // Reset state on any error
      this._roomState = { ...INITIAL_ROOM_STATE };
      this._opponent = null;
      this.clearRoom();
      // Don't throw - return false to indicate reconnect failed
      return false;
    }
  }

  /**
   * Internal reconnection logic
   */
  private async reconnectInternal(): Promise<boolean> {
    const stored = this.loadRoom();
    if (!stored) return false;

    if (!this.client.isConnected) {
      this.client.connect();
    }

    this._roomState = {
      roomId: stored.roomId,
      status: 'joining',
      isHost: stored.isHost,
      seed: stored.seed,
      createdAt: stored.createdAt,
    };

    if (stored.opponentPubkey) {
      this._opponent = {
        ...this.createInitialOpponent(stored.opponentPubkey),
        isConnected: false,
        lastHeartbeat: 0,
      };
    }

    this.subscribeToRoom(stored.roomId);

    // Announce reconnection
    await this.client.publish({
      kind: NOSTR_KINDS.EPHEMERAL,
      tags: [['d', createRoomTag(this.config.gameId, stored.roomId)]],
      content: JSON.stringify({
        type: 'join',
        playerPubkey: this.client.publicKey,
      }),
    });

    // Wait briefly then set final status
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this._roomState = {
      ...this._roomState,
      status: stored.opponentPubkey ? 'ready' : 'waiting',
    };

    return true;
  }

  // ===========================================================================
  // Game State
  // ===========================================================================

  /**
   * Send game state to opponent (throttled)
   */
  sendState(state: TGameState): void {
    const now = Date.now();
    if (now - this.lastStateUpdate < this.config.stateThrottle) return;
    this.lastStateUpdate = now;

    if (this._roomState.roomId) {
      this.publishToRoom({ type: 'state', gameState: state });
    }
  }

  /**
   * Send game over event
   */
  sendGameOver(reason: string, finalScore?: number): void {
    if (this._roomState.roomId) {
      this.publishToRoom({
        type: 'gameover',
        reason,
        finalScore,
        winner: this._opponent?.publicKey ?? '',
      });
      this._roomState = { ...this._roomState, status: 'finished' };
    }
  }

  /**
   * Request a rematch
   */
  requestRematch(): void {
    if (!this._roomState.roomId || this._roomState.status !== 'finished') return;

    this._roomState = { ...this._roomState, rematchRequested: true };
    this.publishToRoom({ type: 'rematch', action: 'request' });

    // If opponent already requested, accept immediately
    if (this._opponent?.rematchRequested) {
      this.acceptRematch();
    }
  }

  /**
   * Accept a rematch request
   */
  acceptRematch(): void {
    if (!this._roomState.roomId) return;

    const newSeed = generateSeed();
    this.publishToRoom({ type: 'rematch', action: 'accept', newSeed });
    this.resetForRematch(newSeed);
  }

  // ===========================================================================
  // Private: Event Handling
  // ===========================================================================

  private subscribeToRoom(roomId: string): void {
    this.unsubscribe?.();

    if (!this.client.isConnected) {
      this.callbacks.onError?.(new Error('NostrClient not connected. Call connect() first.'));
      return;
    }

    this.unsubscribe = this.client.subscribe(
      [{ kinds: [NOSTR_KINDS.EPHEMERAL], '#d': [createRoomTag(this.config.gameId, roomId)] }],
      (event) => {
        try {
          this.handleRoomEvent(event);
        } catch (error) {
          this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      }
    );

    this.startHeartbeat();
    this.startDisconnectCheck();
  }

  private handleRoomEvent(event: NostrEvent): void {
    if (event.pubkey === this.client.publicKey) return;

    try {
      const content = JSON.parse(event.content);

      switch (content.type) {
        case 'join':
          this._opponent = this.createInitialOpponent(content.playerPubkey);
          this._roomState = { ...this._roomState, status: 'ready' };
          this.callbacks.onOpponentJoin?.(content.playerPubkey);

          if (this._roomState.roomId) {
            this.saveRoom({
              roomId: this._roomState.roomId,
              isHost: this._roomState.isHost,
              seed: this._roomState.seed,
              createdAt: this._roomState.createdAt ?? Date.now(),
              opponentPubkey: content.playerPubkey,
            });
          }
          break;

        case 'state':
          if (this._opponent) {
            this._opponent = {
              ...this._opponent,
              gameState: content.gameState,
              lastHeartbeat: Date.now(),
              isConnected: true,
            };
            this.callbacks.onOpponentState?.(content.gameState);
          }
          break;

        case 'gameover':
          this._roomState = { ...this._roomState, status: 'finished', rematchRequested: false };
          if (this._opponent) {
            this._opponent = { ...this._opponent, rematchRequested: false };
          }
          this.callbacks.onOpponentGameOver?.(content.reason, content.finalScore);
          break;

        case 'heartbeat':
          if (this._opponent) {
            this._opponent = {
              ...this._opponent,
              lastHeartbeat: content.timestamp,
              isConnected: true,
            };
          }
          break;

        case 'rematch':
          if (content.action === 'request') {
            if (this._opponent) {
              this._opponent = { ...this._opponent, rematchRequested: true };
            }
            this.callbacks.onRematchRequested?.();
          } else if (content.action === 'accept' && content.newSeed) {
            this.resetForRematch(content.newSeed);
          }
          break;
      }
    } catch (e) {
      console.error('Failed to parse room event:', e);
      this.callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  // ===========================================================================
  // Private: Heartbeat & Disconnect Detection
  // ===========================================================================

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      if (this._roomState.roomId) {
        this.publishToRoom({ type: 'heartbeat', timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startDisconnectCheck(): void {
    if (this.disconnectCheckInterval) return;

    this.disconnectCheckInterval = setInterval(() => {
      if (!this._opponent?.lastHeartbeat) return;

      const timeSince = Date.now() - this._opponent.lastHeartbeat;
      if (timeSince > this.config.disconnectThreshold && this._opponent.isConnected) {
        this._opponent = { ...this._opponent, isConnected: false };
        this.callbacks.onOpponentDisconnect?.();
      }
    }, 1000);
  }

  private stopDisconnectCheck(): void {
    if (this.disconnectCheckInterval) {
      clearInterval(this.disconnectCheckInterval);
      this.disconnectCheckInterval = null;
    }
  }

  // ===========================================================================
  // Private: Helpers
  // ===========================================================================

  private publishToRoom(content: Record<string, unknown>): void {
    if (!this._roomState.roomId) return;

    this.client
      .publish({
        kind: NOSTR_KINDS.EPHEMERAL,
        tags: [['d', createRoomTag(this.config.gameId, this._roomState.roomId)]],
        content: JSON.stringify(content),
      })
      .catch((e) => {
        console.error('Failed to publish:', e);
        this.callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
      });
  }

  private createInitialOpponent(publicKey: string): InternalOpponentState<TGameState> {
    return {
      publicKey,
      gameState: null,
      isConnected: true,
      lastHeartbeat: Date.now(),
      rematchRequested: false,
    };
  }

  private resetForRematch(newSeed: number): void {
    this._roomState = {
      ...this._roomState,
      seed: newSeed,
      status: 'ready',
      rematchRequested: false,
    };

    if (this._opponent) {
      this._opponent = {
        ...this._opponent,
        gameState: null,
        rematchRequested: false,
      };
    }

    this.callbacks.onRematchStart?.(newSeed);
  }

  // ===========================================================================
  // Private: Storage
  // ===========================================================================

  private get storageKey(): string {
    return `${this.config.gameId}-room`;
  }

  private saveRoom(data: StoredRoomData): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      // Storage error (quota exceeded, etc.) - log but don't throw
      console.warn('Failed to save room data:', error);
    }
  }

  private loadRoom(): StoredRoomData | null {
    try {
      const stored = this.storage.getItem(this.storageKey);
      if (!stored) return null;

      const data = JSON.parse(stored) as StoredRoomData;
      if (this.isExpired(data.createdAt)) {
        this.clearRoom();
        return null;
      }
      return data;
    } catch {
      // Storage or parse error - treat as no saved room
      return null;
    }
  }

  private clearRoom(): void {
    try {
      this.storage.removeItem(this.storageKey);
    } catch {
      // Ignore storage errors
    }
  }

  private isExpired(createdAt: number): boolean {
    return Date.now() - createdAt > this.config.roomExpiry;
  }
}

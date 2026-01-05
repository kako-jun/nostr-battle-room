/**
 * nostr-battle-room - MockBattleRoom
 * Testing utilities for battle room
 */

import type { RoomState, OpponentBase, BattleRoomCallbacks, BattleRoomEventName } from '../types';
import { INITIAL_ROOM_STATE, generateSeed, generateRoomId } from '../types';

/**
 * Map event names to callback keys
 */
type EventToCallback<TGameState> = {
  opponentJoin: BattleRoomCallbacks<TGameState>['onOpponentJoin'];
  opponentState: BattleRoomCallbacks<TGameState>['onOpponentState'];
  opponentDisconnect: BattleRoomCallbacks<TGameState>['onOpponentDisconnect'];
  opponentGameOver: BattleRoomCallbacks<TGameState>['onOpponentGameOver'];
  rematchRequested: BattleRoomCallbacks<TGameState>['onRematchRequested'];
  rematchStart: BattleRoomCallbacks<TGameState>['onRematchStart'];
  error: BattleRoomCallbacks<TGameState>['onError'];
};

/**
 * Mock opponent state
 */
interface MockOpponentState<TGameState> extends OpponentBase {
  gameState: TGameState | null;
}

/**
 * MockBattleRoom - For testing without real Nostr connections
 *
 * @example
 * ```typescript
 * const mock = new MockBattleRoom<MyGameState>({ gameId: 'test' });
 *
 * // Simulate opponent joining
 * mock.simulateOpponentJoin('pubkey123');
 *
 * // Simulate opponent state update
 * mock.simulateOpponentState({ score: 100 });
 *
 * // Simulate opponent disconnect
 * mock.simulateOpponentDisconnect();
 * ```
 */
export class MockBattleRoom<TGameState = Record<string, unknown>> {
  private _roomState: RoomState = { ...INITIAL_ROOM_STATE };
  private _opponent: MockOpponentState<TGameState> | null = null;
  private callbacks: BattleRoomCallbacks<TGameState> = {};

  constructor(_config: { gameId: string }) {
    // Config is accepted but not used in mock
  }

  get roomState(): Readonly<RoomState> {
    return this._roomState;
  }

  get opponent(): Readonly<MockOpponentState<TGameState>> | null {
    return this._opponent;
  }

  get isConnected(): boolean {
    return true;
  }

  get publicKey(): string {
    return 'mock-public-key';
  }

  on<K extends BattleRoomEventName>(
    event: K,
    callback: NonNullable<EventToCallback<TGameState>[K]>
  ): this {
    const callbackKey =
      `on${event.charAt(0).toUpperCase()}${event.slice(1)}` as keyof BattleRoomCallbacks<TGameState>;
    (this.callbacks as Record<string, unknown>)[callbackKey] = callback;
    return this;
  }

  connect(): void {
    // No-op
  }

  disconnect(): void {
    // No-op
  }

  async create(): Promise<string> {
    const roomId = generateRoomId();
    this._roomState = {
      roomId,
      status: 'waiting',
      isHost: true,
      seed: generateSeed(),
      createdAt: Date.now(),
    };
    return `https://example.com/battle/${roomId}`;
  }

  async join(roomId: string): Promise<void> {
    this._roomState = {
      roomId,
      status: 'ready',
      isHost: false,
      seed: generateSeed(),
      createdAt: Date.now(),
    };
  }

  leave(): void {
    this._roomState = { ...INITIAL_ROOM_STATE };
    this._opponent = null;
  }

  sendState(_state: TGameState): void {
    // No-op in mock
  }

  sendGameOver(_reason: string, _finalScore?: number): void {
    this._roomState = { ...this._roomState, status: 'finished' };
  }

  requestRematch(): void {
    this._roomState = { ...this._roomState, rematchRequested: true };
  }

  acceptRematch(): void {
    const newSeed = generateSeed();
    this._roomState = {
      ...this._roomState,
      seed: newSeed,
      status: 'ready',
      rematchRequested: false,
    };
    if (this._opponent) {
      this._opponent = { ...this._opponent, gameState: null, rematchRequested: false };
    }
    this.callbacks.onRematchStart?.(newSeed);
  }

  // ==========================================================================
  // Simulation methods (for testing)
  // ==========================================================================

  /**
   * Simulate an opponent joining the room
   */
  simulateOpponentJoin(publicKey: string = 'opponent-pubkey'): void {
    this._opponent = {
      publicKey,
      gameState: null,
      isConnected: true,
      lastHeartbeat: Date.now(),
      rematchRequested: false,
    };
    this._roomState = { ...this._roomState, status: 'ready' };
    this.callbacks.onOpponentJoin?.(publicKey);
  }

  /**
   * Simulate opponent state update
   */
  simulateOpponentState(state: TGameState): void {
    if (this._opponent) {
      this._opponent = {
        ...this._opponent,
        gameState: state,
        lastHeartbeat: Date.now(),
        isConnected: true,
      };
    }
    this.callbacks.onOpponentState?.(state);
  }

  /**
   * Simulate opponent disconnection
   */
  simulateOpponentDisconnect(): void {
    if (this._opponent) {
      this._opponent = { ...this._opponent, isConnected: false };
    }
    this.callbacks.onOpponentDisconnect?.();
  }

  /**
   * Simulate opponent game over
   */
  simulateOpponentGameOver(reason: string, finalScore?: number): void {
    this._roomState = { ...this._roomState, status: 'finished' };
    this.callbacks.onOpponentGameOver?.(reason, finalScore);
  }

  /**
   * Simulate opponent rematch request
   */
  simulateRematchRequested(): void {
    if (this._opponent) {
      this._opponent = { ...this._opponent, rematchRequested: true };
    }
    this.callbacks.onRematchRequested?.();
  }
}

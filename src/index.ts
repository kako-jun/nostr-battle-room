/**
 * nostr-battle-room
 * Nostr-based real-time battle room for multiplayer games
 *
 * @example
 * ```typescript
 * // Using the core BattleRoom class (framework-agnostic)
 * import { BattleRoom } from 'nostr-battle-room';
 *
 * const room = new BattleRoom<MyGameState>({ gameId: 'my-game' });
 * room.onOpponentState((state) => console.log(state));
 * await room.create();
 * ```
 *
 * @example
 * ```typescript
 * // Using the React hook
 * import { useBattleRoom } from 'nostr-battle-room/react';
 *
 * function Game() {
 *   const { roomState, opponent, createRoom } = useBattleRoom<MyGameState>({
 *     gameId: 'my-game',
 *   });
 *   // ...
 * }
 * ```
 */

// Core exports
export { BattleRoom } from './core/BattleRoom';
export { NostrClient } from './core/NostrClient';
export type { NostrClientOptions, NostrFilter } from './core/NostrClient';

// Types
export type {
  BattleRoomConfig,
  BattleRoomCallbacks,
  BattleRoomEventName,
  RoomState,
  RoomStatus,
  OpponentBase,
  OpponentState,
  NostrEvent,
  StoredRoomData,
  Unsubscribe,
  // Event contents
  RoomEventContent,
  JoinEventContent,
  StateEventContent,
  GameOverEventContent,
  RematchEventContent,
  HeartbeatEventContent,
  BattleEventContent,
} from './types';

// Constants and utilities
export {
  DEFAULT_CONFIG,
  INITIAL_ROOM_STATE,
  NOSTR_KINDS,
  createRoomTag,
  generateSeed,
  generateRoomId,
} from './types';

// Proxy support (Node.js)
export { configureProxy, resetProxyConfiguration } from './proxy';

// Retry utilities
export { withRetry, withTimeout, timeout, type RetryOptions } from './retry';

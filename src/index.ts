/**
 * nostr-battle-room
 * Nostr-based real-time battle room for multiplayer games
 *
 * @example
 * ```typescript
 * // Using the core Arena class (framework-agnostic)
 * import { Arena } from 'nostr-battle-room';
 *
 * const room = new Arena<MyGameState>({ gameId: 'my-game' });
 * room.onOpponentState((state) => console.log(state));
 * await room.create();
 * ```
 *
 * @example
 * ```typescript
 * // Using the React hook
 * import { useArena } from 'nostr-battle-room/react';
 *
 * function Game() {
 *   const { roomState, opponent, createRoom } = useArena<MyGameState>({
 *     gameId: 'my-game',
 *   });
 *   // ...
 * }
 * ```
 */

// Core exports
export { Arena } from './core/Arena';
export { NostrClient } from './core/NostrClient';
export type { NostrClientOptions, NostrFilter } from './core/NostrClient';

// Types
export type {
  ArenaConfig,
  ArenaCallbacks,
  ArenaEventName,
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

/**
 * nostr-battle-room - Types
 * Generic types for Nostr-based multiplayer game rooms
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for BattleRoom
 */
export interface BattleRoomConfig {
  /** Unique identifier for the game (e.g., 'sasso', 'tetris') */
  gameId: string;

  /** Nostr relay URLs */
  relays?: string[];

  /** Room expiration time in ms (default: 600000 = 10 minutes) */
  roomExpiry?: number;

  /** Heartbeat interval in ms (default: 3000 = 3 seconds) */
  heartbeatInterval?: number;

  /** Disconnect threshold in ms (default: 10000 = 10 seconds) */
  disconnectThreshold?: number;

  /** State update throttle in ms (default: 100) */
  stateThrottle?: number;

  /** Join timeout in ms (default: 30000 = 30 seconds) */
  joinTimeout?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<Omit<BattleRoomConfig, 'gameId'>> = {
  relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'],
  roomExpiry: 600000,
  heartbeatInterval: 3000,
  disconnectThreshold: 10000,
  stateThrottle: 100,
  joinTimeout: 30000,
};

// =============================================================================
// Room State
// =============================================================================

/**
 * Room status
 */
export type RoomStatus =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'joining'
  | 'ready'
  | 'playing'
  | 'finished';

/**
 * Room state (game-agnostic)
 */
export interface RoomState {
  roomId: string | null;
  status: RoomStatus;
  isHost: boolean;
  seed: number;
  createdAt?: number;
  rematchRequested?: boolean;
}

/**
 * Initial room state
 */
export const INITIAL_ROOM_STATE: RoomState = {
  roomId: null,
  status: 'idle',
  isHost: false,
  seed: 0,
};

// =============================================================================
// Opponent State
// =============================================================================

/**
 * Base opponent information (game-agnostic)
 */
export interface OpponentBase {
  publicKey: string;
  isConnected: boolean;
  lastHeartbeat?: number;
  rematchRequested?: boolean;
}

/**
 * Opponent state with generic game state
 */
export interface OpponentState<TGameState = Record<string, unknown>> extends OpponentBase {
  gameState: TGameState;
}

// =============================================================================
// Nostr Types
// =============================================================================

/**
 * Nostr event kinds used by the library
 */
export const NOSTR_KINDS = {
  /** Replaceable event for room metadata */
  ROOM: 30078,
  /** Ephemeral event for game state (not stored by relays) */
  EPHEMERAL: 25000,
} as const;

// Note: For filters, use the `Filter` type from 'nostr-tools' directly
// or import `NostrFilter` from 'nostr-battle-room' (re-exported from nostr-tools)

/**
 * Nostr event structure
 */
export interface NostrEvent {
  id?: string;
  pubkey?: string;
  created_at?: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

// =============================================================================
// Event Contents (Messages between players)
// =============================================================================

/**
 * Room creation event
 */
export interface RoomEventContent {
  type: 'room';
  status: 'waiting' | 'playing' | 'finished';
  seed: number;
  hostPubkey: string;
}

/**
 * Join event (player joining a room)
 */
export interface JoinEventContent {
  type: 'join';
  playerPubkey: string;
}

/**
 * Generic game state event
 */
export interface StateEventContent<TGameState = Record<string, unknown>> {
  type: 'state';
  gameState: TGameState;
}

/**
 * Game over event
 */
export interface GameOverEventContent {
  type: 'gameover';
  reason: string;
  finalScore?: number;
  winner?: string;
}

/**
 * Rematch event
 */
export interface RematchEventContent {
  type: 'rematch';
  action: 'request' | 'accept';
  newSeed?: number;
}

/**
 * Heartbeat event
 */
export interface HeartbeatEventContent {
  type: 'heartbeat';
  timestamp: number;
}

/**
 * All possible event content types
 */
export type BattleEventContent<TGameState = Record<string, unknown>> =
  | RoomEventContent
  | JoinEventContent
  | StateEventContent<TGameState>
  | GameOverEventContent
  | RematchEventContent
  | HeartbeatEventContent;

// =============================================================================
// Callbacks
// =============================================================================

/**
 * Event names for BattleRoom
 */
export type BattleRoomEventName =
  | 'opponentJoin'
  | 'opponentState'
  | 'opponentDisconnect'
  | 'opponentGameOver'
  | 'rematchRequested'
  | 'rematchStart'
  | 'error';

/**
 * Event callbacks for BattleRoom
 */
export interface BattleRoomCallbacks<TGameState = Record<string, unknown>> {
  /** Called when opponent joins the room */
  onOpponentJoin?: (publicKey: string) => void;

  /** Called when opponent's game state is updated */
  onOpponentState?: (state: TGameState) => void;

  /** Called when opponent disconnects */
  onOpponentDisconnect?: () => void;

  /** Called when opponent sends game over */
  onOpponentGameOver?: (reason: string, finalScore?: number) => void;

  /** Called when opponent requests rematch */
  onRematchRequested?: () => void;

  /** Called when rematch is accepted (by either party) */
  onRematchStart?: (newSeed: number) => void;

  /** Called on any error */
  onError?: (error: Error) => void;
}

// =============================================================================
// Storage
// =============================================================================

/**
 * Data stored in localStorage for reconnection
 */
export interface StoredRoomData {
  roomId: string;
  isHost: boolean;
  seed: number;
  createdAt: number;
  opponentPubkey?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Function to unsubscribe from events
 */
export type Unsubscribe = () => void;

/**
 * Generate room tag from game ID and room ID
 */
export function createRoomTag(gameId: string, roomId: string): string {
  return `${gameId}-room-${roomId}`;
}

/**
 * Generate a random seed
 */
export function generateSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/**
 * Generate a unique room ID
 */
export function generateRoomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

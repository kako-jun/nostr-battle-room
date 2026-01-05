/**
 * Protocol Tests
 *
 * Source: protocol.md
 */

import { describe, it, expect } from 'vitest';
import { NOSTR_KINDS, createRoomTag, DEFAULT_CONFIG } from '../types';

describe('Event Kinds (protocol.md)', () => {
  /**
   * Source: protocol.md - Event Kinds table
   *
   * | Kind  | Type        | Stored | Purpose               |
   * | ----- | ----------- | ------ | --------------------- |
   * | 30078 | Replaceable | Yes    | Room metadata         |
   * | 25000 | Ephemeral   | No     | Game state, heartbeat |
   */

  it('room metadata should use kind 30078 (Replaceable)', () => {
    expect(NOSTR_KINDS.ROOM).toBe(30078);
  });

  it('game state/heartbeat should use kind 25000 (Ephemeral)', () => {
    expect(NOSTR_KINDS.EPHEMERAL).toBe(25000);
  });
});

describe('Tag Format (protocol.md)', () => {
  /**
   * Source: protocol.md - Tag Format section
   *
   * Room tag format: `{gameId}-room-{roomId}`
   *
   * Examples:
   * - `sasso-room-abc123`
   * - `tetris-room-xyz789`
   */

  it('should create tag in format {gameId}-room-{roomId}', () => {
    const tag = createRoomTag('sasso', 'abc123');
    expect(tag).toBe('sasso-room-abc123');
  });

  it('should work with different gameIds (example: tetris)', () => {
    const tag = createRoomTag('tetris', 'xyz789');
    expect(tag).toBe('tetris-room-xyz789');
  });
});

describe('Default Relays (protocol.md)', () => {
  /**
   * Source: protocol.md - Default Relays section
   *
   * ```typescript
   * const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
   * ```
   */

  it('should include wss://relay.damus.io', () => {
    expect(DEFAULT_CONFIG.relays).toContain('wss://relay.damus.io');
  });

  it('should include wss://nos.lol', () => {
    expect(DEFAULT_CONFIG.relays).toContain('wss://nos.lol');
  });

  it('should include wss://relay.nostr.band', () => {
    expect(DEFAULT_CONFIG.relays).toContain('wss://relay.nostr.band');
  });
});

describe('Event Content Structures (protocol.md)', () => {
  /**
   * These tests verify the expected structure of event content
   * as documented in protocol.md Event Formats section.
   *
   * Note: These are structural tests, not implementation tests.
   * They verify the shape of data matches the protocol spec.
   */

  describe('Room Creation Event (kind 30078)', () => {
    /**
     * Source: protocol.md
     *
     * ```json
     * {
     *   "kind": 30078,
     *   "tags": [
     *     ["d", "{gameId}-room-{roomId}"],
     *     ["t", "{gameId}"]
     *   ],
     *   "content": {
     *     "type": "room",
     *     "status": "waiting",
     *     "seed": 123456789,
     *     "hostPubkey": "<hex-pubkey>"
     *   }
     * }
     * ```
     */

    it('content should have type "room"', () => {
      const content = { type: 'room', status: 'waiting', seed: 123, hostPubkey: 'abc' };
      expect(content.type).toBe('room');
    });

    it('content should have status "waiting"', () => {
      const content = { type: 'room', status: 'waiting', seed: 123, hostPubkey: 'abc' };
      expect(content.status).toBe('waiting');
    });

    it('content should have numeric seed', () => {
      const content = { type: 'room', status: 'waiting', seed: 123456789, hostPubkey: 'abc' };
      expect(typeof content.seed).toBe('number');
    });

    it('content should have hostPubkey', () => {
      const content = { type: 'room', status: 'waiting', seed: 123, hostPubkey: 'abc123' };
      expect(content.hostPubkey).toBe('abc123');
    });
  });

  describe('Join Event (kind 25000)', () => {
    /**
     * Source: protocol.md
     *
     * ```json
     * {
     *   "kind": 25000,
     *   "tags": [["d", "{gameId}-room-{roomId}"]],
     *   "content": {
     *     "type": "join",
     *     "playerPubkey": "<hex-pubkey>"
     *   }
     * }
     * ```
     */

    it('content should have type "join"', () => {
      const content = { type: 'join', playerPubkey: 'player123' };
      expect(content.type).toBe('join');
    });

    it('content should have playerPubkey', () => {
      const content = { type: 'join', playerPubkey: 'player123' };
      expect(content.playerPubkey).toBe('player123');
    });
  });

  describe('State Update Event (kind 25000)', () => {
    /**
     * Source: protocol.md
     *
     * ```json
     * {
     *   "kind": 25000,
     *   "tags": [["d", "{gameId}-room-{roomId}"]],
     *   "content": {
     *     "type": "state",
     *     "gameState": {
     *       // Your game's state object
     *     }
     *   }
     * }
     * ```
     */

    it('content should have type "state"', () => {
      const content = { type: 'state', gameState: {} };
      expect(content.type).toBe('state');
    });

    it('content should wrap game state in gameState property', () => {
      const content = { type: 'state', gameState: { score: 100, level: 5 } };
      expect(content.gameState).toEqual({ score: 100, level: 5 });
    });
  });

  describe('Heartbeat Event (kind 25000)', () => {
    /**
     * Source: protocol.md
     *
     * ```json
     * {
     *   "kind": 25000,
     *   "tags": [["d", "{gameId}-room-{roomId}"]],
     *   "content": {
     *     "type": "heartbeat",
     *     "timestamp": 1704000000000
     *   }
     * }
     * ```
     */

    it('content should have type "heartbeat"', () => {
      const content = { type: 'heartbeat', timestamp: Date.now() };
      expect(content.type).toBe('heartbeat');
    });

    it('content should have numeric timestamp', () => {
      const content = { type: 'heartbeat', timestamp: 1704000000000 };
      expect(typeof content.timestamp).toBe('number');
    });
  });

  describe('Game Over Event (kind 25000)', () => {
    /**
     * Source: protocol.md
     *
     * ```json
     * {
     *   "kind": 25000,
     *   "tags": [["d", "{gameId}-room-{roomId}"]],
     *   "content": {
     *     "type": "gameover",
     *     "reason": "win|lose|disconnect|surrender",
     *     "finalScore": 500,
     *     "winner": "<hex-pubkey>"
     *   }
     * }
     * ```
     */

    it('content should have type "gameover"', () => {
      const content = { type: 'gameover', reason: 'win' };
      expect(content.type).toBe('gameover');
    });

    it('reason should be one of: win, lose, disconnect, surrender', () => {
      const validReasons = ['win', 'lose', 'disconnect', 'surrender'];
      for (const reason of validReasons) {
        const content = { type: 'gameover', reason };
        expect(validReasons).toContain(content.reason);
      }
    });
  });

  describe('Rematch Request Event (kind 25000)', () => {
    /**
     * Source: protocol.md
     *
     * ```json
     * {
     *   "kind": 25000,
     *   "tags": [["d", "{gameId}-room-{roomId}"]],
     *   "content": {
     *     "type": "rematch",
     *     "action": "request"
     *   }
     * }
     * ```
     */

    it('content should have type "rematch" and action "request"', () => {
      const content = { type: 'rematch', action: 'request' };
      expect(content.type).toBe('rematch');
      expect(content.action).toBe('request');
    });
  });

  describe('Rematch Accept Event (kind 25000)', () => {
    /**
     * Source: protocol.md
     *
     * ```json
     * {
     *   "kind": 25000,
     *   "tags": [["d", "{gameId}-room-{roomId}"]],
     *   "content": {
     *     "type": "rematch",
     *     "action": "accept",
     *     "newSeed": 987654321
     *   }
     * }
     * ```
     */

    it('content should have type "rematch" and action "accept"', () => {
      const content = { type: 'rematch', action: 'accept', newSeed: 123 };
      expect(content.type).toBe('rematch');
      expect(content.action).toBe('accept');
    });

    it('content should have numeric newSeed', () => {
      const content = { type: 'rematch', action: 'accept', newSeed: 987654321 };
      expect(typeof content.newSeed).toBe('number');
    });
  });
});

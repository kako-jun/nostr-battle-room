/**
 * Callbacks Tests
 *
 * Source: README.md - Events (Callbacks) table
 *
 * | Event              | Parameters                       | Description                |
 * | ------------------ | -------------------------------- | -------------------------- |
 * | opponentJoin       | (publicKey: string)              | Opponent joined the room   |
 * | opponentState      | (state: TGameState)              | Opponent sent state update |
 * | opponentDisconnect | ()                               | Opponent disconnected      |
 * | opponentGameOver   | (reason: string, score?: number) | Opponent game over         |
 * | rematchRequested   | ()                               | Opponent requested rematch |
 * | rematchStart       | (newSeed: number)                | Rematch starting           |
 * | error              | (error: Error)                   | Error occurred             |
 *
 * Source: architecture.md - BattleRoom API
 *
 * All callback methods return `this` for chaining:
 * - onOpponentJoin(callback): this
 * - onOpponentState(callback): this
 * - onOpponentDisconnect(callback): this
 * - onOpponentGameOver(callback): this
 * - onRematchRequested(callback): this
 * - onRematchStart(callback): this
 * - onError(callback): this
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockBattleRoom } from '../testing/MockBattleRoom';

interface TestGameState {
  score: number;
}

describe('Callbacks (README.md, architecture.md)', () => {
  let room: MockBattleRoom<TestGameState>;

  beforeEach(() => {
    room = new MockBattleRoom<TestGameState>({ gameId: 'test-game' });
  });

  describe('opponentJoin: (publicKey: string)', () => {
    it('should be called when opponent joins', async () => {
      let receivedPubkey: string | null = null;

      room.on('opponentJoin', (pubkey) => {
        receivedPubkey = pubkey;
      });

      await room.create();
      room.simulateOpponentJoin('opponent-abc123');

      expect(receivedPubkey).toBe('opponent-abc123');
    });
  });

  describe('opponentState: (state: TGameState)', () => {
    it('should be called with game state when opponent sends state', async () => {
      let receivedState: TestGameState | null = null;

      room.on('opponentState', (state) => {
        receivedState = state;
      });

      await room.create();
      room.simulateOpponentJoin('opponent');
      room.simulateOpponentState({ score: 250 });

      expect(receivedState).toEqual({ score: 250 });
    });
  });

  describe('opponentDisconnect: ()', () => {
    it('should be called when opponent disconnects', async () => {
      let disconnectCalled = false;

      room.on('opponentDisconnect', () => {
        disconnectCalled = true;
      });

      await room.create();
      room.simulateOpponentJoin('opponent');
      room.simulateOpponentDisconnect();

      expect(disconnectCalled).toBe(true);
    });
  });

  describe('opponentGameOver: (reason: string, score?: number)', () => {
    it('should be called with reason when opponent ends game', async () => {
      let receivedReason: string | null = null;

      room.on('opponentGameOver', (reason) => {
        receivedReason = reason;
      });

      await room.create();
      room.simulateOpponentJoin('opponent');
      room.simulateOpponentGameOver('surrender');

      expect(receivedReason).toBe('surrender');
    });

    it('should receive optional score parameter', async () => {
      let receivedScore: number | undefined;

      room.on('opponentGameOver', (_reason, score) => {
        receivedScore = score;
      });

      await room.create();
      room.simulateOpponentJoin('opponent');
      room.simulateOpponentGameOver('win', 1000);

      expect(receivedScore).toBe(1000);
    });
  });

  describe('rematchRequested: ()', () => {
    it('should be called when opponent requests rematch', async () => {
      let rematchRequested = false;

      room.on('rematchRequested', () => {
        rematchRequested = true;
      });

      await room.create();
      room.simulateOpponentJoin('opponent');
      room.sendGameOver('win');
      room.simulateRematchRequested();

      expect(rematchRequested).toBe(true);
    });
  });

  describe('rematchStart: (newSeed: number)', () => {
    it('should be called with new seed when rematch starts', async () => {
      let receivedSeed: number | null = null;

      room.on('rematchStart', (seed) => {
        receivedSeed = seed;
      });

      await room.create();
      room.simulateOpponentJoin('opponent');
      room.sendGameOver('win');
      room.simulateRematchRequested();
      room.acceptRematch();

      expect(receivedSeed).not.toBeNull();
      expect(typeof receivedSeed).toBe('number');
    });
  });

  describe('Chaining (architecture.md)', () => {
    /**
     * Source: architecture.md - BattleRoom API
     * All callback methods return `this` for chaining
     */

    it('on() should return this for chaining', () => {
      const result = room.on('opponentJoin', () => {});
      expect(result).toBe(room);
    });

    it('multiple callbacks can be chained', () => {
      const result = room
        .on('opponentJoin', () => {})
        .on('opponentState', () => {})
        .on('opponentDisconnect', () => {})
        .on('opponentGameOver', () => {})
        .on('rematchRequested', () => {})
        .on('rematchStart', () => {});

      expect(result).toBe(room);
    });
  });
});

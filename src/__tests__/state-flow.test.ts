/**
 * State Flow Tests
 *
 * Source: architecture.md - State Flow diagram
 *
 * ```
 * ┌─────────┐  create()   ┌─────────┐  opponent   ┌─────────┐
 * │  idle   │────────────▶│ waiting │────joins───▶│  ready  │
 * └─────────┘             └─────────┘             └────┬────┘
 *      ▲                                               │
 *      │                                          game starts
 *      │                                               │
 *      │                  ┌──────────┐             ┌───▼─────┐
 *      │◀────leave()──────│ finished │◀──gameover──│ playing │
 *      │                  └────┬─────┘             └─────────┘
 *      │                       │
 *      │                   rematch
 *      │                       │
 *      │                  ┌────▼────┐
 *      └──────────────────│  ready  │
 *                         └─────────┘
 * ```
 *
 * Source: README.md - Room States table
 *
 * | Status   | Description                           |
 * | -------- | ------------------------------------- |
 * | idle     | No room active                        |
 * | creating | Creating a new room                   |
 * | waiting  | Waiting for opponent to join          |
 * | joining  | Joining an existing room              |
 * | ready    | Both players connected, ready to play |
 * | playing  | Game in progress                      |
 * | finished | Game ended                            |
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockBattleRoom } from '../testing/MockBattleRoom';

interface TestGameState {
  score: number;
}

describe('State Flow (architecture.md)', () => {
  let room: MockBattleRoom<TestGameState>;

  beforeEach(() => {
    room = new MockBattleRoom<TestGameState>({ gameId: 'test-game' });
  });

  describe('Initial state: idle', () => {
    /**
     * Source: README.md - "idle: No room active"
     */

    it('should start in idle status', () => {
      expect(room.roomState.status).toBe('idle');
    });
  });

  describe('Transition: idle → waiting (via create())', () => {
    /**
     * Source: architecture.md diagram
     * "idle ──create()──▶ waiting"
     */

    it('create() should transition from idle to waiting', async () => {
      expect(room.roomState.status).toBe('idle');
      await room.create();
      expect(room.roomState.status).toBe('waiting');
    });

    it('after create(), isHost should be true', async () => {
      await room.create();
      expect(room.roomState.isHost).toBe(true);
    });
  });

  describe('Transition: waiting → ready (opponent joins)', () => {
    /**
     * Source: architecture.md diagram
     * "waiting ──opponent joins──▶ ready"
     */

    it('should transition from waiting to ready when opponent joins', async () => {
      await room.create();
      expect(room.roomState.status).toBe('waiting');

      room.simulateOpponentJoin('opponent-pubkey');
      expect(room.roomState.status).toBe('ready');
    });
  });

  describe('Transition: idle → ready (via join())', () => {
    /**
     * Source: architecture.md - BattleRoom API
     * "join(roomId): Promise<void>"
     *
     * Note: The diagram shows idle → joining → ready, but for MockBattleRoom
     * join() directly goes to ready (simplified for testing)
     */

    it('join() should transition to ready', async () => {
      expect(room.roomState.status).toBe('idle');
      await room.join('existing-room-id');
      expect(room.roomState.status).toBe('ready');
    });

    it('after join(), isHost should be false', async () => {
      await room.join('existing-room-id');
      expect(room.roomState.isHost).toBe(false);
    });
  });

  describe('Transition: playing → finished (gameover)', () => {
    /**
     * Source: architecture.md diagram
     * "playing ──gameover──▶ finished"
     */

    it('sendGameOver() should transition to finished', async () => {
      await room.create();
      room.simulateOpponentJoin('opponent');

      room.sendGameOver('win', 500);
      expect(room.roomState.status).toBe('finished');
    });
  });

  describe('Transition: any → idle (leave())', () => {
    /**
     * Source: architecture.md diagram
     * "◀────leave()────"
     */

    it('leave() from waiting should go to idle', async () => {
      await room.create();
      expect(room.roomState.status).toBe('waiting');

      room.leave();
      expect(room.roomState.status).toBe('idle');
    });

    it('leave() from ready should go to idle', async () => {
      await room.create();
      room.simulateOpponentJoin('opponent');
      expect(room.roomState.status).toBe('ready');

      room.leave();
      expect(room.roomState.status).toBe('idle');
    });

    it('leave() from finished should go to idle', async () => {
      await room.create();
      room.simulateOpponentJoin('opponent');
      room.sendGameOver('win');
      expect(room.roomState.status).toBe('finished');

      room.leave();
      expect(room.roomState.status).toBe('idle');
    });
  });

  describe('Transition: finished → ready (rematch)', () => {
    /**
     * Source: architecture.md diagram
     * "finished ──rematch──▶ ready"
     */

    it('acceptRematch() should transition from finished to ready', async () => {
      await room.create();
      room.simulateOpponentJoin('opponent');
      room.sendGameOver('win');
      expect(room.roomState.status).toBe('finished');

      room.simulateRematchRequested();
      room.acceptRematch();
      expect(room.roomState.status).toBe('ready');
    });

    it('rematch should generate new seed', async () => {
      await room.create();
      room.simulateOpponentJoin('opponent');
      const oldSeed = room.roomState.seed;

      room.sendGameOver('win');
      room.simulateRematchRequested();
      room.acceptRematch();

      expect(room.roomState.seed).not.toBe(oldSeed);
    });
  });
});

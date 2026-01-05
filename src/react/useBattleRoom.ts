/**
 * nostr-battle-room - React Hook
 * React bindings for BattleRoom
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleRoom } from '../core/BattleRoom';
import type { BattleRoomConfig, BattleRoomCallbacks, RoomState, OpponentBase } from '../types';
import { INITIAL_ROOM_STATE } from '../types';

/**
 * Opponent state with game state
 */
export interface OpponentState<TGameState> extends OpponentBase {
  gameState: TGameState | null;
}

/**
 * Return type for useBattleRoom hook
 */
export interface UseBattleRoomReturn<TGameState> {
  // State
  roomState: RoomState;
  opponent: OpponentState<TGameState> | null;
  isConnected: boolean;
  publicKey: string;

  // Room actions
  createRoom: (baseUrl?: string) => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  reconnect: () => Promise<boolean>;

  // Game actions
  sendState: (state: TGameState) => void;
  sendGameOver: (reason: string, finalScore?: number) => void;
  requestRematch: () => void;
  acceptRematch: () => void;
}

/**
 * React hook for managing a battle room
 *
 * @example
 * ```tsx
 * interface MyGameState {
 *   score: number;
 *   position: { x: number; y: number };
 * }
 *
 * function GameComponent() {
 *   const {
 *     roomState,
 *     opponent,
 *     createRoom,
 *     joinRoom,
 *     sendState,
 *   } = useBattleRoom<MyGameState>({
 *     gameId: 'my-game',
 *     onOpponentState: (state) => {
 *       console.log('Opponent moved:', state.position);
 *     },
 *   });
 *
 *   // Create a room
 *   const handleCreate = async () => {
 *     const url = await createRoom();
 *     console.log('Share this URL:', url);
 *   };
 *
 *   // Send game state
 *   const handleMove = (x: number, y: number) => {
 *     sendState({ score: 100, position: { x, y } });
 *   };
 *
 *   return (
 *     <div>
 *       <p>Status: {roomState.status}</p>
 *       {opponent && <p>Opponent score: {opponent.gameState?.score}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBattleRoom<TGameState = Record<string, unknown>>(
  config: BattleRoomConfig,
  callbacks?: BattleRoomCallbacks<TGameState>
): UseBattleRoomReturn<TGameState> {
  const [roomState, setRoomState] = useState<RoomState>(INITIAL_ROOM_STATE);
  const [opponent, setOpponent] = useState<OpponentState<TGameState> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const roomRef = useRef<BattleRoom<TGameState> | null>(null);
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Initialize BattleRoom
  useEffect(() => {
    const room = new BattleRoom<TGameState>(config);

    // Register callbacks that update React state
    room.onOpponentJoin((publicKey: string) => {
      setOpponent({
        publicKey,
        gameState: null,
        isConnected: true,
        lastHeartbeat: Date.now(),
        rematchRequested: false,
      });
      setRoomState((prev) => ({ ...prev, status: 'ready' }));
      callbacksRef.current?.onOpponentJoin?.(publicKey);
    });

    room.onOpponentState((state: TGameState) => {
      setOpponent((prev) =>
        prev
          ? {
              ...prev,
              gameState: state,
              lastHeartbeat: Date.now(),
              isConnected: true,
            }
          : null
      );
      callbacksRef.current?.onOpponentState?.(state);
    });

    room.onOpponentDisconnect(() => {
      setOpponent((prev) => (prev ? { ...prev, isConnected: false } : null));
      callbacksRef.current?.onOpponentDisconnect?.();
    });

    room.onOpponentGameOver((reason: string, finalScore?: number) => {
      setRoomState((prev) => ({ ...prev, status: 'finished', rematchRequested: false }));
      setOpponent((prev) => (prev ? { ...prev, rematchRequested: false } : null));
      callbacksRef.current?.onOpponentGameOver?.(reason, finalScore);
    });

    room.onRematchRequested(() => {
      setOpponent((prev) => (prev ? { ...prev, rematchRequested: true } : null));
      callbacksRef.current?.onRematchRequested?.();
    });

    room.onRematchStart((newSeed: number) => {
      setRoomState((prev) => ({
        ...prev,
        seed: newSeed,
        status: 'ready',
        rematchRequested: false,
      }));
      setOpponent((prev) => (prev ? { ...prev, gameState: null, rematchRequested: false } : null));
      callbacksRef.current?.onRematchStart?.(newSeed);
    });

    room.onError((error: Error) => {
      callbacksRef.current?.onError?.(error);
    });

    room.connect();
    setIsConnected(true);

    roomRef.current = room;

    return () => {
      room.disconnect();
      roomRef.current = null;
    };
    // Note: config should be stable (memoized) by the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.gameId]);

  // Create room
  const createRoom = useCallback(async (baseUrl?: string): Promise<string> => {
    if (!roomRef.current) throw new Error('BattleRoom not initialized');

    const url = await roomRef.current.create(baseUrl);
    setRoomState(roomRef.current.roomState);
    return url;
  }, []);

  // Join room
  const joinRoom = useCallback(async (roomId: string): Promise<void> => {
    if (!roomRef.current) throw new Error('BattleRoom not initialized');

    await roomRef.current.join(roomId);
    setRoomState(roomRef.current.roomState);

    const opp = roomRef.current.opponent;
    if (opp) {
      setOpponent({
        publicKey: opp.publicKey,
        gameState: opp.gameState ?? null,
        isConnected: opp.isConnected,
        lastHeartbeat: opp.lastHeartbeat,
        rematchRequested: opp.rematchRequested,
      });
    }
  }, []);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (!roomRef.current) return;

    roomRef.current.leave();
    setRoomState(INITIAL_ROOM_STATE);
    setOpponent(null);
  }, []);

  // Reconnect
  const reconnect = useCallback(async (): Promise<boolean> => {
    if (!roomRef.current) return false;

    const success = await roomRef.current.reconnect();
    if (success) {
      setRoomState(roomRef.current.roomState);

      const opp = roomRef.current.opponent;
      if (opp) {
        setOpponent({
          publicKey: opp.publicKey,
          gameState: opp.gameState ?? null,
          isConnected: opp.isConnected,
          lastHeartbeat: opp.lastHeartbeat,
          rematchRequested: opp.rematchRequested,
        });
      }
    }
    return success;
  }, []);

  // Send state
  const sendState = useCallback((state: TGameState) => {
    roomRef.current?.sendState(state);
  }, []);

  // Send game over
  const sendGameOver = useCallback((reason: string, finalScore?: number) => {
    roomRef.current?.sendGameOver(reason, finalScore);
    setRoomState((prev) => ({ ...prev, status: 'finished' }));
  }, []);

  // Request rematch
  const requestRematch = useCallback(() => {
    if (!roomRef.current) return;

    roomRef.current.requestRematch();
    setRoomState((prev) => ({ ...prev, rematchRequested: true }));

    // If opponent already requested, trigger acceptRematch
    if (opponent?.rematchRequested) {
      roomRef.current.acceptRematch();
    }
  }, [opponent?.rematchRequested]);

  // Accept rematch
  const acceptRematch = useCallback(() => {
    roomRef.current?.acceptRematch();
  }, []);

  return {
    roomState,
    opponent,
    isConnected,
    publicKey: roomRef.current?.publicKey ?? '',

    createRoom,
    joinRoom,
    leaveRoom,
    reconnect,

    sendState,
    sendGameOver,
    requestRematch,
    acceptRematch,
  };
}

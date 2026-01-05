# nostr-battle-room

Nostr-based real-time battle room for multiplayer games. No server required.

## Features

- **P2P Matchmaking**: Create and join rooms via shareable URLs
- **Real-time State Sync**: Send game state to opponents with automatic throttling
- **Connection Health**: Heartbeat and disconnect detection
- **Reconnection**: Automatic reconnection from localStorage
- **Rematch**: Built-in rematch flow
- **Framework Agnostic**: Core classes work anywhere, React hooks included

## Installation

```bash
npm install nostr-battle-room nostr-tools
```

## Quick Start

### React

```tsx
import { useBattleRoom } from 'nostr-battle-room/react';

interface MyGameState {
  score: number;
  position: { x: number; y: number };
}

function Game() {
  const { roomState, opponent, createRoom, joinRoom, sendState, leaveRoom } =
    useBattleRoom<MyGameState>({
      gameId: 'my-game',
    });

  const handleCreate = async () => {
    const url = await createRoom();
    // Share this URL with opponent
    navigator.clipboard.writeText(url);
  };

  const handleMove = (x: number, y: number) => {
    sendState({ score: 100, position: { x, y } });
  };

  return (
    <div>
      <p>Status: {roomState.status}</p>
      {roomState.status === 'idle' && <button onClick={handleCreate}>Create Room</button>}
      {opponent && <p>Opponent score: {opponent.gameState?.score ?? 0}</p>}
    </div>
  );
}
```

### Vanilla JavaScript

```typescript
import { BattleRoom } from 'nostr-battle-room';

interface MyGameState {
  score: number;
}

const room = new BattleRoom<MyGameState>({
  gameId: 'my-game',
  relays: ['wss://relay.damus.io'],
});

// Register event callbacks (chainable)
room
  .onOpponentJoin((pubkey) => {
    console.log('Opponent joined:', pubkey);
  })
  .onOpponentState((state) => {
    console.log('Opponent score:', state.score);
  })
  .onOpponentDisconnect(() => {
    console.log('Opponent disconnected');
  });

// Create a room
room.connect();
const url = await room.create();
console.log('Share this URL:', url);

// Send state updates
room.sendState({ score: 100 });

// Game over
room.sendGameOver('win', 500);

// Cleanup
room.disconnect();
```

## API

### BattleRoomConfig

```typescript
interface BattleRoomConfig {
  gameId: string; // Required: unique game identifier
  relays?: string[]; // Nostr relay URLs (default: public relays)
  roomExpiry?: number; // Room expiration in ms (default: 600000 = 10 min)
  heartbeatInterval?: number; // Heartbeat interval in ms (default: 3000)
  disconnectThreshold?: number; // Disconnect threshold in ms (default: 10000)
  stateThrottle?: number; // State update throttle in ms (default: 100)
}
```

### Room States

| Status   | Description                           |
| -------- | ------------------------------------- |
| idle     | No room active                        |
| creating | Creating a new room                   |
| waiting  | Waiting for opponent to join          |
| joining  | Joining an existing room              |
| ready    | Both players connected, ready to play |
| playing  | Game in progress                      |
| finished | Game ended                            |

### Events (Callbacks)

| Event              | Parameters                       | Description                |
| ------------------ | -------------------------------- | -------------------------- |
| opponentJoin       | (publicKey: string)              | Opponent joined the room   |
| opponentState      | (state: TGameState)              | Opponent sent state update |
| opponentDisconnect | ()                               | Opponent disconnected      |
| opponentGameOver   | (reason: string, score?: number) | Opponent game over         |
| rematchRequested   | ()                               | Opponent requested rematch |
| rematchStart       | (newSeed: number)                | Rematch starting           |
| error              | (error: Error)                   | Error occurred             |

## Node.js / Proxy Support

For Node.js environments or when you need proxy support, call `configureProxy()` before creating any rooms:

```typescript
import { configureProxy, BattleRoom } from 'nostr-battle-room';

// Call once at startup
configureProxy();

// Now create rooms as usual
const room = new BattleRoom({ gameId: 'my-game' });
```

This function:

- Configures the `ws` package for Node.js WebSocket support
- Reads proxy URL from environment variables: `HTTPS_PROXY`, `HTTP_PROXY`, or `ALL_PROXY`
- No-op in browser environments (browsers handle proxies at OS level)

**Required packages for Node.js:**

```bash
npm install ws                    # Required for Node.js
npm install https-proxy-agent     # Required for proxy support
```

## Testing

```typescript
import { MockBattleRoom } from 'nostr-battle-room/testing';

const mock = new MockBattleRoom<MyGameState>({ gameId: 'test' });

// Simulate opponent actions
mock.simulateOpponentJoin('pubkey123');
mock.simulateOpponentState({ score: 100 });
mock.simulateOpponentDisconnect();
```

## How It Works

1. **Room Creation**: Host publishes a replaceable event (kind 30078) with room info
2. **Joining**: Guest fetches room event, sends join notification (kind 25000)
3. **State Sync**: Players send ephemeral events (kind 25000) with game state
4. **Heartbeat**: Periodic heartbeat events detect disconnections
5. **Cleanup**: Ephemeral events are not stored by relays (no garbage)

## License

MIT

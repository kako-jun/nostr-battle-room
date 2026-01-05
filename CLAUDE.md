# CLAUDE.md - Project Context for Claude

## Project: nostr-battle-room

A generic NPM package for Nostr-based real-time multiplayer game rooms. No server required.

## Quick Start

```bash
cd packages/nostr-battle-room
npm install   # Install dependencies
npm run build # Build TypeScript
npm run dev   # Watch mode
```

## Documentation

- [docs/architecture.md](docs/architecture.md) - System design, class structure
- [docs/protocol.md](docs/protocol.md) - Nostr event types, message flow
- [README.md](README.md) - User-facing documentation

## Architecture

```
src/
├── index.ts              # Main entry, exports
├── types.ts              # All TypeScript types
├── proxy.ts              # Proxy/Node.js WebSocket setup
├── core/
│   ├── NostrClient.ts    # Low-level Nostr connection
│   └── BattleRoom.ts     # Main room management class
├── react/
│   └── useBattleRoom.ts  # React hook wrapper
└── testing/
    └── MockBattleRoom.ts # Testing utilities
```

### Key Classes

| Class            | Purpose                                   |
| ---------------- | ----------------------------------------- |
| `NostrClient`    | Nostr relay connection, publish/subscribe |
| `BattleRoom`     | Room lifecycle, state sync, heartbeat     |
| `useBattleRoom`  | React hook wrapping BattleRoom            |
| `MockBattleRoom` | Testing without real Nostr                |

### Dependencies

- `nostr-tools` - Nostr protocol implementation (peer dependency)
- `react` - For React hooks (optional peer dependency)
- `ws` - WebSocket for Node.js (optional peer dependency)
- `https-proxy-agent` - Proxy support (optional peer dependency)

## Design Principles

1. **Framework Agnostic**: Core classes work without React
2. **Generic State**: `TGameState` type parameter for any game
3. **Minimal API**: Simple create/join/leave/sendState interface
4. **Automatic Health**: Heartbeat and disconnect detection built-in
5. **No Server**: Relies entirely on Nostr relays

## Key Types

```typescript
// Configuration
interface BattleRoomConfig {
  gameId: string; // Unique game identifier
  relays?: string[]; // Nostr relay URLs
  roomExpiry?: number; // Room expiration (ms)
  heartbeatInterval?: number; // Heartbeat interval (ms)
  disconnectThreshold?: number; // Disconnect threshold (ms)
  stateThrottle?: number; // State update throttle (ms)
}

// Room status flow
type RoomStatus = 'idle' | 'creating' | 'waiting' | 'joining' | 'ready' | 'playing' | 'finished';
```

## Event Callbacks

```typescript
room.onOpponentJoin((publicKey) => {});
room.onOpponentState((state) => {});
room.onOpponentDisconnect(() => {});
room.onOpponentGameOver((reason, score) => {});
room.onRematchRequested(() => {});
room.onRematchStart((newSeed) => {});
room.onError((error) => {});
```

## Nostr Event Kinds

| Kind  | Type        | Purpose                                 |
| ----- | ----------- | --------------------------------------- |
| 30078 | Replaceable | Room metadata (persists until replaced) |
| 25000 | Ephemeral   | Game state, heartbeat (not stored)      |

## Testing

```typescript
import { MockBattleRoom } from 'nostr-battle-room/testing';

const mock = new MockBattleRoom({ gameId: 'test' });
mock.simulateOpponentJoin('pubkey');
mock.simulateOpponentState({ score: 100 });
```

## Common Tasks

### Adding a new event type

1. Add type to `types.ts` (e.g., `NewEventContent`)
2. Add to `BattleEventContent` union type
3. Handle in `BattleRoom.handleRoomEvent()`
4. Add callback method `onNewEvent()`
5. Update `MockBattleRoom` with `simulateNewEvent()`

### Changing default config

Edit `DEFAULT_CONFIG` in `types.ts`

### Adding React hook functionality

1. Update `useBattleRoom.ts`
2. Export new return values in `UseBattleRoomReturn`

### Node.js / Proxy setup

Call `configureProxy()` before creating rooms:

```typescript
import { configureProxy } from 'nostr-battle-room';
configureProxy(); // Reads HTTPS_PROXY, HTTP_PROXY, ALL_PROXY env vars
```

Related files:

- `src/proxy.ts` - Proxy configuration utility

# Nostr Protocol Specification

## Why Nostr?

| Feature           | Nostr                  | WebRTC              | WebSocket Server |
| ----------------- | ---------------------- | ------------------- | ---------------- |
| Server required   | No (relays are public) | No                  | Yes              |
| NAT traversal     | No issues              | Complex (STUN/TURN) | N/A              |
| Data persistence  | Optional               | No                  | Depends          |
| Built-in identity | Yes (public keys)      | No                  | No               |
| Latency           | 50-200ms               | 10-50ms             | 50-100ms         |

Nostr is ideal for turn-based or low-frequency state sync games.

## Event Kinds

| Kind  | Type        | Stored | Purpose               |
| ----- | ----------- | ------ | --------------------- |
| 30078 | Replaceable | Yes    | Room metadata         |
| 25000 | Ephemeral   | No     | Game state, heartbeat |

### Why These Kinds?

- **30078 (Replaceable)**: Room info needs to persist so joiners can find it
- **25000 (Ephemeral)**: Game state is temporary, no garbage accumulation

## Message Flow

### Room Creation

```
Player A                    Relay                     Player B
    │                         │                           │
    │──publish(30078)────────▶│                           │
    │  Room metadata          │                           │
    │                         │                           │
    │──subscribe(25000)──────▶│                           │
    │  Listen for joins       │                           │
    │                         │                           │
```

### Room Joining

```
Player A                    Relay                     Player B
    │                         │                           │
    │                         │◀──fetch(30078)────────────│
    │                         │   Get room info           │
    │                         │                           │
    │                         │◀──subscribe(25000)────────│
    │                         │   Listen for events       │
    │                         │                           │
    │◀────────────────────────│◀──publish(25000)──────────│
    │  Receive join event     │   type: "join"            │
    │                         │                           │
```

### State Synchronization

```
Player A                    Relay                     Player B
    │                         │                           │
    │──publish(25000)────────▶│──────────────────────────▶│
    │  type: "state"          │                           │
    │  gameState: {...}       │                           │
    │                         │                           │
    │◀────────────────────────│◀──publish(25000)──────────│
    │                         │   type: "state"           │
    │                         │   gameState: {...}        │
    │                         │                           │
```

### Heartbeat

```
Every 3 seconds:

Player A                    Relay                     Player B
    │                         │                           │
    │──publish(25000)────────▶│──────────────────────────▶│
    │  type: "heartbeat"      │                           │
    │  timestamp: 1704000000  │                           │
    │                         │                           │
```

If no heartbeat received for 10 seconds, opponent is considered disconnected.

## Event Formats

### Room Creation (kind 30078)

```json
{
  "kind": 30078,
  "tags": [
    ["d", "{gameId}-room-{roomId}"],
    ["t", "{gameId}"]
  ],
  "content": {
    "type": "room",
    "status": "waiting",
    "seed": 123456789,
    "hostPubkey": "<hex-pubkey>"
  }
}
```

### Join (kind 25000)

```json
{
  "kind": 25000,
  "tags": [["d", "{gameId}-room-{roomId}"]],
  "content": {
    "type": "join",
    "playerPubkey": "<hex-pubkey>"
  }
}
```

### State Update (kind 25000)

```json
{
  "kind": 25000,
  "tags": [["d", "{gameId}-room-{roomId}"]],
  "content": {
    "type": "state",
    "gameState": {
      // Your game's state object
    }
  }
}
```

### Heartbeat (kind 25000)

```json
{
  "kind": 25000,
  "tags": [["d", "{gameId}-room-{roomId}"]],
  "content": {
    "type": "heartbeat",
    "timestamp": 1704000000000
  }
}
```

### Game Over (kind 25000)

```json
{
  "kind": 25000,
  "tags": [["d", "{gameId}-room-{roomId}"]],
  "content": {
    "type": "gameover",
    "reason": "win|lose|disconnect|surrender",
    "finalScore": 500,
    "winner": "<hex-pubkey>"
  }
}
```

### Rematch Request (kind 25000)

```json
{
  "kind": 25000,
  "tags": [["d", "{gameId}-room-{roomId}"]],
  "content": {
    "type": "rematch",
    "action": "request"
  }
}
```

### Rematch Accept (kind 25000)

```json
{
  "kind": 25000,
  "tags": [["d", "{gameId}-room-{roomId}"]],
  "content": {
    "type": "rematch",
    "action": "accept",
    "newSeed": 987654321
  }
}
```

## Tag Format

Room tag format: `{gameId}-room-{roomId}`

Examples:

- `sasso-room-abc123`
- `tetris-room-xyz789`

This ensures different games don't interfere with each other.

## Default Relays

```typescript
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
```

These are public relays with good uptime. Games can specify custom relays.

## Security Considerations

1. **Event Signing**: All events are cryptographically signed
2. **Public Key Identity**: Players identified by Nostr public key
3. **No Encryption**: Game state is visible to relay operators
4. **Ephemeral Data**: Game state not permanently stored

For games requiring privacy, consider encrypting the `content` field.

## Bandwidth Estimation

| Event Type   | Size       | Frequency  | Bandwidth |
| ------------ | ---------- | ---------- | --------- |
| State update | ~500 bytes | 10/sec max | ~5 KB/s   |
| Heartbeat    | ~200 bytes | 1/3sec     | ~70 B/s   |

Total: ~5-6 KB/s per player (comparable to chat applications)

# Architecture

## Overview

nostr-battle-room provides a generic battle room system for 2-player online games using Nostr protocol.

```
┌─────────────────────────────────────────────────────────┐
│                      Your Game                          │
│  ┌─────────────────┐     ┌─────────────────────────┐   │
│  │   Game Logic    │────▶│  useBattleRoom (React)  │   │
│  │   (your code)   │     │  or BattleRoom (core)   │   │
│  └─────────────────┘     └───────────┬─────────────┘   │
└──────────────────────────────────────┼─────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────┐
│                   nostr-battle-room                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  BattleRoom                      │   │
│  │  - Room lifecycle (create/join/leave)           │   │
│  │  - State synchronization                        │   │
│  │  - Heartbeat / disconnect detection             │   │
│  │  - Rematch handling                             │   │
│  └───────────────────────┬─────────────────────────┘   │
│                          │                              │
│  ┌───────────────────────▼─────────────────────────┐   │
│  │                  NostrClient                     │   │
│  │  - Relay connection management                  │   │
│  │  - Event publishing                             │   │
│  │  - Event subscription                           │   │
│  └───────────────────────┬─────────────────────────┘   │
└──────────────────────────┼─────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Nostr Relays                         │
│         wss://relay.damus.io, wss://nos.lol, ...       │
└─────────────────────────────────────────────────────────┘
```

## Class Structure

### NostrClient

Low-level Nostr connection management.

```typescript
class NostrClient {
  // Connection
  connect(): void;
  disconnect(): void;

  // Properties
  get isConnected(): boolean;
  get publicKey(): string;

  // Operations
  publish(event): Promise<void>;
  subscribe(filters, onEvent): Unsubscribe;
  fetch(filter, timeout): Promise<NostrEvent[]>;
}
```

**Responsibilities:**

- Manage WebSocket connections to relays
- Generate/store Nostr key pair
- Sign and publish events
- Subscribe to event streams

### BattleRoom

Main class for room management.

```typescript
class BattleRoom<TGameState> {
  // Connection
  connect(): void;
  disconnect(): void;

  // Room lifecycle
  create(baseUrl?): Promise<string>;
  join(roomId): Promise<void>;
  leave(): void;
  reconnect(): Promise<boolean>;

  // Game state
  sendState(state: TGameState): void;
  sendGameOver(reason, score?): void;
  requestRematch(): void;
  acceptRematch(): void;

  // Event callbacks
  onOpponentJoin(callback): this;
  onOpponentState(callback): this;
  onOpponentDisconnect(callback): this;
  onOpponentGameOver(callback): this;
  onRematchRequested(callback): this;
  onRematchStart(callback): this;
  onError(callback): this;

  // Properties
  get roomState(): RoomState;
  get opponent(): OpponentState | null;
  get isConnected(): boolean;
  get publicKey(): string;
  get hasConnectedRelay(): boolean;
  getRelayStatus(): Map<string, boolean>;
}
```

**Responsibilities:**

- Room creation and joining
- State synchronization with throttling
- Heartbeat sending (every 3s)
- Disconnect detection (10s threshold)
- localStorage persistence for reconnection
- Rematch coordination

### useBattleRoom (React Hook)

React wrapper for BattleRoom.

```typescript
function useBattleRoom<TGameState>(
  config: BattleRoomConfig,
  callbacks?: BattleRoomCallbacks<TGameState>
): UseBattleRoomReturn<TGameState>;
```

**Returns:**

- All BattleRoom functionality
- React state that updates on changes
- Memoized callbacks

## API Method Types

各メソッドの動作方式（同期/非同期/コールバック）を以下に整理する。

### 同期メソッド (Sync)

即座に完了し、戻り値またはvoidを返す。ブロックしない。

| メソッド                       | 戻り値                 | 説明                                                                   |
| ------------------------------ | ---------------------- | ---------------------------------------------------------------------- |
| `connect()`                    | `void`                 | Nostr接続を開始（WebSocket接続自体は非同期だが、メソッドは即座に返る） |
| `disconnect()`                 | `void`                 | 接続を切断                                                             |
| `leave()`                      | `void`                 | ルームを退出、状態をリセット                                           |
| `sendState(state)`             | `void`                 | ゲーム状態を送信（内部でfireAndForget）                                |
| `sendGameOver(reason, score?)` | `void`                 | ゲーム終了を通知（内部でfireAndForget）                                |
| `requestRematch()`             | `void`                 | リマッチをリクエスト（内部でfireAndForget）                            |
| `acceptRematch()`              | `void`                 | リマッチを承諾（内部でfireAndForget）                                  |
| `getRelayStatus()`             | `Map<string, boolean>` | リレー接続状態を取得                                                   |

**Fire and Forget**: `sendState`等は内部で`publish()`を呼ぶが、awaitしない。
エラーは`onError`コールバックで通知される。

```typescript
// 使用例: 同期メソッドは即座に返る
room.connect();
room.sendState({ score: 100 }); // 送信完了を待たない
```

### 非同期メソッド (Async/Promise)

`Promise`を返す。`await`または`.then()`で完了を待つ。

| メソッド           | 戻り値             | 説明                          |
| ------------------ | ------------------ | ----------------------------- |
| `create(baseUrl?)` | `Promise<string>`  | ルーム作成、招待URLを返す     |
| `join(roomId)`     | `Promise<void>`    | ルームに参加                  |
| `reconnect()`      | `Promise<boolean>` | 再接続を試行、成功/失敗を返す |

**特徴:**

- タイムアウト付き（デフォルト30秒）
- 失敗時は例外をthrow（`reconnect`は`false`を返す）
- 完了まで状態は`creating`/`joining`

```typescript
// 使用例: 非同期メソッドはawaitする
try {
  const url = await room.create();
  console.log('Room created:', url);
} catch (error) {
  console.error('Failed to create room:', error.message);
}
```

### コールバック (Event Callbacks)

イベント発生時に呼び出される。登録はメソッドチェーン可能。

| コールバック           | 引数                                    | タイミング                            |
| ---------------------- | --------------------------------------- | ------------------------------------- |
| `onOpponentJoin`       | `(publicKey: string)`                   | 対戦相手がルームに参加                |
| `onOpponentState`      | `(state: TGameState)`                   | 対戦相手の状態更新を受信              |
| `onOpponentDisconnect` | `()`                                    | 対戦相手が切断（10秒間heartbeatなし） |
| `onOpponentGameOver`   | `(reason: string, finalScore?: number)` | 対戦相手がゲーム終了                  |
| `onRematchRequested`   | `()`                                    | 対戦相手がリマッチをリクエスト        |
| `onRematchStart`       | `(newSeed: number)`                     | リマッチ開始（新しいシード値）        |
| `onError`              | `(error: Error)`                        | エラー発生（ネットワーク、パース等）  |

**特徴:**

- 登録順に関係なくイベント発生時に呼ばれる
- 複数回呼ばれる可能性あり（`onOpponentState`は高頻度）
- `onError`は他の操作の失敗も通知

```typescript
// 使用例: コールバック登録（メソッドチェーン）
room
  .onOpponentJoin((pubkey) => console.log('Opponent joined:', pubkey))
  .onOpponentState((state) => updateOpponentDisplay(state))
  .onOpponentDisconnect(() => showDisconnectWarning())
  .onError((err) => showErrorToast(err.message));
```

### プロパティ (Getters)

現在の状態を同期的に取得。

| プロパティ          | 型                      | 説明                              |
| ------------------- | ----------------------- | --------------------------------- |
| `roomState`         | `RoomState`             | 現在のルーム状態                  |
| `opponent`          | `OpponentState \| null` | 対戦相手の情報                    |
| `isConnected`       | `boolean`               | Nostrクライアントが接続済みか     |
| `publicKey`         | `string`                | 自分のNostr公開鍵                 |
| `hasConnectedRelay` | `boolean`               | 少なくとも1つのリレーに接続済みか |

```typescript
// 使用例: プロパティは即座に値を返す
if (room.isConnected && room.roomState.status === 'ready') {
  startGame(room.roomState.seed);
}
```

### 内部処理の流れ

```
ユーザー操作              内部処理                          結果
─────────────────────────────────────────────────────────────────
create()     ──async──▶  publish(room event)  ──await──▶  URL返却
                         subscribe(room)      ──sync───▶  (登録のみ)

sendState()  ──sync───▶  publish(state)       ──fire&forget──▶ (即座に返る)
                              │
                              └──catch──▶ onError callback

opponent     ◀──callback── subscribe handler ◀── relay event
state update
```

### NostrClient API

低レベルAPI。通常は`BattleRoom`経由で使用。

| メソッド                      | 種別            | 説明                              |
| ----------------------------- | --------------- | --------------------------------- |
| `connect()`                   | sync            | 接続開始                          |
| `disconnect()`                | sync            | 切断                              |
| `publish(event)`              | async           | イベント送信（retry付き）         |
| `subscribe(filters, onEvent)` | sync + callback | 購読開始、`Unsubscribe`関数を返す |
| `fetch(filter, timeout)`      | async           | 一回限りのクエリ、EOSE待ち        |
| `getRelayStatus()`            | sync            | 接続状態取得                      |

## State Flow

```
┌─────────┐  create()   ┌─────────┐  opponent   ┌─────────┐
│  idle   │────────────▶│ waiting │────joins───▶│  ready  │
└─────────┘             └─────────┘             └────┬────┘
     ▲                                               │
     │                                          game starts
     │                                               │
     │                  ┌──────────┐             ┌───▼─────┐
     │◀────leave()──────│ finished │◀──gameover──│ playing │
     │                  └────┬─────┘             └─────────┘
     │                       │
     │                   rematch
     │                       │
     │                  ┌────▼────┐
     └──────────────────│  ready  │
                        └─────────┘
```

## Storage

### localStorage Keys

| Key             | Content                       | Expiry     |
| --------------- | ----------------------------- | ---------- |
| `{gameId}-key`  | Nostr secret key (JSON array) | Never      |
| `{gameId}-room` | Room data for reconnection    | 10 minutes |

### Stored Room Data

```typescript
interface StoredRoomData {
  roomId: string;
  isHost: boolean;
  seed: number;
  createdAt: number;
  opponentPubkey?: string;
}
```

## Timing

| Constant              | Default           | Description           |
| --------------------- | ----------------- | --------------------- |
| `roomExpiry`          | 600000ms (10 min) | Room expiration       |
| `heartbeatInterval`   | 3000ms            | Heartbeat sending     |
| `disconnectThreshold` | 10000ms           | Disconnect detection  |
| `stateThrottle`       | 100ms             | State update throttle |
| `joinTimeout`         | 30000ms           | Join timeout          |

## Error Handling

Errors are reported via `onError` callback:

```typescript
room.onError((error) => {
  console.error('Battle room error:', error.message);
});
```

### Common Errors

| Error Message                                  | Cause                                  |
| ---------------------------------------------- | -------------------------------------- |
| `"Room not found"`                             | Room doesn't exist or expired          |
| `"Room has expired"`                           | Room older than 10 minutes             |
| `"NostrClient not connected"`                  | Called method before connect()         |
| `"Invalid room data"`                          | Room event content is not valid JSON   |
| `"Invalid room data: missing required fields"` | Room event missing seed or hostPubkey  |
| `"Join operation timed out"`                   | Join took longer than joinTimeout      |
| `"Create operation timed out"`                 | Create took longer than joinTimeout    |
| `"Reconnect operation timed out"`              | Reconnect took longer than joinTimeout |
| `"No relay response: timeout"`                 | No relay sent EOSE within timeout      |
| `"No relay response: ..."`                     | All relays failed to respond           |
| `"Failed to connect to relays: ..."`           | Could not fetch room data from relays  |

### Retry Logic

Network operations use exponential backoff retry:

```typescript
// Default retry options for publish operations
{
  maxAttempts: 3,
  initialDelay: 1000,  // 1 second
  maxDelay: 5000,      // 5 seconds max
  backoffMultiplier: 2
}
```

Retry applies to:

- `NostrClient.publish()` - Event publishing to relays

### Timeout Handling

Operations that wait for external events have timeouts:

| Operation     | Timeout Config | Default |
| ------------- | -------------- | ------- |
| `create()`    | `joinTimeout`  | 30000ms |
| `join()`      | `joinTimeout`  | 30000ms |
| `reconnect()` | `joinTimeout`  | 30000ms |

On timeout, the operation throws and state is reset to `idle`.

### Storage Error Resilience

Storage operations (localStorage) are wrapped in try-catch:

- Quota exceeded errors are logged but don't crash
- Missing or corrupted data is treated as "no data"
- Key generation continues even if storage fails (ephemeral keys)

### Relay Connection Monitoring

Check relay connection status programmatically:

```typescript
// Get status of each relay
const status = room.getRelayStatus();
// Map<string, boolean> e.g. { "wss://relay.damus.io": true, "wss://nos.lol": false }

// Check if at least one relay is connected
if (room.hasConnectedRelay) {
  // Can communicate
}
```

The `fetch()` method now properly distinguishes:

- **Relay responded with no data**: Room doesn't exist → `"Room not found"`
- **No relay responded**: Connection issue → `"No relay response: ..."`

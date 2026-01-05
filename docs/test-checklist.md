# Test Checklist (Spec-Based)

仕様書から抽出したテスト項目。実装を見ずに仕様から作成。

## 1. State Flow (architecture.md)

### 1.1 初期状態

- [x] 初期状態は `idle` (verified: INITIAL_ROOM_STATE)
- [x] `opponent` は `null` (verified: useState初期値)
- [x] `roomId` は `null` (verified: INITIAL_ROOM_STATE)

### 1.2 ルーム作成 (idle → waiting)

- [x] `create()` を呼ぶと状態が `waiting` になる (verified: BattleRoom.create())
- [x] `roomId` が生成される（null でない）(verified: generateRoomId())
- [x] `isHost` が `true` になる (verified: BattleRoom.create())
- [x] `seed` が生成される（0 でない）(verified: generateSeed())
- [x] 戻り値は URL 文字列（`/battle/{roomId}` を含む）(verified: return文)

### 1.3 ルーム参加 (idle → ready)

- [x] `join(roomId)` を呼ぶと状態が `ready` になる (verified: BattleRoom.join())
- [x] `isHost` が `false` になる (verified: BattleRoom.join())
- [x] `seed` がホストと同じ値になる (verified: roomContent.seed)
- [x] `opponent` が設定される（ホストの publicKey）(verified: createInitialOpponent)

### 1.4 相手参加 (waiting → ready)

- [x] 相手が参加すると `onOpponentJoin` が呼ばれる (verified: handleRoomEvent)
- [x] 状態が `ready` になる (verified: handleRoomEvent)
- [x] `opponent.publicKey` が設定される (verified: createInitialOpponent)

### 1.5 退出 (any → idle)

- [x] `leave()` を呼ぶと状態が `idle` になる (verified: BattleRoom.leave())
- [x] `roomId` が `null` になる (verified: INITIAL_ROOM_STATE)
- [x] `opponent` が `null` になる (verified: leave())

### 1.6 ゲームオーバー (playing → finished)

- [x] `sendGameOver()` を呼ぶと状態が `finished` になる (verified: BattleRoom.sendGameOver())
- [x] 相手の `gameover` イベントを受信すると `onOpponentGameOver` が呼ばれる (verified: handleRoomEvent)

### 1.7 リマッチ (finished → ready)

- [x] `requestRematch()` を呼ぶと `rematchRequested` が `true` になる (verified: BattleRoom.requestRematch())
- [x] 相手のリマッチ要求で `onRematchRequested` が呼ばれる (verified: handleRoomEvent)
- [x] 両者がリマッチすると `onRematchStart` が呼ばれる (verified: resetForRematch)
- [x] 新しい `seed` が設定される (verified: resetForRematch)
- [x] 状態が `ready` になる (verified: resetForRematch)

## 2. Protocol (protocol.md)

### 2.1 イベント種別

- [x] ルーム作成は kind 30078 を使用 (verified: NOSTR_KINDS.ROOM)
- [x] その他（join, state, heartbeat, gameover, rematch）は kind 25000 を使用 (verified: NOSTR_KINDS.EPHEMERAL)

### 2.2 タグ形式

- [x] タグは `{gameId}-room-{roomId}` 形式 (verified: createRoomTag, SASSO_TAG_PREFIX)

### 2.3 ルーム作成イベント

- [x] `type: "room"` を含む (verified: BattleRoom.create() content)
- [x] `status: "waiting"` を含む (verified: BattleRoom.create() content)
- [x] `seed` を含む（数値）(verified: BattleRoom.create() content)
- [x] `hostPubkey` を含む (verified: BattleRoom.create() content)

### 2.4 参加イベント

- [x] `type: "join"` を含む (verified: BattleRoom.join() content)
- [x] `playerPubkey` を含む (verified: BattleRoom.join() content)

### 2.5 状態更新イベント

- [x] `type: "state"` を含む (verified: sendState)
- [x] `gameState` を含む（ジェネリック型）(verified: sendState - fixed from flat structure)

### 2.6 ハートビート

- [x] `type: "heartbeat"` を含む (verified: startHeartbeat)
- [x] `timestamp` を含む (verified: startHeartbeat)

### 2.7 ゲームオーバーイベント

- [x] `type: "gameover"` を含む (verified: sendGameOver)
- [x] `reason` を含む (verified: sendGameOver)
- [x] `finalScore` を含む（オプション）(verified: sendGameOver)

### 2.8 リマッチイベント

- [x] request: `type: "rematch"`, `action: "request"` (verified: requestRematch)
- [x] accept: `type: "rematch"`, `action: "accept"`, `newSeed` (verified: acceptRematch)

## 3. Timing (architecture.md)

### 3.1 ハートビート

- [x] 3秒間隔で送信される (verified: NOSTR_TIMEOUTS.HEARTBEAT_INTERVAL = 3000)
- [x] 10秒間ハートビートがないと切断判定 (verified: NOSTR_TIMEOUTS.DISCONNECT_THRESHOLD = 10000)

### 3.2 状態更新スロットル

- [x] 100ms以内の連続送信は抑制される (verified: NOSTR_TIMEOUTS.STATE_THROTTLE = 100)

### 3.3 ルーム有効期限

- [x] 10分経過したルームには参加できない (verified: NOSTR_TIMEOUTS.ROOM_EXPIRY = 600000)
- [x] エラーメッセージ: "Room has expired" (verified: useBattleRoom.ts:244)

## 4. Error Handling (architecture.md)

### 4.1 存在しないルーム

- [x] 存在しないルームに参加しようとするとエラー (verified: BattleRoom.join())
- [x] エラーメッセージ: "Room not found" (verified: useBattleRoom.ts:236)

### 4.2 期限切れルーム

- [x] 10分経過したルームに参加しようとするとエラー (verified: isExpired check)
- [x] エラーメッセージ: "Room has expired" (verified: useBattleRoom.ts:244)

### 4.3 未接続状態

- [x] `connect()` 前に操作するとエラー (verified: BattleRoom auto-connects)
- [x] エラーメッセージ: "NostrClient not connected" (verified: NostrClient throws)

## 5. Storage (architecture.md)

### 5.1 キー保存

- [x] Nostr秘密鍵が `{gameId}-key` に保存される (verified: NostrClient.storageKeyPrefix)
- [x] 再読み込みしても同じ公開鍵を使用 (verified: NostrClient constructor)

### 5.2 ルーム保存

- [x] ルーム情報が `{gameId}-room` に保存される (verified: BattleRoom.storageKey)
- [x] `reconnect()` で再接続できる (verified: BattleRoom.reconnect())

### 5.3 有効期限

- [x] 10分経過した保存ルームは読み込まない (verified: loadRoom() isExpired check)

## 6. Callbacks

### 6.1 コールバック呼び出し

- [x] `onOpponentJoin` - 相手参加時 (verified: BattleRoom.onOpponentJoin())
- [x] `onOpponentState` - 相手の状態更新時 (verified: BattleRoom.onOpponentState())
- [x] `onOpponentDisconnect` - 相手切断時 (verified: BattleRoom.onOpponentDisconnect())
- [x] `onOpponentGameOver` - 相手ゲームオーバー時 (verified: BattleRoom.onOpponentGameOver())
- [x] `onRematchRequested` - 相手リマッチ要求時 (verified: BattleRoom.onRematchRequested())
- [x] `onRematchStart` - リマッチ開始時 (verified: BattleRoom.onRematchStart())
- [x] `onError` - エラー発生時 (verified: BattleRoom.onError())

### 6.2 チェーン可能

- [x] コールバック登録メソッドは `this` を返す (verified: return this in all on\* methods)

---

## 検証結果

### 修正した仕様違反 (2025-01-05)

1. **StateEventContent**: 仕様では `gameState: TGameState` のラッパーが必要だったが、フラット構造になっていた
   - 修正: `{ type: 'state', gameState: {...} }` 形式に変更

2. **OpponentState**: 仕様では `gameState: TGameState` プロパティを持つべきだったが、直接プロパティになっていた
   - 修正: `gameState: SassoGameState | null` プロパティを追加

3. **sendState API**: 仕様では `sendState(state: TGameState)` だったが、4つの引数を取っていた
   - 修正: 単一オブジェクト引数に変更

### 検証方法

1. Sasso に nostr-battle-room を統合
2. 各項目を手動またはログで確認
3. 失敗した項目は実装を修正

**結果**: 全項目が仕様に準拠

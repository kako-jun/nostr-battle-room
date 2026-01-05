# TODO

## Phase 1: Validation (完了)

- [x] Sassoで使用テスト
  - 現在のSasso実装を新パッケージで置き換え
  - 仕様ベースのテストチェックリスト作成 (docs/test-checklist.md)
  - 3つの仕様違反を発見・修正:
    1. StateEventContent: gameStateラッパー追加
    2. OpponentState: gameStateプロパティ使用
    3. sendState: 単一オブジェクト引数に変更
  - 全52項目の仕様確認完了

## Phase 2: Stabilization

- [x] プロキシ対応
  - 環境変数（HTTPS_PROXY, HTTP_PROXY, ALL_PROXY）からプロキシ設定
  - `configureProxy()` ユーティリティ関数
  - Node.js用ws設定
- [x] ユニットテスト追加
  - 仕様書ベースのテスト (57件)
  - config.test.ts: BattleRoomConfig デフォルト値
  - protocol.test.ts: Event Kinds, Tag Format, Event Content
  - state-flow.test.ts: 状態遷移図
  - callbacks.test.ts: 7種のコールバック
  - timing.test.ts: タイミング定数
- [x] エラーハンドリング強化
  - NostrClient.publish: 指数バックオフによるリトライ (デフォルト3回)
  - BattleRoom.join: タイムアウト処理 (デフォルト30秒)
  - retry.ts: withRetry, withTimeout ユーティリティ
  - error-handling.test.ts: エラーハンドリングのテスト追加

## Phase 3: Release

- [ ] 別リポジトリに切り出し
  - `github.com/kako-jun/nostr-battle-room`
  - CI/CD設定（GitHub Actions）
  - npm publish 用の設定
- [ ] npm publish
  - パッケージ名の確認（npmで利用可能か）
  - バージョン 0.1.0 としてリリース
- [ ] ドキュメント整備
  - 使用例の追加
  - API リファレンス完備

## Phase 4: Enhancement (将来)

- [ ] 3人以上対応
- [ ] 観戦モード
- [ ] リレー選択UI
- [ ] 暗号化オプション（プライベートゲーム用）

---

## 完了済み

- [x] パッケージ構造作成
- [x] NostrClient 実装
- [x] BattleRoom 実装
- [x] useBattleRoom (React hook) 実装
- [x] MockBattleRoom 実装
- [x] README.md 作成
- [x] CLAUDE.md 作成
- [x] docs/architecture.md 作成
- [x] docs/protocol.md 作成
- [x] docs/test-checklist.md 作成（仕様ベーステスト項目）
- [x] Sasso統合検証（全52項目合格）

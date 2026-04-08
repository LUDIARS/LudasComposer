# 統合テストスキル

Ars プロジェクトの統合テストを実行し、エラーを自動修正するスキル。

## 起動方法

- `/integration_test` コマンド
- 「統合テスト」と入力

## テスト対象

| セクション | コマンド | 対象 |
|-----------|---------|------|
| Frontend | `cd ars-editor && npm run lint && npx tsc -b && npm run build` | ESLint + TypeScript + Vite ビルド |
| Rust Backend | `cd ars-editor/src-tauri && cargo clippy --features web-server --no-default-features --bin ars-web-server -- -D warnings && cargo test` | Clippy + ユニットテスト |

## 自動修正フロー

1. テスト実行
2. エラーあり → `fix/integration-test-YYYYMMDD-HHMMSS` ブランチ作成
3. 修正コミット → push → PR 発行 (`Test` ラベル)
4. CI 待機 → 失敗なら再修正
5. 終了条件: 成功 / 同一エラー 3 回 / 修正 15 回到達

## エージェント

- 定義: `.claude/agents/integration-test.md`
- モデル: Sonnet
- 最小修正のみ。テストの削除・スキップは禁止。

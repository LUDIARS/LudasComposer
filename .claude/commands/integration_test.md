統合テストを実行し、エラーがあれば自動修正します。

## 実行内容

`integration-test` エージェント (Sonnet) を起動して以下を実行:

1. Frontend (lint + tsc + build) と Rust Backend (clippy + test) の統合テスト
2. エラーがなければ完了
3. エラーがあれば fix ブランチを作成し、修正コミット → push → PR発行 (Test ラベル付き)
4. CI完了を待機し、失敗なら再修正 (同一エラー3回 or 15回で打ち切り)

## エージェント起動

このコマンドは `integration-test` エージェントを起動します。
エージェントの定義: `.claude/agents/integration-test.md`

$ARGUMENTS

Arsフォーマット定義書から実装タスクを分解し、エージェントチームを指揮する。

## あなたの役割
あなたはリーダーエージェントです。以下を行います：

1. **設計分析**: 指示されたArsフォーマット定義書を読み込み、実装タスクに分解する
2. **タスク割り当て**: `.claude/agent-team.json` のエージェント構成に基づき、担当を決定する
3. **並列実装指示**: Agent ツールで各エージェントを起動し、並列に実装を進める
4. **レビュー**: 各エージェントの成果物をレビューする

## エージェント一覧
| ID | 担当セクション | テスト |
|----|---------------|--------|
| frontend-agent | ars-editor (React/TS) | vitest + tsc + lint |
| backend-agent | src-tauri (Rust) | cargo clippy + cargo test |
| data-agent | data-organizer (Rust) | cargo test + clippy |
| resource-agent | resource-depot (Rust+TS) | cargo test + clippy |
| codegen-agent | ars-codegen (TS) | tsc + vitest |
| mcp-agent | mcp-server (TS) | tsc + vitest |
| types-agent | src/types (TS) | tsc |

## ワークフロー
1. `$ARGUMENTS` の内容を分析
2. 影響するセクションを特定
3. 各担当エージェントの実装プロンプトを生成
4. Agent ツールで並列起動（依存がある場合は順序を考慮）
5. 全エージェント完了後、`/review` で成果物をレビュー
6. `/ci-check` で統合チェック

## 制約
- 各エージェントには必ずテストを書くよう指示する
- Arsフォーマット定義書がない場合はユーザーに要求する
- 既存コードを読んでから変更する

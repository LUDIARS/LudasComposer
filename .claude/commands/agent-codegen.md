コード生成 (ars-codegen) セクションの実装を行う。

## あなたの役割
あなたはコード生成エージェントです。`ars-codegen/` 配下の TypeScript コードを実装します。

## 技術スタック
- TypeScript (strict)
- Node.js
- Vitest — テスト

## 主要ファイル
- `src/project-loader.ts` — プロジェクトファイル読み込み
- `src/prompt-generator.ts` — プロンプト生成
- `src/session-runner.ts` — セッション管理
- `src/types.ts` — 型定義

## 実装ルール
1. 既存のコードを必ず読んでから変更する
2. TypeScript strict モードでコンパイルが通ること
3. テストを必ず書く（`*.test.ts`）
4. `src/types/` の共有型と整合性を保つ
5. プラットフォーム別コード生成は `platforms.md` に準拠する

## テスト実行
```bash
cd ars-codegen && npx tsc -b && npx vitest run
```

## タスク
$ARGUMENTS

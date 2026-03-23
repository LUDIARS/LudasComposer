リソース管理 (resource-depot) セクションの実装を行う。

## あなたの役割
あなたはリソースエージェントです。`resource-depot/` 配下のリソース管理コードを実装します。

## 技術スタック
- Rust (edition 2021) — `resource-depot/src-tauri/`
- TypeScript — `resource-depot/src/`
- Tauri 2 — デスクトップ統合
- Serde — シリアライズ/デシリアライズ

## 実装ルール
1. 既存のコードを必ず読んでから変更する
2. Rust: `clippy` の警告をゼロにする
3. Rust: テストを必ず書く（`#[cfg(test)]` モジュール）
4. Rust: `unwrap()` は使わない — `Result` / `Option` を適切にハンドリングする
5. TypeScript: `src/types/` の共有型と整合性を保つ

## テスト実行
```bash
cd resource-depot/src-tauri && cargo clippy -- -D warnings && cargo test
```

## タスク
$ARGUMENTS

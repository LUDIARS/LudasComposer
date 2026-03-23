バックエンド (src-tauri) セクションの実装を行う。

## あなたの役割
あなたはバックエンドエージェントです。`src-tauri/` 配下の Rust コードを実装します。

## 技術スタック
- Rust (edition 2021)
- Tauri 2 — デスクトップアプリフレームワーク
- Serde — シリアライズ/デシリアライズ
- Tokio — 非同期ランタイム

## 実装ルール
1. 既存のコードを必ず読んでから変更する
2. `clippy` の警告をゼロにする
3. テストを必ず書く（`#[cfg(test)]` モジュール）
4. `unwrap()` は使わない — `Result` / `Option` を適切にハンドリングする
5. 共有型は `src/types/` と整合性を保つ

## テスト実行
```bash
cd src-tauri && cargo clippy -- -D warnings && cargo test
```

## タスク
$ARGUMENTS

data-organizer クレートの実装を行う。

## あなたの役割
あなたはデータ処理エージェントです。`data-organizer/` 配下の Rust コードを実装します。

## 技術スタック
- Rust (edition 2021)
- Serde / serde_json — データシリアライズ
- 各種パーサー（プロジェクト固有）

## 実装ルール
1. 既存のコードを必ず読んでから変更する
2. `clippy` の警告をゼロにする
3. テストを必ず書く（`#[cfg(test)]` モジュール）
4. `unwrap()` は使わない — `Result` / `Option` を適切にハンドリングする
5. パフォーマンスを意識する（大きなデータセットを扱う可能性がある）

## テスト実行
```bash
cd data-organizer && cargo clippy -- -D warnings && cargo test
```

## タスク
$ARGUMENTS

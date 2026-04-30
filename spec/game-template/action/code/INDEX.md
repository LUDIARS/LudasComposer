# action / code — プログラマ視点の仕様 (サンプル)

クラス設計や実装詳細。 ボリュームが多いため **代表的なクラス数本** のみ記述する。

## 詳細ページ

- [PlayerActor.md](PlayerActor.md) — プレイヤーアクターのクラス設計
- [HitResolver.md](HitResolver.md) — 命中解決ロジックの設計

## 命名 / 配置

- Rust: `crates/game-action/src/<context>/<file>.rs`
- 1 構造体 ≒ 1 ファイル を目安。 大きい構造体は `mod` で分割。
- `pub` API は最小限、 内部実装は `pub(crate)` まで。

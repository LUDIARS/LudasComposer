# レイヤルール

Ars のすべてのモジュールは以下の 3 層構造に従う。

## Layer 1 — Domain model (ars-core)

- 構造体定義、trait 定義、EventBus 基盤のみ
- **実装を含まない**（Repository trait は定義するが、具体的な永続化ロジックは持たない）
- 外部クレートへの依存は最小限にする

## Layer 2 — Use case（ビジネスロジック）

- 純粋な `async` 関数群。`&self` を取らず、状態を持たない
- `&dyn Repository` を引数で受け取る。具体的な永続化手段を知らない
- EventBus を知らない。イベント発火は Layer 3 の責務
- ライフサイクル（プロジェクト Open/Close）を知らない
- **App 版でも Web 版でも同一コードが動く**

## Layer 3 — Host adapter（プラットフォーム固有）

| 変種 | 役割 |
|------|------|
| Layer 3a (App版) | `ProjectModule` trait 実装、`ModuleHost` 登録、`EventBus` 駆動 |
| Layer 3b (Web版) | Axum Handler / Router。リクエストごとに Layer 2 関数を呼ぶ |

## 依存方向

```
Layer 3 → Layer 2 → Layer 1
```

- 上位レイヤは下位レイヤに依存してよい
- **下位レイヤから上位レイヤへの依存は禁止**
- Layer 2 同士の横断依存は禁止（共通部分は Layer 1 に置く）
- Layer 3 同士（App版 / Web版）は互いに依存しない

## 判定基準

| 問い | Yes → | No → |
|------|-------|------|
| 型や trait の定義か？ | Layer 1 | ↓ |
| プラットフォームに依存しないロジックか？ | Layer 2 | ↓ |
| Tauri / Axum / OS 固有か？ | Layer 3 | 設計を見直す |

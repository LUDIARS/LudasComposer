# spec/ergo/ — Ergo 実装ドキュメント

`Ergo` ([LUDIARS/Ergo](https://github.com/LUDIARS/Ergo)) は Ars / 各ゲームから利用される **C++17 モジュラーフレームワーク**。 本ディレクトリは **Ars プロジェクトから Ergo を使う側の視点** で書いた詳細実装ドキュメントを集める。

> Ergo 内部の canonical な仕様は [LUDIARS/Ergo/spec/module/*.md](https://github.com/LUDIARS/Ergo/tree/main/spec/module) を真とする。 本ドキュメントは **「Ars / 各ジャンルから見たときの API・契約・統合パターン」** に焦点を当てる。

## 1. ドキュメント目次

### lexicon Feature を直接実装する 4 モジュール (詳細)

| ファイル | モジュール | game-lexicon Feature |
|---------|-----------|---------------------|
| [health.md](health.md) | `ergo_health` | `health-system` |
| [score.md](score.md) | `ergo_score` | `score-system` |
| [combo_counter.md](combo_counter.md) | `ergo_combo_counter` | `combo-counter` |
| [timing_judge.md](timing_judge.md) | `ergo_timing_judge` | `timing-judge` |

### 横断ドキュメント

| ファイル | 内容 |
|---------|------|
| [infrastructure.md](infrastructure.md) | 既存インフラ系モジュール (actor / audio / bind / blackboard / frame / log / io / world_time / particle / sound / ui / custos / common) を網羅、 各々の lexicon 寄与 |
| [integration.md](integration.md) | 複数モジュールを **どう組み合わせて 1 ゲームを構築するか** のパターン集 (アクターレイヤ / イベント / セーブ / 同期境界) |
| [roadmap.md](roadmap.md) | Ergo 化候補の優先順 + Phase 1 詳細設計 (`ergo_inventory` / `_input_buffer` / `_stats` / `_save_slot` / `_leveling`) |

## 2. Ergo モジュール一覧 (2026-05-01 時点)

### ゲーム実装系 (lexicon Feature を直接提供) — 4 モジュール

`ergo_health` / `ergo_score` / `ergo_combo_counter` / `ergo_timing_judge`

### インフラ / 横断系 — 14 モジュール + `ergo_common`

`ergo_actor` / `ergo_audio` / `ergo_bind` / `ergo_blackboard` / `ergo_custos` / `ergo_frame` / `ergo_gpu_particle` / `ergo_input` / `ergo_io` / `ergo_log` / `ergo_particle` / `ergo_sound` / `ergo_ui` / `ergo_world_time` + `ergo_common`

## 3. lexicon カバー率と関連リンク

- **直接 9%** (4/43) / **部分支援含めて 23%** (10/43)
- 詳細は [`game-feature-coverage.md`](../game-feature-coverage.md) 参照
- ロードマップは [roadmap.md](roadmap.md)

## 4. 設計原則 (Ergo 横断)

- **C++17 / 標準ライブラリのみ** が基本。 外部依存はモジュールごとに最小限
- **ヘッダ主体** の小さなロジック層が多い (健康 / スコア / コンボ / タイミング)
- **アクターモデル** (`ergo_actor`) を介してゲーム側に組み込む
- **データ駆動** の設定 (TOML / YAML / JSON) を将来的に統一
- **Pictor 依存はオプショナル** — 描画フックは差し替え可能

## 5. ライセンス / 配布

Ergo は LUDIARS 内部利用を想定。 個別ライセンスは [LUDIARS/Ergo/LICENSE](https://github.com/LUDIARS/Ergo/blob/main/LICENSE) を参照。

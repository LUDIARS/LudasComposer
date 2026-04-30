# spec/game-lexicon/ — ゲーム辞書のデータソース

ここはゲーム制作の **用語 (Term)** ・ **機能 (Feature)** ・ **ジャンル (Genre)** ・ **プリセット (Preset)** を **TOML ファイル** で集約する場所。

`crates/ars-game-lexicon` がここを **唯一の真実 (single source of truth)** として読む。 Rust コードに辞書を埋め込まない。

## 0. ファイル配置

```
spec/game-lexicon/
├── README.md                    # このファイル (データ形式)
├── genres/                      # ジャンル定義
│   ├── action.toml
│   ├── story-jrpg.toml
│   ├── open-world.toml
│   ├── shooter.toml
│   ├── runner.toml
│   ├── slg.toml
│   ├── rhythm.toml
│   ├── moba.toml
│   └── fighting.toml
├── features/                    # 機能定義 (1 機能 = 1 ファイル)
│   ├── core/                    # ジャンル横断
│   │   ├── health.toml
│   │   ├── input.toml
│   │   └── ...
│   ├── action/
│   ├── story-jrpg/
│   ├── ...
│   └── fighting/
├── presets/                     # ジャンル別プリセット
│   ├── action-basic.toml
│   ├── story-jrpg-basic.toml
│   └── ...
└── terms/                       # 用語集
    ├── combat.toml
    ├── progression.toml
    └── ui.toml
```

ファイル名は **kebab-case** を推奨。 ID と一致しなくてもよいが揃えると探しやすい。

## 1. 共通フィールド

すべての TOML ファイルは以下の規約に従う:

- `id`: snake_case の ASCII。 ファイル全域で一意。 後段の参照キーになるため変えない。
- `name_ja` / `name_en`: 表示名。 必ず両方書く (`I18nName` は Rust 側で `{ ja, en }` 構造体)。
- `summary`: 1〜2 文の説明 (UI のツールチップ用)。
- `tags`: タグ ID の配列 (検索 / 分類用)。

## 2. genres/<id>.toml

```toml
id = "action"
name_ja = "アクション"
name_en = "Action"
summary = "リアルタイム戦闘を中心とした 3D / 2D のアクションゲーム"
tags = ["realtime", "combat"]

# 既定プリセット (任意)
default_preset = "action-basic"

# 説明文 (UI で展開表示する用、 Markdown 可)
description = """
プレイヤー操作 → 攻撃判定 → ヒット応答 のサイクルが核。
カメラと当たり判定が重要。
"""
```

## 3. features/<group>/<id>.toml

```toml
id = "combo-system"
name_ja = "コンボシステム"
name_en = "Combo System"
summary = "連続入力で技をつなげる仕組み"
tags = ["combat", "input"]

# このフィーチャーが想定するジャンル
genres = ["action", "fighting"]

# 依存 / 競合 (id 配列)
depends_on = ["input-buffer", "hitbox-system"]
conflicts_with = []

# パラメータ宣言 (ウィザードが入力 UI を出す)
[[parameter]]
id = "max_combo"
type = "int"
default = 8
range = [1, 99]
description_ja = "最大コンボ段数"

[[parameter]]
id = "buffer_window_ms"
type = "int"
default = 200
range = [50, 1000]
description_ja = "次入力を受け付ける時間 (ms)"
```

`type` は `int | float | bool | string | enum`。 `enum` のときは `values = [...]` を追加する。

## 4. presets/<id>.toml

```toml
id = "action-basic"
name_ja = "アクション (基本)"
name_en = "Action (basic)"
genre = "action"
summary = "アクションゲームの最小構成"

# 含める Feature の id 配列。 順序は assemble 順を意図 (依存逆順は loader が検出)
features = [
  "input-buffer",
  "hitbox-system",
  "health-system",
  "combo-system",
  "dodge-roll",
]
```

## 5. terms/<group>.toml

1 ファイルに複数の用語を `[[term]]` で並べる:

```toml
[[term]]
id = "hitbox"
name_ja = "ヒットボックス"
name_en = "Hitbox"
aliases = ["当たり判定", "コリジョン"]
definition = "攻撃や被弾を判定する形状。 多くの場合、 表示モデルとは別の簡易形状を持つ"
tags = ["combat"]
related_terms = ["hurtbox", "iframe"]

[[term]]
id = "hurtbox"
name_ja = "ハートボックス"
name_en = "Hurtbox"
aliases = ["被弾判定"]
definition = "敵 / 自キャラがダメージを受ける範囲"
tags = ["combat"]
related_terms = ["hitbox"]
```

## 6. 検証ルール (loader が落とす)

| ID | 検証 |
|----|------|
| V01 | `id` の重複 (同 kind 内) |
| V02 | `genres / depends_on / conflicts_with / features / related_terms` で参照する ID が存在する |
| V03 | `depends_on` の循環 |
| V04 | `parameter.range` の `[min, max]` で min <= max |
| V05 | `parameter.type = "enum"` のとき `values` 必須 |
| V06 | `name_ja` / `name_en` / `summary` の空白 (どれか欠けたら警告) |

## 7. 拡張ガイド

新ジャンルを追加する手順:

1. `genres/<id>.toml` を作る
2. `features/<id>/` に最低 3 機能を作る (このジャンル特有のもの)
3. 既に `features/core/` にある汎用機能を `genres = [...]` に追加する (例: `health-system` は多くのジャンルが使う)
4. `presets/<id>-basic.toml` を作る
5. `terms/` に必要なら追記
6. `cargo test -p ars-game-lexicon` で loader が通ることを確認

## 8. このフォーマットの非ゴール

- バージョニング — 今は最新形を 1 つだけ持つ。 互換性破壊が必要になったら別ディレクトリで v2/ を切る
- 翻訳テーブルの完全管理 — `name_ja` / `name_en` の 2 言語に絞る。 多言語化は別レイヤー
- 実装コード — Feature の **実装** は ergo / unity / unreal プラグイン側。 ここは仕様だけ

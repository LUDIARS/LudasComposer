# spec/game-template/ — ゲームジャンル別テンプレート

各ジャンルを 1 フォルダで管理する **仕様駆動 (spec-driven) ドキュメントセット**。
各ジャンル直下に `INDEX.md` (概要) を置き、 必要に応じて以下のサブフォルダで詳細を記述する:

| サブフォルダ | 内容 | 担当 |
|--------------|------|------|
| `code/` | クラス設計などプログラマ視点の仕様 (サンプル数本) | Programmer |
| `codedesign/` | コアモジュール / レイヤ設計 (code と gamedesign の橋渡し) | Programmer + Tech Director |
| `gamedesign/` | レベルデザイン / 数値 / フロー (サンプル数本) | Planner |
| `test/` | 自動 / 手動テスト仕様 | QA / Programmer |
| `ubi/` | ユビキタス言語 (このジャンル特有の用語) | Planner + Programmer |
| `ux/` | プレイヤー体験 / ゲーム体験 (世界観はジャンル不問のためコピーしない) | UX |
| `feature/` | このジャンルが必要とする機能リスト + UX 寄与 | Planner + Programmer |

各サブフォルダ直下には `INDEX.md` を置き、 そこから個々の詳細ページへリンクする。

[`spec/game-lexicon/`](../game-lexicon/) が **用語 / 機能の辞書** (Feature の TOML データ集) であるのに対し、 本フォルダは **ジャンル単位の実装ガイド** で、 game-lexicon の Feature を組み合わせた **想定構成** を示す。

## 0. ジャンル目次

| ID | フォルダ | 代表作 |
|----|---------|--------|
| `action` | [action/](action/INDEX.md) | SEKIRO / Bayonetta |
| `platformer` | [platformer/](platformer/INDEX.md) | Super Mario Bros |
| `vampire_survivors_like` | [vampire_survivors_like/](vampire_survivors_like/INDEX.md) | Vampire Survivors |
| `slg_grid` | [slg_grid/](slg_grid/INDEX.md) | Fire Emblem / FFT |
| `strategy_4x` | [strategy_4x/](strategy_4x/INDEX.md) | Civilization |
| `puzzle_casual` | [puzzle_casual/](puzzle_casual/INDEX.md) | Royal Match / Candy Crush |
| `roguelike_berlin` | [roguelike_berlin/](roguelike_berlin/INDEX.md) | NetHack / DCSS |
| `deckbuilder_roguelike` | [deckbuilder_roguelike/](deckbuilder_roguelike/INDEX.md) | Slay the Spire |
| `moba` | [moba/](moba/INDEX.md) | League of Legends |
| `metroidvania` | [metroidvania/](metroidvania/INDEX.md) | Super Metroid / Symphony of the Night |
| `hack_and_slash` | [hack_and_slash/](hack_and_slash/INDEX.md) | Diablo / Path of Exile |
| `fighting` | [fighting/](fighting/INDEX.md) | Street Fighter / Guilty Gear |
| `rhythm` | [rhythm/](rhythm/INDEX.md) | Beatmania / DDR |
| `jrpg` | [jrpg/](jrpg/INDEX.md) | Dragon Quest / Final Fantasy |
| `open_world` | [open_world/](open_world/INDEX.md) | Zelda BotW / Skyrim |
| `shmup` | [shmup/](shmup/INDEX.md) | Gradius / 東方 |
| `fps` | [fps/](fps/INDEX.md) | Counter-Strike / Apex |

## 1. INDEX.md フォーマット

各ジャンルの `INDEX.md` は以下の節を持つ (game-lexicon との相互参照可能):

1. **概要** — 代表作 + コアループ + 「これがあるとこのジャンル」 と言える要素
2. **必要不可欠な機能実装** — feature_id 列挙 (詳細は `feature/` 配下)
3. **コアドメイン設計** — Mermaid 図 + 境界づけられたコンテキスト
4. **対応するコード設計** — Ars アクター + Ergo モジュール想定の疑似 Rust

## 2. game-lexicon との関係

```
ユーザー → ウィザード
                  ├─ game-template/<genre>/INDEX.md   (どの Feature を入れるか)
                  ├─ game-template/<genre>/feature/   (各 Feature の UX 寄与)
                  └─ game-lexicon/features/*.toml      (各 Feature の詳細)
                              │
                              ▼
                         Project assembly
```

- **game-lexicon** = 「Feature 単体の辞書」 (`combo-system`, `health-system` など)
- **game-template** = 「ジャンルごとに上記 Feature をどう束ねるか + どのような体験を狙うか」

## 3. 拡張ガイド

新ジャンルを追加する手順:

1. `spec/game-template/<id>/` を作る
2. `INDEX.md` を §1 のフォーマットで書く
3. 必要に応じて `code/` / `codedesign/` / `gamedesign/` / `test/` / `ubi/` / `ux/` / `feature/` を作って各 INDEX.md + 詳細ページを置く
4. 必要な Feature が `spec/game-lexicon/features/` に無ければ追加
5. 上の §0 目次に行を追加
6. (任意) `spec/modules/overview.md` で参照

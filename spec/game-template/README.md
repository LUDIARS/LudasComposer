# spec/game-template/ — ゲームジャンル別テンプレート

各ファイルは「あるジャンルでゲームを作るときに、 最初に決めるべき骨格」 を 1 ジャンル 1 ドキュメントで集約する。
[`spec/game-lexicon/`](../game-lexicon/) が **用語 / 機能の辞書** であるのに対し、 こちらは **ジャンル単位の実装ガイド** で、 game-lexicon の Feature を組み合わせた **想定構成** を示す。

## 0. 目次

| ID | ファイル | 代表作 |
|----|---------|--------|
| `action` | [action.md](action.md) | SEKIRO / Bayonetta |
| `platformer` | [platformer.md](platformer.md) | Super Mario Bros |
| `vampire_survivors_like` | [vampire_survivors_like.md](vampire_survivors_like.md) | Vampire Survivors |
| `slg_grid` | [slg_grid.md](slg_grid.md) | Fire Emblem / FFT |
| `strategy_4x` | [strategy_4x.md](strategy_4x.md) | Civilization |
| `puzzle_casual` | [puzzle_casual.md](puzzle_casual.md) | Royal Match / Candy Crush |
| `roguelike_berlin` | [roguelike_berlin.md](roguelike_berlin.md) | NetHack / DCSS |
| `deckbuilder_roguelike` | [deckbuilder_roguelike.md](deckbuilder_roguelike.md) | Slay the Spire |
| `moba` | [moba.md](moba.md) | League of Legends |
| `metroidvania` | [metroidvania.md](metroidvania.md) | Super Metroid / Symphony of the Night |
| `hack_and_slash` | [hack_and_slash.md](hack_and_slash.md) | Diablo / Path of Exile |
| `fighting` | [fighting.md](fighting.md) | Street Fighter / Guilty Gear |
| `rhythm` | [rhythm.md](rhythm.md) | Beatmania / DDR |
| `jrpg` | [jrpg.md](jrpg.md) | Dragon Quest / Final Fantasy |
| `open_world` | [open_world.md](open_world.md) | Zelda BotW / Skyrim |
| `shmup` | [shmup.md](shmup.md) | Gradius / 東方 |
| `fps` | [fps.md](fps.md) | Counter-Strike / Apex |

## 1. ファイルフォーマット

各テンプレは以下の節を必ず持つ:

```markdown
# <ジャンル日本語名> テンプレート

## 概要
代表作、 コアループ、 「これがあるとこのジャンル」 と言える要素を 2-4 段落で。

## 必要不可欠な機能実装
箇条書きで feature 候補を列挙。 各項目は `[<feature_id>]` を冒頭に置いて
[`spec/game-lexicon/features/`](../game-lexicon/features/) と相互参照可能にする。
リンク先がまだ無い場合は ID だけ書いて将来追加に備える。

## コアドメイン設計
DDD 寄り。 主要な aggregate / entity / value object と境界づけられたコンテキスト
を Mermaid 図 + 短い説明で。

## 対応するコード設計
具体的な layer / module 分割案。 Ars のアクター + Ergo モジュールに乗せた場合
の 「典型的な配置」 を疑似 Rust / 疑似 C++17 で。
```

## 2. game-lexicon との関係

- **game-lexicon** = 「Feature 単体の辞書」 (`combo-system`, `health-system` など)
- **game-template** = 「ジャンルごとに上記 Feature をどう束ねるか」

ウィザードや AI 補助は両方を読む:

```text
ユーザー → ウィザード
                  ├─ game-template/<genre>.md  (どの Feature を入れるか)
                  └─ game-lexicon/features/*.toml (各 Feature の詳細)
                              │
                              ▼
                         Project assembly
```

## 3. 拡張ガイド

新ジャンルを追加する手順:

1. `spec/game-template/<id>.md` を本 README §1 のフォーマットで書く
2. 必要な Feature が `spec/game-lexicon/features/` に無ければ追加
3. 上の §0 目次表に行を追加
4. (任意) `spec/modules/overview.md` で参照

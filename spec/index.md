# Ars — ゲーム仕様ドキュメント (デモ)

LUDIARS/Ars の **仕様駆動 (spec-driven) ドキュメント** をデモとして公開しています。

## 主要セクション

### 🎮 ゲームジャンル別テンプレート

[`game-template/`](game-template/README.md) — 17 ジャンル分の実装ガイド + UX 設計。 各ジャンルが `code/codedesign/gamedesign/test/ubi/ux/feature` のサブフォルダで詳細化。

| ID | 代表作 |
|----|--------|
| [action](game-template/action/INDEX.md) | SEKIRO / Bayonetta |
| [platformer](game-template/platformer/INDEX.md) | Super Mario Bros |
| [vampire_survivors_like](game-template/vampire_survivors_like/INDEX.md) | Vampire Survivors |
| [slg_grid](game-template/slg_grid/INDEX.md) | Fire Emblem / FFT |
| [strategy_4x](game-template/strategy_4x/INDEX.md) | Civilization |
| [puzzle_casual](game-template/puzzle_casual/INDEX.md) | Royal Match |
| [roguelike_berlin](game-template/roguelike_berlin/INDEX.md) | NetHack / DCSS |
| [deckbuilder_roguelike](game-template/deckbuilder_roguelike/INDEX.md) | Slay the Spire |
| [moba](game-template/moba/INDEX.md) | League of Legends |
| [metroidvania](game-template/metroidvania/INDEX.md) | Super Metroid |
| [hack_and_slash](game-template/hack_and_slash/INDEX.md) | Diablo / PoE |
| [fighting](game-template/fighting/INDEX.md) | Street Fighter |
| [rhythm](game-template/rhythm/INDEX.md) | Beatmania / DDR |
| [jrpg](game-template/jrpg/INDEX.md) | Dragon Quest |
| [open_world](game-template/open_world/INDEX.md) | Zelda BotW / Skyrim |
| [shmup](game-template/shmup/INDEX.md) | Gradius / 東方 |
| [fps](game-template/fps/INDEX.md) | Counter-Strike / Apex |

### 📚 ゲーム機能辞書 (game-lexicon)

[`game-lexicon/`](game-lexicon/README.md) — 仕様駆動の Feature 単体辞書 (TOML)。 ジャンル横断で再利用される **機能の最小単位**。

### 🔍 機能カバレッジ表

[`game-feature-coverage.md`](game-feature-coverage.md) — game-template × game-lexicon × Ergo の対応表 + Ergo 化ロードマップ。

### 🧱 モジュール仕様

[`modules/overview.md`](modules/overview.md) — Ars コアモジュール一覧 (アーキテクチャ + ライフサイクル)

[`modules/game-lexicon.md`](modules/game-lexicon.md) — ゲーム辞書モジュールの仕様

## 仕様駆動の方針

各サブディレクトリには `INDEX.md` (見出し + 詳細ページへのリンク) と詳細ページが存在します。
詳しくは [`game-template/README.md`](game-template/README.md) を参照。

## ソース

- リポジトリ: <https://github.com/LUDIARS/Ars>
- このサイトは [`spec/`](https://github.com/LUDIARS/Ars/tree/main/spec) を MkDocs Material でレンダリング

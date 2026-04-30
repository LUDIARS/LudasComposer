# ars-game-lexicon

## 概要

ゲーム制作の **用語 (Term)** ・ **機能 (Feature)** ・ **ジャンル (Genre)** ・ **プリセット (Preset)** を **仕様駆動 (spec-driven)** で集約するクレート。

データは `spec/game-lexicon/` 配下の TOML を真とし、 このクレートはロード / 検証 / ID 引きを提供する。

## ドメイン

- **領域**: Ars エディタのウィザード / コード生成 / レベルデザイン支援
- **用語**:
  - `Genre`: ゲームジャンル (action / story-jrpg / open-world / shooter / runner / slg / rhythm / moba / fighting)
  - `Feature`: 1 つのゲーム機能の抽象 (例: `health-system`, `combo-system`)
  - `Preset`: ジャンルごとに既定で有効化する Feature 集合
  - `Term`: ゲーム制作で出てくる用語の集合 (hitbox, hurtbox, iframe, ...)

## 責務

担う:
- TOML のロード + マージ + 検証 (重複 ID / 参照整合性 / 循環依存)
- ID 引きの API (`get_genre`, `get_feature`, `get_preset`, `get_term`)
- Preset → Feature 集合への展開 (依存ソート)

担わない:
- ウィザード UI 自体 (ars-editor)
- Feature の実装 (= ergo / unity / unreal プラグイン)
- 永続化先の選定 (Layer 3 の責務)

## 公開インタフェース

```rust
pub use ars_game_lexicon::{
    Lexicon, Genre, Feature, Preset, Term,
    GenreId, FeatureId, PresetId, TermId, TagId,
    I18nName, FeatureParameter, ParameterType,
    LexiconError, Result,
    load_from_dir, GameLexiconRepository,
};
```

## 依存関係

| 依存 | 理由 |
|------|------|
| `serde` / `serde_json` | シリアライズ |
| `toml` | TOML パース |
| `thiserror` | エラー型 |
| `async-trait` | Repository trait |

ars-core には依存しない (このクレートは小さなドメイン辞書として完結する)。

## 使用例

```toml
[dependencies]
ars-game-lexicon = { path = "../ars-game-lexicon" }
```

```rust
use ars_game_lexicon::{load_from_dir, PresetId};
use std::path::Path;

let lex = load_from_dir(Path::new("spec/game-lexicon"))?;
let action_basic = lex.expand_preset(&PresetId::new("action-basic"))?;
for feat in action_basic {
    println!("{}: {}", feat.id, feat.summary);
}
```

## 関連ドキュメント

- モジュール仕様: [`spec/modules/game-lexicon.md`](../../spec/modules/game-lexicon.md)
- データ形式: [`spec/game-lexicon/README.md`](../../spec/game-lexicon/README.md)

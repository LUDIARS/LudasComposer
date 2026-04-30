# ars-game-lexicon モジュール仕様書

## 1. 目的

ゲーム制作に出てくる**用語 (Term)** ・ **機能 (Feature)** ・ **ジャンル (Genre)** ・ **プリセット (Preset)** を **仕様駆動 (spec-driven)** で集約するモジュール。

このモジュールは Ars エディタの **ウィザード** ・ **コード生成** ・ **レベルデザイン支援** のすべての上位機能の **共通辞書** として働く。たとえば「アクションゲームのプリセット」を選ぶと、 `combo` / `dodge` / `hitbox` 等の Feature が assemble 候補として並ぶ — その「アクションには何が必要か」 という知識自体は本モジュールに寄せる。

## 2. 設計原則

| # | 原則 |
|---|------|
| P1 | データは `spec/game-lexicon/` 配下の **TOML ファイル** に書く。 Rust に埋め込まない |
| P2 | TOML スキーマは [`spec/game-lexicon/README.md`](../game-lexicon/README.md) に明文化する |
| P3 | `Genre` / `Feature` / `Preset` / `Term` は ID で相互参照する (循環は許可、依存は明示) |
| P4 | Feature には **依存** と **競合** を宣言できる (ウィザードはこれを検証する) |
| P5 | プラグイン (ergo / pictor / unity 等) からも Feature を追加できる (将来) |
| P6 | Layer 1 (このモジュール) は I/O を持たない純粋ドメイン。 Repository は trait のみ |
| P7 | 言語は日本語と英語を併記する。 用語の正規化は ID (snake_case ASCII) で行う |

## 3. ドメイン

| 用語 | 定義 |
|------|------|
| **Genre** | ゲームジャンル (`action` / `rpg` / `shooter` / `puzzle` / `strategy` / `sandbox` / ...) |
| **Term** | ゲーム制作上の用語。 ジャンル横断で出てくるもの (例: `hitbox`, `combo`, `xp`, `inventory`) |
| **Feature** | 1 つのゲーム機能の抽象 (例: `health-system`, `combo-system`)。 後段でモジュール / ergo プラグイン / コード生成と紐付く |
| **Preset** | あるジャンル向けに **デフォルトで有効化する Feature の組み合わせ** (例: `action-basic` = combo + dodge + hitbox + health) |
| **Tag** | Feature や Term に付ける自由分類 (例: `combat`, `progression`, `ui`)。 検索 / フィルタ用 |
| **Lexicon** | 上の全部を束ねた集合。 ロード結果の root |

## 4. 責務

### 担う

- `spec/game-lexicon/` 配下の TOML を **ロード** ・ **マージ** ・ **検証** する
- `Lexicon` を ID 引きできる API を提供する (`get_genre`, `get_feature`, `get_preset`, `search_terms`)
- Feature の **依存** ・ **競合** の整合性検証 (循環依存検出を含む)
- Preset を Feature 集合に展開する (`expand_preset`)
- 後述する Repository trait 経由でプロジェクト固有の追加 Feature / 用語上書きを混ぜる (将来)

### 担わない

- ウィザード UI 自体 (ars-editor 側、Layer 3)
- Feature の**実装** (= ergo / unity / unreal プラグイン側)
- レベルデザインのデータ構造 (別モジュール `ars-level-design` を予定)
- 永続化先の選定 (Layer 3 の責務)

## 5. 公開インタフェース

```rust
pub mod domain;       // Genre, Term, Feature, Preset, Tag, Lexicon
pub mod loader;       // load_from_dir(&Path) -> Result<Lexicon>
pub mod repository;   // GameLexiconRepository trait (Layer 2 で使う)
pub mod error;        // LexiconError, Result
```

主要型:

```rust
pub struct Lexicon {
    pub genres: Vec<Genre>,
    pub features: Vec<Feature>,
    pub presets: Vec<Preset>,
    pub terms: Vec<Term>,
}

pub struct Genre   { pub id: GenreId, pub names: I18nName, pub summary: String, pub default_preset: Option<PresetId>, pub tags: Vec<TagId> }
pub struct Feature { pub id: FeatureId, pub names: I18nName, pub summary: String, pub genres: Vec<GenreId>, pub depends_on: Vec<FeatureId>, pub conflicts_with: Vec<FeatureId>, pub tags: Vec<TagId>, pub parameters: Vec<FeatureParameter> }
pub struct Preset  { pub id: PresetId, pub names: I18nName, pub genre: GenreId, pub summary: String, pub features: Vec<FeatureId> }
pub struct Term    { pub id: TermId, pub names: I18nName, pub aliases: Vec<String>, pub definition: String, pub tags: Vec<TagId>, pub related_terms: Vec<TermId> }
```

ID 型はすべて `String` の newtype (`GenreId(String)` 等)。 TS 側にも ts-rs で同期。

`GameLexiconRepository` (Layer 2 が依存):

```rust
#[async_trait]
pub trait GameLexiconRepository: Send + Sync {
    /// 組込みデータ (`spec/game-lexicon/` に同梱) をロード
    async fn load_builtin(&self) -> Result<Lexicon>;

    /// プロジェクト固有のオーバーレイをロード (未指定なら空 Lexicon)
    async fn load_project_overlay(&self, project_id: &str) -> Result<Lexicon>;

    /// プロジェクト固有のオーバーレイを保存
    async fn save_project_overlay(&self, project_id: &str, overlay: &Lexicon) -> Result<()>;
}
```

## 6. 依存関係

| 依存 | 理由 |
|------|------|
| `serde` / `serde_json` | TOML / JSON シリアライズ |
| `toml` | TOML パース |
| `thiserror` | エラー型 |
| `async-trait` | Repository trait |
| (`ars-core`) | エラー型を共通化したくなったら追加。 v0.1 では追加しない |

依存方向は **Layer 1 = 単独**。 ars-core にも依存しない (このモジュールで完結する小さな辞書を提供したい)。

## 7. ライフサイクル

App スコープ (= プロジェクト未 Open でも参照可)。 起動時に `load_builtin()` を 1 回呼んでメモリに保持し、 プロジェクト Open 時に `load_project_overlay()` をマージする。

## 8. v0.1 で出すもの

- TOML ローダ + ドメイン型 + Repository trait
- 組込み seed: `action` / `rpg` / `shooter` の 3 ジャンル × 各 4-5 Feature + 1 Preset
- 共通用語 (combat / progression / ui の 3 タグで 〜10 件)
- ローダ単体テスト (TOML 1 セットを `tests/data/` に置いて読めることを確認)

## 9. ロードマップ

| バージョン | 内容 |
|-----------|------|
| v0.1 | 上記 |
| v0.2 | use case 関数 (`apply_preset` 等)、 ウィザード API |
| v0.3 | プラグイン Feature 拡張点 (ergo / pictor が Feature を提供) |
| v0.4 | レベルデザイン側との連携 (`ars-level-design` で Feature を pacing curve に紐付け) |

## 10. 関連ドキュメント

- データ形式: [`spec/game-lexicon/README.md`](../game-lexicon/README.md)
- モジュール一覧: [`spec/modules/overview.md`](./overview.md)
- ドキュメントルール: [`spec/rule/module-documentation-rules.md`](../rule/module-documentation-rules.md)

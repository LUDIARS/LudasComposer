# テストルール（Scene / UI と同列の「テスト」項目）

Ars エディタの最上位ビュー（`scene` / `actions` / `data` / `ui`）と同列に **`test`** を追加し、
**機能テスト（functional test）** と **統合テスト（integration test）** の2種類を管理する。

> **位置づけ**: Ars の設計アーティファクトの1つ。`codedesign/` / `gamedesign/` / `datadesign/` / `data_asset/` / `uidesign/` / `editor/` と並ぶ
> **`test/`** ディレクトリ、およびエディタ上の **Test ビュー** によって構成される。詳細な保存構造は `project-save-rules.md` を参照。

---

## 1. 背景と目的

従来はコンポーネントの「テストケース（自然言語の期待挙動）」を codedesign に埋め込むのみで、
それらを **実行可能なテストコード** としてどう扱うかが未定義だった。

本ルールでは「テスト」を Scene / UI と同列の設計対象に昇格させ、以下を満たす：

| 観点 | 解決策 |
|------|--------|
| 要件が満たされているかの保証 | コード生成後に **機能テスト** を自動生成・実行 |
| シーン横断の流れの検証 | **統合テスト** をシーン構成ベースで AI が大枠生成、人間が詳細を定義 |
| テストで使う再利用部品 | **テストモジュール（テスト用のパーツ）** を `Ars-TestModule` リポジトリに集約 |
| ドメイン特化の抽象入力 | 例：「キャラクターが自由に移動する」のような **高レベル駆動パターン** を部品化 |

---

## 2. テストの2分類

### 2.1 機能テスト（Functional Test）

**定義**: コンポーネント / アクター単位の要件を、生成されたコードに対して自動検証するテスト。

- **生成契機**: `ars-codegen` でコード生成が完了した直後、各コンポーネント / アクターの
  `requirements.goals` および「コンポーネントのテストケース」欄から自動生成する
- **粒度**: コンポーネントの 1 タスク = 1 機能テストケース を基本単位とする
- **必要ドライバー**: 要件達成に必要な **駆動用コード（Driver）** を機能ごとに自動生成し、
  `test/drivers/` 配下に配置する
- **修正方針**: 失敗時は実装コードの修正を優先する（`code-test-rules.md` T4 と同一方針）
- **自動再生成**: codedesign のテストケース欄 / goals が変更された場合、既存テストを再生成する

### 2.2 統合テスト（Integration Test）

**定義**: シーン単位 / シーン横断のユーザ体験フローを検証するテスト。

- **生成契機**: シーンが確定した段階で、シーン構成 / メッセージフロー / アクション定義を
  入力として AI が **テストフローの骨子** を下書きする
- **詳細記述**: 骨子を起点に人間が具体的な条件・期待値・待機ポイントを書き足す
- **部品化**: 繰り返し現れる操作（自由移動・対話進行・UI 確認 等）は **テストモジュール** を呼ぶ形に収束させる
- **骨子再生成**: シーンが変更されても **人間が書いた詳細は保持** し、骨子部分のみを差分更新する

### 2.3 比較サマリ

| 項目 | 機能テスト | 統合テスト |
|------|-----------|-----------|
| スコープ | コンポーネント / アクター | シーン / シーン横断 |
| 生成元 | codedesign の要件・テストケース | シーン構成・メッセージ・アクション |
| 生成方式 | **自動生成（AI ＋ テンプレート）** | **AI が骨子生成 → 人間が詳細記述** |
| ドライバー | `test/drivers/` に自動生成 | テストモジュールの組合せで記述 |
| 実行頻度 | コード生成のたびに全再実行 | CI / リリース前に実行 |
| 失敗時修正 | 実装コードを修正 | 期待値・待機条件・ドライバーを調整 |

---

## 3. プロジェクト配下の `test/` ディレクトリ構造

`codedesign/` / `gamedesign/` / `datadesign/` / `data_asset/` / `uidesign/` / `editor/` と並ぶ **トップレベルフォルダ** として `test/` を配置する。各フォルダの詳細は `project-save-rules.md` を参照。

```
{project-root}/
├── codedesign/
├── datadesign/
├── data_asset/
├── uidesign/
├── gamedesign/
├── editor/
└── test/
    ├── functional/
    │   └── {scene-name}/
    │       └── {actor-name}/
    │           └── {component-name}.test.{ext}
    ├── integration/
    │   └── {scene-name}/
    │       ├── _flow.md              # AI生成の骨子 + 人間の詳細
    │       └── {flow-name}.test.{ext}
    ├── drivers/
    │   └── {feature-name}/
    │       └── {feature-name}.driver.{ext}
    ├── modules/                      # プロジェクト内で定義するテスト用パーツ
    │   └── {module-name}.module.{ext}
    └── test.config.json              # テスト全体設定
```

### 3.1 命名規則

| 対象 | ファイル名 | 備考 |
|------|-----------|------|
| 機能テスト | `{component-name}.test.{ext}` | 1 コンポーネント = 1 ファイル |
| 機能テスト（アクター） | `_actor.test.{ext}` | 親アクターの機能テストは `_actor.test.{ext}` |
| 統合テスト（骨子） | `_flow.md` | シーンディレクトリ直下 |
| 統合テスト（実装） | `{flow-name}.test.{ext}` | 1 フロー = 1 ファイル |
| ドライバー | `{feature-name}.driver.{ext}` | 要件ごとに 1 ファイル |
| テストモジュール | `{module-name}.module.{ext}` | 再利用部品 |

### 3.2 拡張子（プラットフォーム別）

| プラットフォーム | 拡張子 | フレームワーク |
|---------------|-------|--------------|
| Ergo / ars-native | `.ts` | Vitest + Playwright (E2E) |
| Unity | `.cs` | Unity Test Framework (EditMode / PlayMode) |
| Godot | `.gd` | GdUnit4 |
| Unreal | `.cpp` | Automation Test Framework |

---

## 4. テストモジュール（テスト用のパーツ）

### 4.1 概要

機能テスト / 統合テストの両方が依存する **再利用可能な振る舞い断片** を
「テストモジュール」として定義する。

- **定義場所**:
  - プロジェクト固有: `test/modules/`
  - 再利用可能な共通部品: **別リポジトリ `LUDIARS/Ars-TestModule`**
- **粒度**: ドメインに意味のある 1 操作（例：「自由に移動する」「対話を選択する」「UI 要素が表示されるまで待つ」）
- **依存優先**: **Ergo で表現可能なコンポーネントに対する駆動**を最優先で定義する

### 4.2 例（キャラクター移動）

```markdown
# MoveFreely [テストモジュール]

## 概要
キャラクターアクターをランダムまたは指定パターンで一定時間自由に移動させる。

## 対象コンポーネント
- `Movement` (category: Logic, domain: character)
- Ergo で表現可能な移動コンポーネント全般

## 入力
- actor: 対象キャラクターアクター ID
- duration: 移動継続時間（秒）
- pattern: random | circular | waypoint(ids)

## 出力
- 移動軌跡のログ
- 移動中に発火したメッセージのキャプチャ

## 使い方（Ergo/TypeScript）
```ts
await testModules.character.moveFreely(actor, { duration: 3, pattern: 'random' });
```
```

### 4.3 `Ars-TestModule` リポジトリ

| 項目 | 内容 |
|------|------|
| リポジトリ名 | `LUDIARS/Ars-TestModule` |
| 役割 | ドメイン共通のテスト用パーツを集約・配布するマスターリポジトリ |
| 形式 | Markdown 定義 + プラットフォーム別実装コード |
| 連携方式 | `ars-module-registry` と同じ GitHub ソース同期機構を再利用し、テストモジュールを取り込む |
| キャッシュ先 | `~/.ars/test-module-cache/` |

### 4.4 テストモジュール定義テンプレート（Markdown）

```markdown
# {モジュール名} [テストモジュール]

## カテゴリ
Movement | Input | UI | Dialogue | Battle | Resource | Custom

## 対象コンポーネント
- {category}/{domain}/{component-name}

## Ergo 表現可否
- priority: high | mid | low
- notes: Ergo コンポーネントで直接駆動できるか、補助コードが必要か

## 入力
| 名前 | 型 | 必須 | 説明 |
|------|---|-----|------|
| ... | ... | ... | ... |

## 出力
| 名前 | 型 | 説明 |
|------|---|------|
| ... | ... | ... |

## 既定実装（プラットフォーム別）
- Ergo: `{path-in-module}/ergo.ts`
- Unity: `{path-in-module}/Unity.cs`
- Godot: `{path-in-module}/godot.gd`
- Unreal: `{path-in-module}/Unreal.cpp`
```

### 4.5 選定優先度ルール

1. **Ergo で駆動できるコンポーネント**のモジュールから先に揃える
2. シーンが使うメッセージ / アクションの**共通パターン**を抽出してモジュール化する
3. UI 操作 / 待機条件など、**人間が書くと揺れる部分**を優先的に部品化する

---

## 5. 生成フロー

### 5.1 機能テストの自動生成

```
[codedesign/ 更新 or コード生成完了]
    ↓
[コンポーネント単位でテストケース抽出]
    ↓ 各テストケースごと
[必要ドライバーを決定（既存 drivers/ を探索 → 不足なら新規生成）]
    ↓
[test/functional/{scene}/{actor}/{component}.test.{ext} を生成]
    ↓
[テスト実行（code-test-rules.md の T1–T5 を再利用）]
```

### 5.2 統合テストの AI 骨子生成

```
[scene/_scene.md + メッセージ / アクション / UI 構成]
    ↓
[AI が「初期化→操作→検証→クリーンアップ」の骨子を生成]
    ↓
[test/integration/{scene}/_flow.md に下書き]
    ↓
[人間が詳細を追記（期待値・待機・分岐）]
    ↓
[骨子と詳細から test/integration/{scene}/{flow}.test.{ext} を生成]
```

### 5.3 ドライバー自動生成

各コンポーネントの `requirements` から要件達成に必要なドライバーを逆算する：

| 要件の種別 | 自動生成されるドライバー例 |
|-----------|--------------------------|
| 入力処理 | 仮想入力を発火するドライバー（`{feature}.input.driver.ts`） |
| 時間経過 | 仮想タイマー / シミュレーションループ（`{feature}.tick.driver.ts`） |
| リソース | 差し替え可能なモックリソース（`{feature}.resource.driver.ts`） |
| 通信 | メッセージバススタブ（`{feature}.bus.driver.ts`） |

ドライバーは `test/drivers/{feature-name}/` 配下に配置し、機能テストと統合テスト双方から参照する。

---

## 6. エディタ統合（Test ビュー）

### 6.1 ビュータブ

エディタ上部のタブに `Test` を追加し、`scene` / `actions` / `data` / `ui` と同列に配置する。

```
[Scene] [Actions] [Data] [UI] [Test]
```

### 6.2 画面構成

| ペイン | 内容 |
|--------|------|
| 左: テストツリー | `functional/` / `integration/` / `drivers/` / `modules/` のツリー |
| 中央: テスト詳細 | 選択したテストの Markdown / コードプレビュー |
| 右: 実行結果 | 最後の実行結果・ログ・失敗理由 |
| 上部ツールバー | `Run All` / `Regenerate Functional` / `Sync TestModule Registry` |

### 6.3 アクション

| アクション | 動作 |
|-----------|------|
| Run All | 機能テスト + 統合テストを全実行 |
| Run Selected | 選択テストのみ実行 |
| Regenerate Functional | codedesign から機能テストを再生成 |
| Regenerate Integration Skeleton | シーンから統合テストの骨子を再生成（詳細保持） |
| Sync TestModule Registry | `Ars-TestModule` リポジトリからテストモジュールを同期 |

---

## 7. 運用ルール

1. **テストもプロジェクトの Source of Truth** — `test/` は Git 管理対象とする
2. **機能テストは自動再生成可** — 人間が編集したくなる部分はテストモジュールに切り出す
3. **統合テストの人間記述は保護する** — AI 再生成でも `_flow.md` の「詳細」セクションは失わない
4. **テストモジュールは Ergo を優先言語とする** — 他プラットフォーム実装が無い場合は Ergo のみでも可
5. **失敗したテストのスキップは禁止** — `integration-test.md` と同じ方針を踏襲する

---

## 8. `code-test-rules.md` との関係

`code-test-rules.md` はコード生成フローの第4フェーズ（ビルド＆テスト実行）のルールであり、
本ルールは **その入力となるテスト成果物そのものの構造・生成責務** を定義する。

| フェーズ | ルール |
|---------|-------|
| codedesign 生成 | `codedesign-generation-rules.md` |
| codedesign レビュー | `codedesign-review-rules.md` |
| コード生成 | `code-generation-rules.md` |
| **テスト生成（本ルール）** | `test-rules.md` |
| テスト実行・修正 | `code-test-rules.md` |

---

## 9. 今後の拡張

- **パフォーマンステスト**の取り込み（`test/performance/`）
- **ビジュアルリグレッションテスト**（`Ars-TestModule` に共通 UI パターンを定義）
- **AI 評価ハーネス**との連動（ゲーム AI / NPC 挙動の統計的検証）

codedesignファイルから指定プラットフォーム向けのソースコードを生成する。

## あなたの役割
あなたはコード生成エージェントです。レビュー済みの `codedesign/` 内の設計ファイルを読み込み、
指定されたプラットフォーム向けのソースコードを生成します。

## 事前に必ず読み込むファイル

1. `spec/ars.md` — 実装ルール・設計思想
2. `spec/platforms.md` — 対象プラットフォーム定義
3. `spec/rule/project-save-rules.md` — ファイル構造・命名規則
4. `spec/rule/code-generation-rules.md` — コード生成ルール

## 入力

`$ARGUMENTS` の形式:

```
<codedesign-dir-path> <platform> [output-dir]
```

- `codedesign-dir-path`: codedesign ディレクトリのパス（例: `./codedesign`）
- `platform`: 対象プラットフォーム。以下のいずれか:
  - `unity` — Unity (C#)
  - `godot` — Godot (GDScript)
  - `unreal` — Unreal Engine (C++)
  - `ergo` — Ergo / ars-native (TypeScript)
- `output-dir`（省略可）: 出力先ディレクトリ。省略時は `./generated/{platform}/`

例: `/generate-code ./codedesign unity ./output`

## 実行手順

### 1. ルール読み込み
上記4ファイルを読み込み、生成ルール・プラットフォーム規約を把握する。

### 2. codedesign ファイルの読み込み

指定ディレクトリ内の全MDファイルを読み込む：
- `{scene-name}/_scene.md` — シーン設計ファイル
- `{scene-name}/{actor-name}.md` — アクター設計ファイル
- `interfaces/{name}.md` — インタフェース定義ファイル

### 3. 出力先準備
出力ディレクトリを作成する。既存ファイルがある場合は、変更があったファイルのみ上書きする。

### 4. コード生成

全シーン・全アクターに対して以下を実行する：

#### 4a. インタフェース生成
`interfaces/` 内の定義から、プラットフォーム固有のインタフェースコードを生成する。
他のコードが参照するため、最初に生成する。

#### 4b. コンポーネント生成
各アクターのコンポジットシステムに記載されたコンポーネントごとに：
- 変数 → フィールド / プロパティ
- タスク → メソッド
- 依存コンポーネント → import / 参照

#### 4c. アクター生成
各アクターの設計ファイルから：
- メタ情報 → クラス定義・namespace
- ステート定義 → enum / ステートマシン
- メッセージ → イベント発火・ハンドラ
- 表示物 → レンダリング関連コード
- UI 連携 → UI バインディング

#### 4d. シーン管理コード生成
`_scene.md` から：
- アクター初期化順序に従ったセットアップコード
- メッセージフローの配線
- シーン遷移ロジック

#### 4e. テストコード生成
コンポーネント詳細にテストケースが記載されている場合、
対応するプラットフォームのテストコードを生成する。

### 5. 生成結果の報告

生成が完了したら以下を報告する：
- 生成したファイル数（インタフェース / コンポーネント / アクター / シーン / テスト）
- 出力先ディレクトリ
- TODO マーカーがあるファイル（あれば）
- スキップした項目（あれば）

## プラットフォーム別コード規約

### Unity (C#)
- namespace: `Ars.Ergo.{Domain}`
- クラス: PascalCase
- MonoBehaviour を基底クラスとする
- メッセージ: UnityEvent / C# event
- 依存解決: `[RequireComponent]` 属性

### Godot (GDScript)
- クラス名: `Ergo{ComponentName}`
- ファイル名: snake_case
- Node を基底クラスとする
- メッセージ: signal 定義 + `connect()`
- 変数公開: `@export`

### Unreal Engine (C++)
- モジュール: `ArsErgo{Domain}`
- クラス: PascalCase, `U` / `A` プレフィックス
- UActorComponent を基底クラスとする
- メッセージ: `DECLARE_DYNAMIC_MULTICAST_DELEGATE`
- 変数公開: `UPROPERTY(EditAnywhere)`

### Ergo / ars-native (TypeScript)
- パッケージ: `ars-ergo-{domain}`
- ファイル名: kebab-case
- ES Module (export / import)
- メッセージ: Port-based Message Passing
- 型: TypeScript strict mode

## 制約
- codedesign に記載のない機能を追加しないこと
- 不足がある場合は `// TODO: {内容}` コメントを残すこと
- プラットフォームの命名規則に必ず従うこと
- 生成コードはコンパイル / 型チェックが通ることを目指すこと
- 2回目以降の実行では変更があったファイルのみ再生成すること

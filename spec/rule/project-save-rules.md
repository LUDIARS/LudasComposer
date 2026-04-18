# プロジェクト保存ルール

Ars プロジェクトの保存形式・キャッシュ戦略・各種設計ファイルの管理ルール。

> **前提**: Ars が管理するプロジェクトは **プロジェクトディレクトリ** を1つの単位とし、その直下に用途別のフォルダを配置する。各フォルダに格納するファイルの形式は本ルールで定義する。`test/` の詳細は `test-rules.md` を参照。

## プロジェクトディレクトリ構造

プロジェクトは、以下のトップレベルフォルダで構成する。

```
{project-root}/
├── codedesign/        # シーンエディタの内容（アクター設計）
├── datadesign/        # データスキーマ定義（モデル別）
│   ├── user_data_scheme/
│   └── master_data_scheme/
├── data_asset/        # ユーザーが作成したデータ実体
│   └── master_data/
├── uidesign/          # UI 位置データ
├── gamedesign/        # ゲーム設計データ
│   ├── action/        # アクション定義
│   └── level/         # レベル（シーン）定義
├── editor/            # エディタ設定
│   ├── users/         # ユーザー別エディタ設定
│   └── global/        # グローバルエディタ設定
├── test/              # テスト成果物（test-rules.md 参照）
└── .ars-cache/        # 派生キャッシュ（再生成可能・Git 管理対象外）
```

| フォルダ | 内容 | 形式 |
|---------|------|------|
| `codedesign/` | シーンエディタで作成したシーン／アクター／インタフェース設計 | Markdown または YAML |
| `datadesign/user_data_scheme/` | ユーザーデータのスキーマ（モデルごとに 1 ファイル） | YAML または JSON |
| `datadesign/master_data_scheme/` | マスターデータのスキーマ（モデルごとに 1 ファイル） | YAML または JSON |
| `data_asset/master_data/` | ユーザーが作成したマスターデータの実体 | YAML または JSON |
| `uidesign/` | UI（画面・パネル等）の配置・位置データ | YAML または JSON |
| `gamedesign/action/` | アクションの定義（種別・振る舞い・具体実装） | YAML または JSON |
| `gamedesign/level/` | レベル（シーン構造・メッセージ・ルートアクター等） | YAML または JSON |
| `editor/users/` | ユーザー個別のエディタ設定（ユーザーごとに 1 ファイル） | JSON |
| `editor/global/` | プロジェクト共通のエディタ設定 | JSON |
| `test/` | テスト成果物（`test-rules.md` 参照） | 各種 |
| `.ars-cache/` | 派生キャッシュ（`.gitignore` 対象） | JSON |

## コード設計ファイル（codedesign）

シーン／アクター／インタフェース定義を **コード設計ファイル（Markdown または YAML）** として `codedesign/` に保存する。シーン／アクターの親子関係はディレクトリ階層で表現する。

### 階層構造

```
codedesign/
├── interfaces/                         # インタフェース定義
│   ├── {interface-name}.md
│   └── ...
├── {scene-name}/                       # シーン単位のディレクトリ
│   ├── _scene.md                       # シーン自体の設計定義
│   ├── {actor-name}.md                 # シーン直下のアクター設計定義
│   └── {actor-name}/                   # サブシーンを持つアクター
│       ├── _actor.md                   # 親アクター自体の設計定義
│       ├── {child-actor}.md            # 子アクターの設計定義
│       └── ...
└── ...
```

### 命名規則

| 対象 | ファイル名 | 備考 |
|------|-----------|------|
| シーン | `{scene-name}/_scene.md` | シーンディレクトリ直下に配置 |
| アクター（リーフ） | `{actor-name}.md` | 子を持たないアクター |
| アクター（親） | `{actor-name}/_actor.md` | サブシーンを持つアクター |
| インタフェース | `interfaces/{interface-name}.md` | 全インタフェースを集約 |

拡張子は `.md` または `.yaml` / `.yml` を選択できる。プロジェクト全体で統一することが望ましい。

### コード設計ファイルの内容

各コード設計ファイルには以下を含める。

```markdown
# {アクター名}

## メタ情報
- **ID**: {actor-id}
- **タイプ**: simple | state | flexible
- **ドメインロール**: {role}

## 概要
{requirements.overview}

## 達成目標
{requirements.goals}

## 役割
{requirements.role}

## 挙動
{requirements.behavior}

## ステート定義（State型のみ）
- {state-name}: {processes}

## 表示物（Display）
- {display-name}: {satisfies} → {pipeline_config}

## 依存関係
- 使用コンポーネント: [...]
- メッセージ送信先: [...]
- メッセージ受信元: [...]
```

### コード生成との関係

- **コード設計ファイルをコード生成の入力とする**
- `ars-codegen` は `codedesign/` 内のファイルを読み取り、プラットフォーム別のコードを生成する
- コード設計ファイルの変更はコード再生成のトリガーとなる

### インタフェース定義

アクター間のインタフェース（メッセージ定義）は `codedesign/interfaces/` に別途まとめる。

```markdown
# {インタフェース名}

## メタ情報
- **ID**: {message-id}
- **送信元**: {source-actor-name} ({source-domain-id})
- **送信先**: {target-actor-name} ({target-domain-id})

## 説明
{description}

## データ形式
- 入力: {input-schema}
- 出力: {output-schema}
```

## データスキーマ（datadesign）

データモデルのスキーマ定義を用途別に分けて保存する。

```
datadesign/
├── user_data_scheme/
│   └── {model-name}.yaml       # ユーザーデータスキーマ（モデルごと）
└── master_data_scheme/
    └── {model-name}.yaml       # マスターデータスキーマ（モデルごと）
```

- **ユーザーデータスキーマ** (`user_data_scheme/`): ランタイムで変更可能・セーブ対象のデータ構造を定義する
- **マスターデータスキーマ** (`master_data_scheme/`): 設計時に定義する読み取り専用データの構造を定義する
- 1 モデル 1 ファイル。ファイル名はモデル ID またはモデル名をケバブケース／スネークケースで表記する

## データアセット（data_asset）

ユーザーが作成したデータ実体を保存する。

```
data_asset/
└── master_data/
    └── {model-name}.yaml       # マスターデータの実体（テーブル単位）
```

- `data_asset/master_data/` は `datadesign/master_data_scheme/` のスキーマに準拠する
- 1 テーブル 1 ファイル。ファイル名はスキーマに対応するモデル名と一致させる

## UI 設計（uidesign）

UI（画面・パネル等）の配置・位置データを保存する。

```
uidesign/
└── {ui-name}.yaml              # UI 単位の位置データ
```

- 1 UI 1 ファイル。ファイル形式は YAML または JSON を選択できる
- 位置座標・階層・サイズなどの UI レイアウト情報を含む

## ゲーム設計（gamedesign）

ゲームロジックを構成するデータを種別ごとに保存する。

```
gamedesign/
├── action/
│   └── {action-name}.yaml      # アクション定義（1 アクション 1 ファイル）
└── level/
    └── {level-name}.yaml       # レベル定義（1 レベル 1 ファイル）
```

### アクション（gamedesign/action）

「なにをするか」(振る舞い) と「具体実装」の両面を持つアクション定義を保存する。

```yaml
id: {action-id}
name: {action-name}
actionType: interface | usecase | event
description: ...
behaviors:
  - ...
concretes:
  - id: {concrete-id}
    name: {class-name}
    description: ...
```

### レベル（gamedesign/level）

レベル（シーン構造）の定義を保存する。ルートアクター・メッセージ定義・シーン固有のパラメータを含む。

```yaml
id: {level-id}
name: {level-name}
rootActorId: {actor-id}
messages:
  - id: {message-id}
    sourceDomainId: ...
    targetDomainId: ...
    name: ...
    messageType: simple | interface
    actionIds: [...]
```

## エディタ設定（editor）

エディタの設定ファイルをスコープ別に保存する。

```
editor/
├── users/
│   └── {user-id}.json          # ユーザー個別の設定
└── global/
    └── settings.json           # プロジェクト共通の設定
```

- `editor/users/` にはユーザー固有のエディタ設定（ビュー状態、開いていたファイル、個人設定等）を保存
- `editor/global/` にはプロジェクト全体で共有すべきエディタ設定（テーマ、共通ショートカット等）を保存

## テスト（test）

テスト成果物の詳細は [test-rules.md](./test-rules.md) を参照する。

```
test/
├── functional/                 # コンポーネント/アクター単位の機能テスト
├── integration/                # シーン単位の統合テスト
├── drivers/                    # 機能テスト用の自動生成ドライバー
├── modules/                    # プロジェクト固有のテストパーツ
└── test.config.json            # テスト全体設定
```

## 依存関係グラフ

各コード設計ファイルのつながりを **グラフ** で表現し、可視化可能にする。

### グラフの構成要素

| 要素 | 説明 |
|------|------|
| ノード | 各アクター（コード設計ファイル） |
| エッジ（メッセージ） | アクター間のメッセージ送受信 |
| エッジ（親子） | サブシーンによる階層関係 |
| エッジ（コンポーネント共有） | 同一コンポーネントを使用するアクター間の関係 |

### グラフデータ形式

グラフは `.ars-cache/` 内に JSON 形式で保持する（後述）。

```json
{
  "nodes": [
    {
      "id": "actor-id",
      "name": "ActorName",
      "scene_id": "scene-id",
      "actor_type": "simple",
      "file_path": "codedesign/scene-name/actor-name.md"
    }
  ],
  "edges": [
    {
      "id": "edge-id",
      "source": "actor-id-1",
      "target": "actor-id-2",
      "edge_type": "message",
      "label": "MessageName"
    }
  ]
}
```

## キャッシュファイル

コード設計とグラフ関連図を定期的に更新し、JSON 形式のキャッシュファイルとして保存する。

### キャッシュファイルの配置

```
{project-root}/
└── .ars-cache/
    ├── project-graph.json              # プロジェクト全体の依存関係グラフ
    ├── scenes/
    │   └── {scene-id}.json             # シーン単位のキャッシュ（アクター一覧・関係）
    └── codedesign-index.json           # コード設計ファイルのインデックス
```

### キャッシュファイルの内容

#### `project-graph.json`

プロジェクト全体のアクター依存関係グラフ。

```json
{
  "version": 1,
  "updated_at": "2026-04-09T12:00:00Z",
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

#### `scenes/{scene-id}.json`

シーン単位のアクター情報・レイアウト・メッセージ定義を含むキャッシュ。

```json
{
  "version": 1,
  "updated_at": "2026-04-09T12:00:00Z",
  "scene_id": "scene-id",
  "scene_name": "SceneName",
  "actors": [ ... ],
  "messages": [ ... ],
  "sub_graphs": [ ... ]
}
```

#### `codedesign-index.json`

コード設計ファイルのパス・メタ情報を一覧化したインデックス。

```json
{
  "version": 1,
  "updated_at": "2026-04-09T12:00:00Z",
  "entries": [
    {
      "actor_id": "actor-id",
      "actor_name": "ActorName",
      "scene_id": "scene-id",
      "file_path": "codedesign/scene-name/actor-name.md",
      "last_modified": "2026-04-09T12:00:00Z"
    }
  ]
}
```

### キャッシュの更新タイミング

| タイミング | 処理 |
|-----------|------|
| プロジェクト保存時 | 全キャッシュを再生成 |
| シーン編集完了時 | 該当シーンのキャッシュとグラフを差分更新 |
| アクター追加・削除・変更時 | 該当アクターのコード設計ファイルとインデックスを更新 |
| 定期（バックグラウンド） | コード設計ファイルとキャッシュの整合性チェック・修復 |

### キャッシュの読み込み

| イベント | 処理 |
|---------|------|
| プロジェクトを開いた時 | `project-graph.json` + `codedesign-index.json` を読み込み、プロジェクト全体の構造を復元 |
| シーンを開いた時 | `scenes/{scene-id}.json` を読み込み、ノードエディタの画面を構築 |
| キャッシュが存在しない場合 | 各保存フォルダから再構築 |

## 運用ルール

1. **各保存フォルダを正（Source of Truth）とする** — キャッシュは再生成可能な派生データ
2. **キャッシュファイルは `.gitignore` に含めてよい** — 再生成可能なため
3. **設計ファイルは Git 管理対象とする** — プロジェクトの設計ドキュメントとして履歴を残す
4. **設計ファイルの手動編集を許容する** — エディタ外での修正も有効。次回読み込み時にキャッシュを再構築
5. **スキーマ定義と実データ／使用箇所の整合性を保つ** — スキーマ変更時は依存箇所を更新する

# コード生成ルール

codedesign ファイルを入力として、指定プラットフォーム向けのソースコードを生成するためのルール。

> **位置づけ**: コード生成フローの第3フェーズ。第2フェーズでレビュー済みの codedesign を読み込み、
> 実際のソースコードファイルを出力する。

## 生成フロー

```
[codedesign/ のMDファイル群（レビュー済み）]
    ↓ 読み込み
[プラットフォーム定義（platforms.md）読み込み]
    ↓ 言語・規約の決定
[シーン / アクター / コンポーネント単位でコード生成]
    ↓ 出力
[プラットフォーム別ソースコードファイル]
```

## 入力

| ソース | 内容 |
|--------|------|
| `codedesign/` | レビュー済みのアクター設計・シーン設計・インタフェース定義 |
| `spec/platforms.md` | 対象プラットフォーム定義 |
| `spec/ars.md` | 実装ルール・設計思想 |
| `spec/rule/project-save-rules.md` | ファイル構造・命名規則 |
| 本ルール | コード生成の粒度・方針 |

## 出力先

プラットフォームごとに以下の構造で出力する。

### Unity (C#)

```
{output-dir}/
├── Ars.Ergo.{Domain}/
│   ├── {ActorName}.cs
│   ├── {ComponentName}.cs
│   └── ...
├── Scenes/
│   └── {SceneName}/
│       └── {SceneName}SceneManager.cs
└── Interfaces/
    └── I{InterfaceName}.cs
```

### Godot (GDScript)

```
{output-dir}/
├── ergo_{domain}/
│   ├── {actor_name}.gd
│   ├── {component_name}.gd
│   └── ...
├── scenes/
│   └── {scene_name}/
│       ├── {scene_name}.tscn
│       └── {scene_name}_manager.gd
└── interfaces/
    └── {interface_name}.gd
```

### Unreal Engine (C++)

```
{output-dir}/
├── ArsErgo{Domain}/
│   ├── Public/
│   │   ├── {ActorName}.h
│   │   └── {ComponentName}.h
│   └── Private/
│       ├── {ActorName}.cpp
│       └── {ComponentName}.cpp
├── Scenes/
│   └── {SceneName}/
│       └── {SceneName}GameMode.h/.cpp
└── Interfaces/
    └── I{InterfaceName}.h
```

### Ergo / ars-native (TypeScript)

```
{output-dir}/
├── ars-ergo-{domain}/
│   ├── {actor-name}.ts
│   ├── {component-name}.ts
│   └── index.ts
├── scenes/
│   └── {scene-name}/
│       ├── {scene-name}.scene.ts
│       └── index.ts
└── interfaces/
    └── {interface-name}.ts
```

## 生成単位

**アクター / コンポーネント単位** で1ファイルを生成する。

- 初回: codedesign/ 内の全ファイルから一括生成
- 2回目以降: codedesign/ で変更があったファイルに対応するコードのみ再生成

## コード生成ルール

### G1: codedesign に忠実に生成する

codedesign ファイルに記載された設計を正確にコードに変換する。
設計に記載のない機能を追加しない。不足がある場合は `// TODO: {内容}` コメントを残す。

### G2: プラットフォームの規約に従う

`platforms.md` に定義された各プラットフォームの規約に従う：

| プラットフォーム | モジュール形式 | メッセージ方式 | 命名規則 |
|---------------|-------------|-------------|---------|
| Unity | MonoBehaviour / ScriptableObject | UnityEvent / Delegate | `Ars.Ergo.{Domain}` namespace, PascalCase |
| Godot | Node / Resource | signal / call_group() | `Ergo{Name}` クラス, snake_case |
| Unreal | UActorComponent / UObject | Delegate / Event Dispatcher | `ArsErgo{Domain}` モジュール, PascalCase |
| Ergo | TypeScript Module | Port-based Message | `ars-ergo-{domain}` パッケージ, camelCase |

### G3: アクターの構造をコードに反映する

codedesign の各セクションを以下のようにマッピングする：

| codedesign セクション | コードへの反映 |
|---------------------|-------------|
| メタ情報 | クラス定義・namespace・ファイル配置 |
| ステート定義 | enum / state machine 実装 |
| 表示物（Display） | レンダリング関連コンポーネント |
| コンポジットシステム | コンポーネントクラス群 |
| メッセージ / インタフェース | イベント定義・ハンドラ・インタフェース |
| 接続データ | データアクセス層 |
| UI 連携 | UI バインディング |
| 依存関係 | import / using / require |

### G4: コンポーネントの変数・タスクを実装する

codedesign のコンポーネント詳細を以下のように実装する：

- **変数（ステート）**: フィールド / プロパティとして定義。型・初期値を反映
- **タスク（振る舞い）**: メソッドとして定義。入出力の型を反映
- **依存コンポーネント**: コンストラクタインジェクション or フィールド参照

### G5: メッセージ / インタフェースの双方向を実装する

- 送信メッセージ → イベント発火 / メソッド呼び出しのコード
- 受信メッセージ → イベントハンドラ / コールバック登録のコード
- interface 種別 → インタフェース定義ファイル + 実装クラス

### G6: シーン管理コードを生成する

`_scene.md` に基づき、シーン管理用のコードを生成する：

- アクターの初期化順序に従ったセットアップ
- メッセージフローの配線
- シーン遷移ロジック（サブシーン含む）

### G7: テストケースをテストコードに変換する

codedesign のコンポーネント詳細に `テストケース` が記載されている場合、
対応するテストコードを生成する：

| プラットフォーム | テストフレームワーク |
|---------------|-----------------|
| Unity | Unity Test Framework (NUnit) |
| Godot | GdUnit4 / GUT |
| Unreal | Automation Test Framework |
| Ergo | Vitest |

### G8: 空実装にはマーカーを残す

codedesign で `{TODO: ...}` マーカーがある箇所、または詳細が不足している箇所には、
コード内にもコメントマーカーを残す：

```
// TODO: {codedesign の TODO 内容}
```

## 生成コードの品質基準

1. **コンパイル可能**: 生成されたコードが対象プラットフォームでコンパイル/実行可能であること
2. **型安全**: 型情報が正確に反映されていること
3. **設計準拠**: codedesign の構造がコードに正確にマッピングされていること
4. **命名一貫性**: プラットフォームの命名規則に統一されていること
5. **依存解決**: import / using / require が正しく設定されていること

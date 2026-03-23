# ドメインルール

Ars のモジュール間関係を統制するルール。

## モジュール依存ルール

1. **全モジュールは `ars-core` にのみ共通依存する**
2. コアモジュール間の依存は最小限、**単方向のみ**
3. プラグインは `ars-core` の trait **のみ** 参照。他のコアモジュールへの依存禁止
4. 外部ツール（musa）は Ars のどのモジュールにも依存しない
5. App 層（ars-editor / ars-web-server）が全モジュールを結合する唯一の場所

## リポジトリ分離ルール

| カテゴリ | リポジトリ | 依存先 |
|---------|-----------|--------|
| コア | `Ars` (monorepo) | — |
| プラグイン | 各独立リポジトリ (`ars-plugin-*`) | `ars-core` のみ |
| 外部ツール | 各独立リポジトリ (`ars-musa`) | なし |
| プラットフォームブリッジ | `ars-platform-plugin` | `ars-core` のみ |

## EventBus ルール

| # | ルール |
|---|--------|
| R1 | 発火は `register_event` 済みの型のみ |
| R2 | 他モジュールのイベント購読には `depends_on` に発火元を宣言 |
| R3 | 全ハンドラ登録は `initialize` / `on_project_open` 内で完了 |
| R4 | ハンドラ内で同期的にイベント発火しない（デッドロック防止） |
| R5 | コアイベント（`source_module = "core"`）は依存宣言不要で購読可能 |
| R6 | Optional 依存は `subscribe()` の `None` チェックで対応 |
| R7 | EventBus は **App 版 (Layer 3a) 専用**。Web 版では使用しない |

## Repository パターンルール

- Repository trait は Layer 1 (`ars-core`) で定義
- 実装は Layer 3 で提供（App版: ローカルファイル、Web版: DynamoDB）
- Layer 2 は `&dyn Repository` 経由でのみデータアクセスする
- 具体的な永続化手段（ファイルパス、テーブル名等）を Layer 2 に漏らさない

## モジュールスコープ

| スコープ | 生存期間 | 対象モジュール |
|---------|---------|---------------|
| App | アプリ起動〜終了 | auth, secrets, module-registry, git |
| Project | プロジェクト Open〜Close | assembly, resource-depot, data-organizer, collab, plugins |

- App スコープモジュールは `AppModule` trait を実装
- Project スコープモジュールは `ProjectModule` trait を実装
- 初期化順序は `depends_on` 宣言に従う（シャットダウンは逆順）

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
| 汎用モジュール | `Ars-Module` (ブランチ別管理) | なし or `ars-core` |
| プラグイン | 各独立リポジトリ (`ars-plugin-*`) | `ars-core` のみ |
| 外部ツール | `Ars-Musa` | なし |
| プラットフォームブリッジ | `Ars-PlatformPlugin` | `ars-core` のみ |

## Ars-Module 運用ルール

汎用モジュール（auth, collab, git 等）は `Ars-Module` リポジトリに **ブランチ別** で管理する。

### ブランチ命名

- `module/<name>` 形式（例: `module/auth`, `module/collab`, `module/git`）
- 各ブランチは独立したモジュールを持ち、他ブランチのコードを含まない

### ディレクトリ構成

各ブランチのルートに `<name>/` ディレクトリを配置する:

```
module/auth ブランチ:
  auth/
  ├── Cargo.toml
  └── src/
      └── lib.rs

module/collab ブランチ:
  collab/
  ├── Cargo.toml
  └── src/
      └── lib.rs
```

### 依存解決

使用側の `Cargo.toml` で git 依存 + ブランチ + subdirectory を指定する（Cargo 1.82+ 必須）:

```toml
[dependencies]
ars-collab = { git = "https://github.com/LUDIARS/Ars-Module.git", branch = "module/collab", subdirectory = "collab" }
ars-auth   = { git = "https://github.com/LUDIARS/Ars-Module.git", branch = "module/auth", subdirectory = "auth" }
ars-git    = { git = "https://github.com/LUDIARS/Ars-Module.git", branch = "module/git", subdirectory = "git" }
```

### 設計原則

- モジュールはアプリ固有の型（AppState 等）に依存しない
- 外部依存の注入は trait（例: `AuthStore`）で行う
- App 層（ars-editor / ars-web-server）が具体実装を注入して結合する

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

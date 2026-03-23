# Ars MCP Server

Arsアクターモデルエンジン用のMCP (Model Context Protocol) サーバー。
Claude Codeと連携して、Arsプロジェクトの管理・モジュール定義の操作を行えます。

## セットアップ

```bash
cd mcp-server
npm install
npm run build
```

## Claude Codeでの設定

`.claude/mcp.json` に以下を追加:

```json
{
  "mcpServers": {
    "ars": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "ARS_PROJECT_DIR": "/path/to/your/ars/project"
      }
    }
  }
}
```

## 提供するツール

### プロジェクト管理
| ツール | 説明 |
|--------|------|
| `list_projects` | .ars.jsonファイルを検索して一覧表示 |
| `create_project` | 新しいArsプロジェクトを作成 |
| `load_project` | プロジェクトを読み込んで概要表示 |
| `get_project_json` | プロジェクトの生JSON構造を取得 |

### シーン管理
| ツール | 説明 |
|--------|------|
| `create_scene` | シーンを追加（ルートアクター自動生成） |
| `list_scenes` | 全シーン一覧表示 |

### アクター管理
| ツール | 説明 |
|--------|------|
| `add_actor` | シーンにアクターを追加 |
| `list_actors` | シーン内の全アクター一覧 |

### コンポーネント管理
| ツール | 説明 |
|--------|------|
| `create_component` | コンポーネント定義を作成 |
| `list_components` | コンポーネント一覧（カテゴリフィルタ対応） |
| `attach_component` | アクターにコンポーネントをアタッチ |

### 接続管理
| ツール | 説明 |
|--------|------|
| `add_connection` | アクター間にポート接続を追加 |

### モジュール定義
| ツール | 説明 |
|--------|------|
| `parse_module_markdown` | Ars形式Markdownからモジュール定義をパース |
| `import_module_to_project` | モジュール定義をコンポーネントとしてインポート |
| `generate_module_markdown` | コンポーネント情報からMarkdown定義書を生成 |

## リソース

| リソース | URI | 説明 |
|----------|-----|------|
| 設計書 | `ars://design/plan` | plan.md の内容 |
| 実装ルール | `ars://design/rules` | ars.md の内容 |

## プロンプト

| プロンプト | 説明 |
|-----------|------|
| `new-module-definition` | 新しいモジュール定義書を作成する |
| `design-scene` | シーン設計を支援する |

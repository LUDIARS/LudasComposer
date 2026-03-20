#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectManager } from './project-manager.js';
import { parseModuleMarkdown } from './module-parser.js';
import type { Project } from './types.js';

const server = new McpServer({
  name: 'ars-mcp-server',
  version: '0.1.0',
});

// デフォルトのプロジェクトディレクトリはカレント or 環境変数
const projectDir = process.env.ARS_PROJECT_DIR ?? process.cwd();
const pm = new ProjectManager(projectDir);

// === Resources ===

server.resource(
  'project-design',
  'ars://design/plan',
  async (uri) => {
    const planPath = path.join(projectDir, 'plan.md');
    if (fs.existsSync(planPath)) {
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs.readFileSync(planPath, 'utf-8') }] };
    }
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'plan.md not found' }] };
  },
);

server.resource(
  'implementation-rules',
  'ars://design/rules',
  async (uri) => {
    const arsPath = path.join(projectDir, 'ars.md');
    if (fs.existsSync(arsPath)) {
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs.readFileSync(arsPath, 'utf-8') }] };
    }
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'ars.md not found' }] };
  },
);

// === Tools ===

// --- プロジェクト管理 ---

server.tool(
  'list_projects',
  'プロジェクトディレクトリ内の.ars.jsonファイルを検索して一覧表示する',
  {},
  async () => {
    const files = pm.findProjectFiles();
    if (files.length === 0) {
      return { content: [{ type: 'text', text: 'プロジェクトファイルが見つかりません。create_project で新規作成してください。' }] };
    }
    const list = files.map(f => `- ${path.relative(projectDir, f)}`).join('\n');
    return { content: [{ type: 'text', text: `発見されたプロジェクト:\n${list}` }] };
  },
);

server.tool(
  'create_project',
  '新しいArsプロジェクトを作成する',
  {
    name: z.string().describe('プロジェクト名'),
    file_path: z.string().optional().describe('保存先ファイルパス（デフォルト: <name>.ars.json）'),
  },
  async ({ name, file_path }) => {
    const project = pm.createProject(name);
    const savePath = file_path ?? path.join(projectDir, `${name}.ars.json`);
    pm.saveProject(savePath, project);
    return { content: [{ type: 'text', text: `プロジェクト "${name}" を作成しました: ${savePath}` }] };
  },
);

server.tool(
  'load_project',
  'Arsプロジェクトを読み込んで概要を表示する',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
  },
  async ({ file_path }) => {
    const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
    const project = pm.loadProject(fullPath);
    const summary = pm.summarizeProject(project);
    return { content: [{ type: 'text', text: summary }] };
  },
);

server.tool(
  'get_project_json',
  'Arsプロジェクトの生のJSON構造を取得する',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
  },
  async ({ file_path }) => {
    const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
    const project = pm.loadProject(fullPath);
    return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
  },
);

// --- シーン管理 ---

server.tool(
  'create_scene',
  'プロジェクトに新しいシーンを追加する',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
    name: z.string().describe('シーン名'),
  },
  async ({ file_path, name }) => {
    try {
      const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
      let project = pm.loadProject(fullPath);
      const result = pm.createScene(project, name);
      project = result.project;
      pm.saveProject(fullPath, project);
      return {
        content: [{
          type: 'text',
          text: `シーン "${name}" を作成しました (ID: ${result.scene.id})\nルートアクター: ${result.scene.rootActorId}`,
        }],
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `エラー: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'list_scenes',
  'プロジェクト内の全シーンを一覧表示する',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
  },
  async ({ file_path }) => {
    const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
    const project = pm.loadProject(fullPath);
    const scenes = Object.values(project.scenes);
    if (scenes.length === 0) {
      return { content: [{ type: 'text', text: 'シーンがありません。' }] };
    }
    const list = scenes.map(s => {
      const actorCount = Object.keys(s.actors).length;
      const active = project.activeSceneId === s.id ? ' ★' : '';
      return `- **${s.name}**${active} (ID: ${s.id}) - アクター: ${actorCount}個`;
    }).join('\n');
    return { content: [{ type: 'text', text: `シーン一覧:\n${list}` }] };
  },
);

// --- アクター管理 ---

server.tool(
  'add_actor',
  'シーンにアクターを追加する',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
    scene_id: z.string().describe('シーンID'),
    name: z.string().describe('アクター名'),
    role: z.enum(['actor', 'sequence']).describe('アクターのロール'),
    x: z.number().optional().describe('X座標（デフォルト: 200）'),
    y: z.number().optional().describe('Y座標（デフォルト: 200）'),
  },
  async ({ file_path, scene_id, name, role, x, y }) => {
    try {
      const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
      let project = pm.loadProject(fullPath);
      const result = pm.addActor(project, scene_id, name, role, { x: x ?? 200, y: y ?? 200 });
      project = result.project;
      pm.saveProject(fullPath, project);
      return {
        content: [{
          type: 'text',
          text: `アクター "${name}" [${role}] を追加しました (ID: ${result.actor.id})`,
        }],
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `エラー: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'list_actors',
  'シーン内の全アクターを一覧表示する',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
    scene_id: z.string().describe('シーンID'),
  },
  async ({ file_path, scene_id }) => {
    const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
    const project = pm.loadProject(fullPath);
    const scene = project.scenes[scene_id];
    if (!scene) {
      return { content: [{ type: 'text', text: `シーンが見つかりません: ${scene_id}` }], isError: true };
    }
    const actors = Object.values(scene.actors);
    const list = actors.map(a => {
      const compNames = a.components.map(cid => project.components[cid]?.name ?? cid);
      const comps = compNames.length > 0 ? ` [${compNames.join(', ')}]` : '';
      return `- **${a.name}** [${a.role}] (ID: ${a.id})${comps}`;
    }).join('\n');
    return { content: [{ type: 'text', text: `シーン "${scene.name}" のアクター一覧:\n${list}` }] };
  },
);

// --- コンポーネント管理 ---

server.tool(
  'create_component',
  'プロジェクトに新しいコンポーネントを定義する',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
    name: z.string().describe('コンポーネント名'),
    category: z.enum(['UI', 'Logic', 'System', 'GameObject']).describe('カテゴリ'),
    domain: z.string().describe('所属ドメイン'),
    variables: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })).optional().describe('変数定義の配列'),
    tasks: z.array(z.object({
      name: z.string(),
      description: z.string(),
      inputs: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
      outputs: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
    })).optional().describe('タスク定義の配列'),
    dependencies: z.array(z.string()).optional().describe('依存コンポーネントID'),
  },
  async ({ file_path, name, category, domain, variables, tasks, dependencies }) => {
    try {
      const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
      let project = pm.loadProject(fullPath);
      const result = pm.createComponent(project, {
        name,
        category,
        domain,
        variables: variables?.map(v => ({ ...v, defaultValue: undefined })),
        tasks: tasks?.map(t => ({
          name: t.name,
          description: t.description,
          inputs: t.inputs ?? [],
          outputs: t.outputs ?? [],
        })),
        dependencies,
      });
      project = result.project;
      pm.saveProject(fullPath, project);
      return {
        content: [{
          type: 'text',
          text: `コンポーネント "${name}" [${category}] を作成しました (ID: ${result.component.id})`,
        }],
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `エラー: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'list_components',
  'プロジェクト内の全コンポーネントをカテゴリ別に一覧表示する',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
    category: z.enum(['UI', 'Logic', 'System', 'GameObject']).optional().describe('フィルタするカテゴリ'),
  },
  async ({ file_path, category }) => {
    const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
    const project = pm.loadProject(fullPath);
    let components = Object.values(project.components);
    if (category) {
      components = components.filter(c => c.category === category);
    }
    if (components.length === 0) {
      return { content: [{ type: 'text', text: category ? `${category} カテゴリのコンポーネントはありません。` : 'コンポーネントがありません。' }] };
    }
    const list = components.map(c =>
      `- **${c.name}** [${c.category}] (${c.domain}) ID: ${c.id}\n  タスク: ${c.tasks.map(t => t.name).join(', ') || 'なし'}\n  変数: ${c.variables.map(v => `${v.name}:${v.type}`).join(', ') || 'なし'}`
    ).join('\n');
    return { content: [{ type: 'text', text: `コンポーネント一覧:\n${list}` }] };
  },
);

server.tool(
  'attach_component',
  'アクターにコンポーネントをアタッチする',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
    scene_id: z.string().describe('シーンID'),
    actor_id: z.string().describe('アクターID'),
    component_id: z.string().describe('コンポーネントID'),
  },
  async ({ file_path, scene_id, actor_id, component_id }) => {
    try {
      const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
      let project = pm.loadProject(fullPath);
      project = pm.attachComponent(project, scene_id, actor_id, component_id);
      pm.saveProject(fullPath, project);
      const compName = project.components[component_id]?.name ?? component_id;
      const actorName = project.scenes[scene_id]?.actors[actor_id]?.name ?? actor_id;
      return {
        content: [{
          type: 'text',
          text: `コンポーネント "${compName}" をアクター "${actorName}" にアタッチしました。`,
        }],
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `エラー: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  },
);

// --- 接続管理 ---

server.tool(
  'add_connection',
  'シーン内のアクター間に接続を追加する',
  {
    file_path: z.string().describe('.ars.json ファイルのパス'),
    scene_id: z.string().describe('シーンID'),
    source_actor_id: z.string().describe('接続元アクターID'),
    source_port: z.string().describe('接続元ポート名'),
    target_actor_id: z.string().describe('接続先アクターID'),
    target_port: z.string().describe('接続先ポート名'),
  },
  async ({ file_path, scene_id, source_actor_id, source_port, target_actor_id, target_port }) => {
    try {
      const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
      let project = pm.loadProject(fullPath);
      // Validate that source and target actors exist in the scene
      const scene = project.scenes[scene_id];
      if (!scene) {
        return { content: [{ type: 'text', text: `エラー: シーンが見つかりません: ${scene_id}` }], isError: true };
      }
      if (!scene.actors[source_actor_id]) {
        return { content: [{ type: 'text', text: `エラー: 接続元アクターが見つかりません: ${source_actor_id}` }], isError: true };
      }
      if (!scene.actors[target_actor_id]) {
        return { content: [{ type: 'text', text: `エラー: 接続先アクターが見つかりません: ${target_actor_id}` }], isError: true };
      }
      const result = pm.addConnection(project, scene_id, {
        sourceActorId: source_actor_id,
        sourcePort: source_port,
        targetActorId: target_actor_id,
        targetPort: target_port,
      });
      project = result.project;
      pm.saveProject(fullPath, project);
      return {
        content: [{
          type: 'text',
          text: `接続を追加しました (ID: ${result.connection.id}): ${source_actor_id}:${source_port} → ${target_actor_id}:${target_port}`,
        }],
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `エラー: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  },
);

// --- モジュール定義パーサー ---

server.tool(
  'parse_module_markdown',
  'Ars形式のMarkdownからモジュール定義をパースする',
  {
    file_path: z.string().optional().describe('Markdownファイルのパス（file_path か content のいずれかを指定）'),
    content: z.string().optional().describe('パースするMarkdown文字列（file_path か content のいずれかを指定）'),
  },
  async ({ file_path, content }) => {
    let markdown: string;
    if (content) {
      markdown = content;
    } else if (file_path) {
      const fullPath = path.isAbsolute(file_path) ? file_path : path.join(projectDir, file_path);
      markdown = fs.readFileSync(fullPath, 'utf-8');
    } else {
      return { content: [{ type: 'text', text: 'file_path または content を指定してください。' }], isError: true };
    }

    const modules = parseModuleMarkdown(markdown, file_path);
    if (modules.length === 0) {
      return { content: [{ type: 'text', text: 'モジュール定義が見つかりませんでした。' }] };
    }

    const summary = modules.map(m =>
      `## ${m.name}\n- カテゴリ: ${m.category}\n- ドメイン: ${m.domain}\n- タスク: ${m.tasks.map(t => t.name).join(', ')}\n- テスト: ${m.tests.length}件`
    ).join('\n\n');

    return {
      content: [
        { type: 'text', text: `${modules.length}個のモジュール定義を検出:\n\n${summary}` },
        { type: 'text', text: `\n\n### JSON:\n\`\`\`json\n${JSON.stringify(modules, null, 2)}\n\`\`\`` },
      ],
    };
  },
);

server.tool(
  'import_module_to_project',
  'パース済みモジュール定義をプロジェクトのコンポーネントとしてインポートする',
  {
    project_file: z.string().describe('.ars.json ファイルのパス'),
    module_file: z.string().optional().describe('モジュール定義のMarkdownファイルパス'),
    module_content: z.string().optional().describe('モジュール定義のMarkdown文字列'),
    module_name: z.string().optional().describe('インポートするモジュール名（省略時は全モジュール）'),
  },
  async ({ project_file, module_file, module_content, module_name }) => {
    const projectPath = path.isAbsolute(project_file) ? project_file : path.join(projectDir, project_file);
    let project = pm.loadProject(projectPath);

    let markdown: string;
    if (module_content) {
      markdown = module_content;
    } else if (module_file) {
      const fullPath = path.isAbsolute(module_file) ? module_file : path.join(projectDir, module_file);
      markdown = fs.readFileSync(fullPath, 'utf-8');
    } else {
      return { content: [{ type: 'text', text: 'module_file または module_content を指定してください。' }], isError: true };
    }

    let modules = parseModuleMarkdown(markdown, module_file);
    if (module_name) {
      modules = modules.filter(m => m.name === module_name);
    }

    if (modules.length === 0) {
      return { content: [{ type: 'text', text: 'インポートするモジュールが見つかりませんでした。' }], isError: true };
    }

    const imported: string[] = [];
    for (const mod of modules) {
      const result = pm.createComponent(project, {
        name: mod.name,
        category: mod.category,
        domain: mod.domain,
        variables: mod.variables.map((v: { name: string; type: string }) => ({ name: v.name, type: v.type, defaultValue: undefined })),
        tasks: mod.tasks,
        dependencies: mod.dependencies,
      });
      result.component.sourceModuleId = mod.id;
      project = result.project;
      imported.push(`${mod.name} (ID: ${result.component.id})`);
    }

    pm.saveProject(projectPath, project);
    return {
      content: [{
        type: 'text',
        text: `${imported.length}個のモジュールをコンポーネントとしてインポートしました:\n${imported.map(n => `- ${n}`).join('\n')}`,
      }],
    };
  },
);

// --- ユーティリティ ---

server.tool(
  'generate_module_markdown',
  'コンポーネント定義からArs形式のMarkdownモジュール定義書を生成する',
  {
    name: z.string().describe('モジュール名'),
    summary: z.string().describe('概要'),
    category: z.enum(['UI', 'Logic', 'System', 'GameObject']).describe('カテゴリ'),
    domain: z.string().describe('所属ドメイン'),
    required_data: z.array(z.string()).optional().describe('必要なデータ'),
    variables: z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string().optional(),
    })).optional().describe('変数定義'),
    dependencies: z.array(z.string()).optional().describe('依存先'),
    inputs: z.array(z.string()).optional().describe('入力ポート'),
    outputs: z.array(z.string()).optional().describe('出力ポート'),
    tasks: z.array(z.object({
      name: z.string(),
      description: z.string(),
    })).optional().describe('タスク定義'),
    tests: z.array(z.string()).optional().describe('テストケース'),
  },
  async (params) => {
    const lines: string[] = [
      `### ${params.name} モジュール定義`,
      '',
      '#### 概要',
      params.summary,
      '',
      '#### カテゴリ',
      params.category,
      '',
      '#### 所属ドメイン',
      params.domain,
    ];

    if (params.required_data?.length) {
      lines.push('', '#### 必要なデータ');
      for (const d of params.required_data) lines.push(`- ${d}`);
    }

    if (params.variables?.length) {
      lines.push('', '#### 変数');
      for (const v of params.variables) {
        const desc = v.description ? `: ${v.description}` : '';
        lines.push(`- ${v.name} (${v.type})${desc}`);
      }
    }

    if (params.dependencies?.length) {
      lines.push('', '#### 依存');
      for (const d of params.dependencies) lines.push(`- ${d}`);
    }

    lines.push('', '#### 作業');

    if (params.inputs?.length) {
      lines.push('##### 入力');
      for (const i of params.inputs) lines.push(`- ${i}`);
    }

    if (params.outputs?.length) {
      lines.push('##### 出力');
      for (const o of params.outputs) lines.push(`- ${o}`);
    }

    if (params.tasks?.length) {
      lines.push('##### タスク');
      for (const t of params.tasks) lines.push(`- ${t.name}: ${t.description}`);
    }

    if (params.tests?.length) {
      lines.push('', '#### テスト');
      for (const t of params.tests) lines.push(`- ${t}`);
    }

    const markdown = lines.join('\n');
    return { content: [{ type: 'text', text: markdown }] };
  },
);

// === Prompts ===

server.prompt(
  'new-module-definition',
  'Arsモジュール定義書を新しく作成するためのプロンプト',
  {
    module_name: z.string().describe('モジュール名'),
    purpose: z.string().describe('モジュールの目的'),
  },
  ({ module_name, purpose }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `以下の要件でArsモジュール定義書を作成してください。

モジュール名: ${module_name}
目的: ${purpose}

Arsのモジュール定義書フォーマットに従って、以下のセクションを含めてください:
- 概要
- カテゴリ（UI / Logic / System / GameObject のいずれか）
- 所属ドメイン
- 必要なデータ
- 変数（名前と型を含む）
- 依存先
- 作業（入力、出力、タスク）
- テスト（各タスクのテストケース）

generate_module_markdown ツールを使って定義書を生成してください。`,
      },
    }],
  }),
);

server.prompt(
  'design-scene',
  'Arsシーンの設計を支援するプロンプト',
  {
    scene_name: z.string().describe('シーン名'),
    description: z.string().describe('シーンの説明'),
  },
  ({ scene_name, description }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `以下のシーンを設計してください。

シーン名: ${scene_name}
説明: ${description}

Arsのアクターモデルに基づき、以下を提案してください:
1. 必要なアクター（名前、ロール）
2. 各アクターに必要なコンポーネント（カテゴリ、タスク）
3. アクター間の接続（ポート接続）
4. 子アクターの内包関係

提案後、create_scene, add_actor, create_component, attach_component ツールで実装してください。`,
      },
    }],
  }),
);

// === サーバー起動 ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP server error:', error);
  process.exit(1);
});

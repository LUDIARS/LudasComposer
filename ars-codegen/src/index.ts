#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadProject, findProjectFiles } from './project-loader.js';
import { PromptGenerator } from './prompt-generator.js';
import { SessionRunner } from './session-runner.js';
import type { CodegenConfig, CodegenSession } from './types.js';

// === CLI引数パーサー ===

interface CliArgs {
  command: 'generate' | 'list' | 'preview' | 'help';
  projectFile?: string;
  outputDir?: string;
  sceneIds?: string[];
  componentIds?: string[];
  dryRun?: boolean;
  maxConcurrent?: number;
  claudeModel?: string;
  claudePermissionMode?: 'auto' | 'default' | 'plan';
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    return { command: 'help' };
  }

  const command = args[0] as CliArgs['command'];
  if (!['generate', 'list', 'preview'].includes(command)) {
    console.error(`不明なコマンド: ${command}`);
    return { command: 'help' };
  }

  const result: CliArgs = { command };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--project':
      case '-p':
        result.projectFile = args[++i];
        break;
      case '--output':
      case '-o':
        result.outputDir = args[++i];
        break;
      case '--scene':
      case '-s':
        result.sceneIds = result.sceneIds ?? [];
        result.sceneIds.push(args[++i]);
        break;
      case '--component':
      case '-c':
        result.componentIds = result.componentIds ?? [];
        result.componentIds.push(args[++i]);
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--max-concurrent':
        result.maxConcurrent = parseInt(args[++i], 10);
        break;
      case '--model':
      case '-m':
        result.claudeModel = args[++i];
        break;
      case '--permission-mode':
        result.claudePermissionMode = args[++i] as CliArgs['claudePermissionMode'];
        break;
      default:
        // 位置引数としてプロジェクトファイルを受け付ける
        if (!result.projectFile && arg.endsWith('.ars.json')) {
          result.projectFile = arg;
        }
        break;
    }
  }

  return result;
}

// === コマンド実行 ===

function printHelp(): void {
  console.log(`
ars-codegen - Arsの設計フローからコードを生成するCLIツール

使い方:
  ars-codegen <command> [options]

コマンド:
  generate    Claude Codeセッションを起動してコードを生成
  list        プロジェクト内のシーン・コンポーネントを一覧表示
  preview     生成されるプロンプトをプレビュー（実行しない）
  help        このヘルプを表示

オプション:
  -p, --project <file>       .ars.json プロジェクトファイル
  -o, --output <dir>         出力ディレクトリ (デフォルト: ./generated)
  -s, --scene <id>           対象シーンID (複数指定可)
  -c, --component <id>       対象コンポーネントID (複数指定可)
  --dry-run                  実行せずプロンプトファイルのみ生成
  --max-concurrent <n>       最大同時実行数 (デフォルト: 1)
  -m, --model <model>        Claude Codeのモデル指定
  --permission-mode <mode>   パーミッションモード (auto/default/plan)

例:
  ars-codegen generate -p my-game.ars.json -o ./src/generated
  ars-codegen preview -p my-game.ars.json
  ars-codegen generate -p my-game.ars.json --dry-run
  ars-codegen list -p my-game.ars.json
`);
}

function resolveProjectFile(projectFile?: string): string {
  if (projectFile) {
    const resolved = path.resolve(projectFile);
    if (!fs.existsSync(resolved)) {
      throw new Error(`プロジェクトファイルが見つかりません: ${resolved}`);
    }
    return resolved;
  }

  // カレントディレクトリから自動検索
  const files = findProjectFiles(process.cwd(), 2);
  if (files.length === 0) {
    throw new Error('プロジェクトファイル (.ars.json) が見つかりません。--project で指定してください。');
  }
  if (files.length > 1) {
    console.log('複数のプロジェクトファイルが見つかりました:');
    for (const f of files) {
      console.log(`  - ${path.relative(process.cwd(), f)}`);
    }
    throw new Error('--project でプロジェクトファイルを指定してください。');
  }
  return files[0];
}

async function commandList(args: CliArgs): Promise<void> {
  const projectFile = resolveProjectFile(args.projectFile);
  const project = loadProject(projectFile);

  console.log(`\nプロジェクト: ${project.name}`);
  console.log(`ファイル: ${path.relative(process.cwd(), projectFile)}\n`);

  // シーン一覧
  const scenes = Object.values(project.scenes);
  console.log(`シーン (${scenes.length}個):`);
  for (const scene of scenes) {
    const actorCount = Object.keys(scene.actors).length;
    const active = project.activeSceneId === scene.id ? ' ★' : '';
    console.log(`  [${scene.id}] ${scene.name}${active} - アクター: ${actorCount}個, 接続: ${scene.connections.length}個`);
  }

  // コンポーネント一覧
  const components = Object.values(project.components);
  console.log(`\nコンポーネント (${components.length}個):`);
  const byCategory: Record<string, typeof components> = {};
  for (const comp of components) {
    (byCategory[comp.category] ??= []).push(comp);
  }
  for (const [category, comps] of Object.entries(byCategory)) {
    console.log(`  [${category}]`);
    for (const comp of comps) {
      console.log(`    [${comp.id}] ${comp.name} (${comp.domain}) - タスク: ${comp.tasks.length}個`);
    }
  }
}

async function commandPreview(args: CliArgs): Promise<void> {
  const projectFile = resolveProjectFile(args.projectFile);
  const project = loadProject(projectFile);
  const outputDir = args.outputDir ?? './generated';

  const generator = new PromptGenerator(project);
  const tasks = generator.generateTasks(outputDir, {
    sceneIds: args.sceneIds,
    componentIds: args.componentIds,
  });

  console.log(`\nプロジェクト: ${project.name}`);
  console.log(`生成タスク数: ${tasks.length}\n`);

  for (const task of tasks) {
    console.log(`━━━ ${task.type.toUpperCase()}: ${task.name} ━━━`);
    console.log(`出力先: ${task.outputDir}`);
    if (task.dependencies.length > 0) {
      console.log(`依存: ${task.dependencies.join(', ')}`);
    }
    console.log('');
    console.log(task.prompt);
    console.log('');
  }
}

async function commandGenerate(args: CliArgs): Promise<void> {
  const projectFile = resolveProjectFile(args.projectFile);
  const project = loadProject(projectFile);
  const outputDir = path.resolve(args.outputDir ?? './generated');

  const config: CodegenConfig = {
    projectFile,
    outputDir,
    sceneIds: args.sceneIds,
    componentIds: args.componentIds,
    dryRun: args.dryRun,
    maxConcurrent: args.maxConcurrent,
    claudeModel: args.claudeModel,
    claudePermissionMode: args.claudePermissionMode,
  };

  console.log(`\n=== Ars Code Generator ===`);
  console.log(`プロジェクト: ${project.name}`);
  console.log(`出力先: ${outputDir}`);
  if (config.dryRun) {
    console.log(`モード: ドライラン（プロンプトのみ生成）`);
  }
  console.log('');

  // タスク生成
  const generator = new PromptGenerator(project);
  const tasks = generator.generateTasks(outputDir, {
    sceneIds: config.sceneIds,
    componentIds: config.componentIds,
  });

  console.log(`生成タスク: ${tasks.length}個`);
  for (const task of tasks) {
    console.log(`  - [${task.type}] ${task.name}`);
  }

  // セッション記録を作成
  const session: CodegenSession = {
    id: crypto.randomUUID(),
    projectName: project.name,
    startedAt: new Date().toISOString(),
    tasks,
    results: [],
    config,
  };

  // 実行
  const runner = new SessionRunner(config);
  const results = await runner.runTasks(tasks);
  session.results = results;

  // 結果サマリー
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n=== 結果 ===`);
  console.log(`成功: ${succeeded}/${results.length}`);
  if (failed > 0) {
    console.log(`失敗: ${failed}`);
    for (const r of results.filter(r => !r.success)) {
      const task = tasks.find(t => t.id === r.taskId);
      console.log(`  - ${task?.name}: ${r.error}`);
    }
  }
  console.log(`合計時間: ${(totalDuration / 1000).toFixed(1)}s`);

  // セッションログを保存
  const sessionLogPath = path.join(outputDir, '.codegen-session.json');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(sessionLogPath, JSON.stringify(session, null, 2), 'utf-8');
  console.log(`セッションログ: ${sessionLogPath}`);
}

// === メイン ===

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  try {
    switch (args.command) {
      case 'help':
        printHelp();
        break;
      case 'list':
        await commandList(args);
        break;
      case 'preview':
        await commandPreview(args);
        break;
      case 'generate':
        await commandGenerate(args);
        break;
    }
  } catch (error) {
    console.error(`\nエラー: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();

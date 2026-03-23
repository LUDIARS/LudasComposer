import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CodegenTask, CodegenResult, CodegenConfig } from './types.js';

/**
 * Claude Code CLIをサブプロセスとして起動し、コード生成タスクを実行する。
 * happy-coderと同様に、claude CLIをラップしてプログラム的にセッションを管理する。
 */
export class SessionRunner {
  private config: CodegenConfig;

  constructor(config: CodegenConfig) {
    this.config = config;
  }

  /** 単一タスクを実行 */
  async runTask(task: CodegenTask): Promise<CodegenResult> {
    const startTime = Date.now();

    // 出力ディレクトリを作成
    fs.mkdirSync(task.outputDir, { recursive: true });

    // プロンプトをファイルに保存（Claude Codeに渡す）
    const promptFile = path.join(task.outputDir, '.codegen-prompt.md');
    fs.writeFileSync(promptFile, task.prompt, 'utf-8');

    if (this.config.dryRun) {
      console.log(`[DRY RUN] タスク: ${task.name}`);
      console.log(`  プロンプト保存先: ${promptFile}`);
      console.log(`  出力先: ${task.outputDir}`);
      return {
        taskId: task.id,
        success: true,
        outputFiles: [promptFile],
        duration: Date.now() - startTime,
      };
    }

    try {
      const output = await this.spawnClaudeSession(task, promptFile);
      const generatedFiles = this.findGeneratedFiles(task.outputDir, promptFile);

      return {
        taskId: task.id,
        success: true,
        outputFiles: generatedFiles,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        outputFiles: [],
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /** タスクを依存関係順に実行 */
  async runTasks(tasks: CodegenTask[]): Promise<CodegenResult[]> {
    const results: CodegenResult[] = [];
    const completed = new Set<string>();
    const remaining = [...tasks];

    while (remaining.length > 0) {
      // 依存が全て完了したタスクを抽出
      const ready = remaining.filter(t =>
        t.dependencies.every(dep => completed.has(dep)),
      );

      if (ready.length === 0 && remaining.length > 0) {
        // デッドロック：残りタスクの依存が解決不能
        for (const t of remaining) {
          results.push({
            taskId: t.id,
            success: false,
            outputFiles: [],
            error: `依存関係が解決できません: ${t.dependencies.filter(d => !completed.has(d)).join(', ')}`,
            duration: 0,
          });
        }
        break;
      }

      // 同時実行数を制限して並列実行
      const maxConcurrent = this.config.maxConcurrent ?? 1;
      const batch = ready.slice(0, maxConcurrent);

      console.log(`\n--- バッチ実行: ${batch.map(t => t.name).join(', ')} ---`);

      const batchResults = await Promise.all(
        batch.map(async (task) => {
          task.status = 'running';
          console.log(`[開始] ${task.name} (${task.type})`);
          const result = await this.runTask(task);
          task.status = result.success ? 'completed' : 'failed';
          if (result.success) {
            console.log(`[完了] ${task.name} - ${result.outputFiles.length}ファイル生成 (${(result.duration / 1000).toFixed(1)}s)`);
          } else {
            console.error(`[失敗] ${task.name}: ${result.error}`);
          }
          return result;
        }),
      );

      for (const result of batchResults) {
        results.push(result);
        if (result.success) {
          completed.add(result.taskId);
        }
      }

      // 実行済みタスクをremainingから除去
      for (const task of batch) {
        const idx = remaining.indexOf(task);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    }

    return results;
  }

  /** Claude Code CLIをサブプロセスとして起動 */
  private spawnClaudeSession(task: CodegenTask, promptFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const prompt = fs.readFileSync(promptFile, 'utf-8');

      // Claude Code CLIの引数を構築
      const args: string[] = [
        '--print',                          // 非対話モードで結果を出力
        '--output-format', 'text',          // テキスト出力
        '--max-turns', '50',                // 最大ターン数
      ];

      // モデル指定
      if (this.config.claudeModel) {
        args.push('--model', this.config.claudeModel);
      }

      // パーミッションモード
      if (this.config.claudePermissionMode) {
        args.push('--permission-mode', this.config.claudePermissionMode);
      }

      // プロンプトを直接渡す
      args.push('--prompt', prompt);

      console.log(`  Claude Code 起動: claude ${args.slice(0, 4).join(' ')} ...`);

      // セキュリティ: 必要な環境変数だけをホワイトリストで渡す。
      // process.env 全体を展開すると API キー等の機密値が子プロセスに漏洩する。
      const ALLOWED_ENV_KEYS = [
        'PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE',
        'TERM', 'TMPDIR', 'TMP', 'TEMP',
        'NODE_ENV', 'NODE_PATH',
        'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME',
        // Windows
        'SYSTEMROOT', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
        'PROGRAMFILES', 'PROGRAMFILES(X86)', 'COMSPEC', 'PATHEXT',
      ];
      const safeEnv: Record<string, string> = {};
      for (const key of ALLOWED_ENV_KEYS) {
        if (process.env[key]) {
          safeEnv[key] = process.env[key] as string;
        }
      }
      // CLAUDE_ prefix の設定は渡す（CLIの設定用）
      for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('CLAUDE_') && value) {
          safeEnv[key] = value;
        }
      }
      safeEnv['ARS_PROJECT_DIR'] = path.dirname(this.config.projectFile);

      const child = spawn('claude', args, {
        cwd: task.outputDir,
        env: safeEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          // Claude Codeの出力をログに保存
          const logFile = path.join(task.outputDir, '.codegen-output.log');
          fs.writeFileSync(logFile, stdout, 'utf-8');
          resolve(stdout);
        } else {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Claude Code 起動失敗: ${err.message}\n'claude' コマンドがインストールされているか確認してください。`));
      });
    });
  }

  /** 生成されたファイルを探索 */
  private findGeneratedFiles(dir: string, excludeFile: string): string[] {
    const files: string[] = [];
    this.scanGeneratedFiles(dir, files);
    return files.filter(f => f !== excludeFile && !f.endsWith('.codegen-prompt.md') && !f.endsWith('.codegen-output.log'));
  }

  private scanGeneratedFiles(dir: string, results: string[]): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.scanGeneratedFiles(fullPath, results);
        } else {
          results.push(fullPath);
        }
      }
    } catch {
      // ignore
    }
  }
}

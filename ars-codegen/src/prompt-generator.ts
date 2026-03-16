import type { Project, Scene, Actor, Component, Connection, CodegenTask } from './types.js';

/**
 * Arsプロジェクトのシーン/コンポーネント設計データから
 * Claude Code用のコード生成プロンプトを組み立てる
 */
export class PromptGenerator {
  private project: Project;

  constructor(project: Project) {
    this.project = project;
  }

  /** プロジェクト全体からコード生成タスク一覧を生成 */
  generateTasks(outputDir: string, options?: {
    sceneIds?: string[];
    componentIds?: string[];
  }): CodegenTask[] {
    const tasks: CodegenTask[] = [];

    // 1. コンポーネント単位のコード生成タスク
    const components = this.getTargetComponents(options?.componentIds);
    for (const component of components) {
      tasks.push({
        id: `comp-${component.id}`,
        type: 'component',
        name: component.name,
        prompt: this.buildComponentPrompt(component),
        dependencies: this.resolveComponentDeps(component, components),
        status: 'pending',
        outputDir: `${outputDir}/components/${this.toKebabCase(component.domain)}/${this.toKebabCase(component.name)}`,
      });
    }

    // 2. シーン単位のコード生成タスク（アクター構造 + 接続の配線コード）
    const scenes = this.getTargetScenes(options?.sceneIds);
    for (const scene of scenes) {
      const compDeps = this.getSceneComponentDeps(scene, components);
      tasks.push({
        id: `scene-${scene.id}`,
        type: 'scene',
        name: scene.name,
        prompt: this.buildScenePrompt(scene),
        dependencies: compDeps.map(c => `comp-${c.id}`),
        status: 'pending',
        outputDir: `${outputDir}/scenes/${this.toKebabCase(scene.name)}`,
      });
    }

    return tasks;
  }

  /** コンポーネント用プロンプトを構築 */
  private buildComponentPrompt(component: Component): string {
    const lines: string[] = [
      `# コード生成指示: ${component.name} コンポーネント`,
      '',
      `以下のArsモジュール定義に基づいて、ゲームコンテンツ用の実装コードを生成してください。`,
      '',
      `## モジュール情報`,
      `- 名前: ${component.name}`,
      `- カテゴリ: ${component.category}`,
      `- ドメイン: ${component.domain}`,
    ];

    // 変数
    if (component.variables.length > 0) {
      lines.push('', '## 変数（状態）');
      for (const v of component.variables) {
        const defaultStr = v.defaultValue !== undefined ? ` = ${JSON.stringify(v.defaultValue)}` : '';
        lines.push(`- \`${v.name}\` (${v.type})${defaultStr}`);
      }
    }

    // タスク
    if (component.tasks.length > 0) {
      lines.push('', '## タスク（実装すべき処理）');
      for (const task of component.tasks) {
        lines.push(``, `### ${task.name}`);
        lines.push(`説明: ${task.description}`);
        if (task.inputs.length > 0) {
          lines.push('入力:');
          for (const input of task.inputs) {
            lines.push(`  - \`${input.name}\`: ${input.type}`);
          }
        }
        if (task.outputs.length > 0) {
          lines.push('出力:');
          for (const output of task.outputs) {
            lines.push(`  - \`${output.name}\`: ${output.type}`);
          }
        }
      }
    }

    // 依存
    if (component.dependencies.length > 0) {
      lines.push('', '## 依存コンポーネント');
      for (const depId of component.dependencies) {
        const dep = this.project.components[depId];
        lines.push(`- ${dep ? dep.name : depId}`);
      }
    }

    // 生成指示
    lines.push(
      '',
      '## 生成ルール',
      '1. TypeScript/JavaScriptで実装すること',
      '2. 各タスクを独立した関数またはメソッドとして実装すること',
      '3. 入出力のポート定義に従った型安全なインターフェースを定義すること',
      '4. 変数は状態として管理し、適切なゲッター/セッターを用意すること',
      '5. 依存コンポーネントはimportとして参照すること',
      '6. テスト可能な構造にすること',
      '7. アクターモデルのメッセージパッシングパターンに従うこと',
    );

    return lines.join('\n');
  }

  /** シーン用プロンプトを構築 */
  private buildScenePrompt(scene: Scene): string {
    const actors = Object.values(scene.actors);
    const rootActor = scene.actors[scene.rootActorId];

    const lines: string[] = [
      `# コード生成指示: ${scene.name} シーン`,
      '',
      `以下のArsシーン設計に基づいて、シーンの初期化・アクター構造・接続配線のコードを生成してください。`,
      '',
      `## シーン情報`,
      `- 名前: ${scene.name}`,
      `- ルートアクター: ${rootActor?.name ?? scene.rootActorId}`,
      `- アクター数: ${actors.length}`,
      `- 接続数: ${scene.connections.length}`,
    ];

    // アクター構造
    lines.push('', '## アクター構造');
    const tree = this.buildActorTree(scene);
    lines.push(tree);

    // 各アクターの詳細
    lines.push('', '## アクター詳細');
    for (const actor of actors) {
      lines.push(``, `### ${actor.name} [${actor.role}]`);
      if (actor.components.length > 0) {
        lines.push('コンポーネント:');
        for (const compId of actor.components) {
          const comp = this.project.components[compId];
          if (comp) {
            lines.push(`  - ${comp.name} (${comp.category}/${comp.domain})`);
          }
        }
      }
      if (actor.children.length > 0) {
        lines.push('子アクター:');
        for (const childId of actor.children) {
          const child = scene.actors[childId];
          lines.push(`  - ${child ? child.name : childId}`);
        }
      }
    }

    // 接続
    if (scene.connections.length > 0) {
      lines.push('', '## 接続（メッセージフロー）');
      for (const conn of scene.connections) {
        const source = scene.actors[conn.sourceActorId];
        const target = scene.actors[conn.targetActorId];
        lines.push(
          `- ${source?.name ?? conn.sourceActorId}:${conn.sourcePort} → ${target?.name ?? conn.targetActorId}:${conn.targetPort}`,
        );
      }
    }

    // 生成指示
    lines.push(
      '',
      '## 生成ルール',
      '1. シーン初期化関数を作成すること',
      '2. 各アクターをインスタンス化し、コンポーネントをアタッチするコードを生成すること',
      '3. 接続定義に基づいて、アクター間のメッセージパッシング配線コードを生成すること',
      '4. アクターの親子関係（children）を反映すること',
      '5. sequence ロールのアクターはシーケンシャル実行をサポートすること',
    );

    return lines.join('\n');
  }

  /** アクターツリーをテキスト表現で構築 */
  private buildActorTree(scene: Scene): string {
    const rootActor = scene.actors[scene.rootActorId];
    if (!rootActor) return '(ルートアクターなし)';

    const lines: string[] = [];
    this.renderActorNode(scene, rootActor, lines, 0);
    return lines.join('\n');
  }

  private renderActorNode(scene: Scene, actor: Actor, lines: string[], depth: number): void {
    const indent = '  '.repeat(depth);
    const compCount = actor.components.length;
    lines.push(`${indent}├─ ${actor.name} [${actor.role}] (コンポーネント: ${compCount}個)`);
    for (const childId of actor.children) {
      const child = scene.actors[childId];
      if (child) {
        this.renderActorNode(scene, child, lines, depth + 1);
      }
    }
  }

  /** 対象コンポーネントを取得 */
  private getTargetComponents(componentIds?: string[]): Component[] {
    if (componentIds && componentIds.length > 0) {
      return componentIds
        .map(id => this.project.components[id])
        .filter((c): c is Component => c !== undefined);
    }
    return Object.values(this.project.components);
  }

  /** 対象シーンを取得 */
  private getTargetScenes(sceneIds?: string[]): Scene[] {
    if (sceneIds && sceneIds.length > 0) {
      return sceneIds
        .map(id => this.project.scenes[id])
        .filter((s): s is Scene => s !== undefined);
    }
    return Object.values(this.project.scenes);
  }

  /** コンポーネントの依存タスクIDを解決 */
  private resolveComponentDeps(component: Component, allComponents: Component[]): string[] {
    const depIds: string[] = [];
    for (const depId of component.dependencies) {
      if (allComponents.some(c => c.id === depId)) {
        depIds.push(`comp-${depId}`);
      }
    }
    return depIds;
  }

  /** シーンで使われるコンポーネントの依存を取得 */
  private getSceneComponentDeps(scene: Scene, allComponents: Component[]): Component[] {
    const usedCompIds = new Set<string>();
    for (const actor of Object.values(scene.actors)) {
      for (const compId of actor.components) {
        usedCompIds.add(compId);
      }
    }
    return allComponents.filter(c => usedCompIds.has(c.id));
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}

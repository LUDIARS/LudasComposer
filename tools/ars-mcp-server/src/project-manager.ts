import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Project, Scene, Actor, Component, Connection } from './types.js';

/**
 * Arsプロジェクトファイルの読み書きを管理するクラス
 */
export class ProjectManager {
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  /** プロジェクトディレクトリのパスを取得 */
  getProjectDir(): string {
    return this.projectDir;
  }

  /** プロジェクトファイル(.ars.json)を検索 */
  findProjectFiles(): string[] {
    const files: string[] = [];
    this.scanDir(this.projectDir, files, 3);
    return files;
  }

  private scanDir(dir: string, results: string[], maxDepth: number): void {
    if (maxDepth <= 0) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'target') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.scanDir(fullPath, results, maxDepth - 1);
        } else if (entry.name.endsWith('.ars.json')) {
          results.push(fullPath);
        }
      }
    } catch {
      // ディレクトリ読み取りエラーは無視
    }
  }

  /** プロジェクトを読み込み */
  loadProject(filePath: string): Project {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Project;
  }

  /** プロジェクトを保存 */
  saveProject(filePath: string, project: Project): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
  }

  /** 新規プロジェクトを作成 */
  createProject(name: string): Project {
    return {
      name,
      scenes: {},
      components: {},
      activeSceneId: null,
    };
  }

  /** シーンを作成 */
  createScene(project: Project, name: string): { project: Project; scene: Scene } {
    const sceneId = crypto.randomUUID();
    const rootActorId = crypto.randomUUID();

    const rootActor: Actor = {
      id: rootActorId,
      name,
      role: 'scene',
      components: [],
      children: [],
      position: { x: 0, y: 0 },
    };

    const scene: Scene = {
      id: sceneId,
      name,
      rootActorId,
      actors: { [rootActorId]: rootActor },
      connections: [],
    };

    project.scenes[sceneId] = scene;
    if (!project.activeSceneId) {
      project.activeSceneId = sceneId;
    }

    return { project, scene };
  }

  /** アクターを追加 */
  addActor(
    project: Project,
    sceneId: string,
    name: string,
    role: 'actor' | 'sequence',
    position: { x: number; y: number } = { x: 200, y: 200 },
  ): { project: Project; actor: Actor } {
    const scene = project.scenes[sceneId];
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);

    const actor: Actor = {
      id: crypto.randomUUID(),
      name,
      role,
      components: [],
      children: [],
      position,
    };

    scene.actors[actor.id] = actor;
    return { project, actor };
  }

  /** コンポーネントを作成 */
  createComponent(
    project: Project,
    params: {
      name: string;
      category: Component['category'];
      domain: string;
      variables?: Component['variables'];
      tasks?: Component['tasks'];
      dependencies?: string[];
    },
  ): { project: Project; component: Component } {
    const component: Component = {
      id: crypto.randomUUID(),
      name: params.name,
      category: params.category,
      domain: params.domain,
      variables: params.variables ?? [],
      tasks: params.tasks ?? [],
      dependencies: params.dependencies ?? [],
    };

    project.components[component.id] = component;
    return { project, component };
  }

  /** アクターにコンポーネントをアタッチ */
  attachComponent(
    project: Project,
    sceneId: string,
    actorId: string,
    componentId: string,
  ): Project {
    const scene = project.scenes[sceneId];
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);
    const actor = scene.actors[actorId];
    if (!actor) throw new Error(`Actor not found: ${actorId}`);
    if (!project.components[componentId]) throw new Error(`Component not found: ${componentId}`);

    if (!actor.components.includes(componentId)) {
      actor.components.push(componentId);
    }
    return project;
  }

  /** 接続を追加 */
  addConnection(
    project: Project,
    sceneId: string,
    params: {
      sourceActorId: string;
      sourcePort: string;
      targetActorId: string;
      targetPort: string;
    },
  ): { project: Project; connection: Connection } {
    const scene = project.scenes[sceneId];
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);

    const connection: Connection = {
      id: crypto.randomUUID(),
      ...params,
    };

    scene.connections.push(connection);
    return { project, connection };
  }

  /** プロジェクトの概要を生成 */
  summarizeProject(project: Project): string {
    const sceneCount = Object.keys(project.scenes).length;
    const componentCount = Object.keys(project.components).length;
    let actorCount = 0;
    let connectionCount = 0;

    for (const scene of Object.values(project.scenes)) {
      actorCount += Object.keys(scene.actors).length;
      connectionCount += scene.connections.length;
    }

    const lines: string[] = [
      `# プロジェクト: ${project.name}`,
      ``,
      `## 統計`,
      `- シーン数: ${sceneCount}`,
      `- コンポーネント数: ${componentCount}`,
      `- アクター数（全シーン合計）: ${actorCount}`,
      `- 接続数（全シーン合計）: ${connectionCount}`,
    ];

    if (sceneCount > 0) {
      lines.push('', '## シーン一覧');
      for (const scene of Object.values(project.scenes)) {
        const actors = Object.values(scene.actors);
        const isActive = project.activeSceneId === scene.id ? ' (アクティブ)' : '';
        lines.push(`- **${scene.name}**${isActive}: アクター ${actors.length}個, 接続 ${scene.connections.length}個`);
        for (const actor of actors) {
          lines.push(`  - ${actor.name} [${actor.role}] コンポーネント: ${actor.components.length}個`);
        }
      }
    }

    if (componentCount > 0) {
      lines.push('', '## コンポーネント一覧');
      const byCategory: Record<string, Component[]> = {};
      for (const comp of Object.values(project.components)) {
        (byCategory[comp.category] ??= []).push(comp);
      }
      for (const [category, comps] of Object.entries(byCategory)) {
        lines.push(`### ${category}`);
        for (const comp of comps) {
          lines.push(`- **${comp.name}** (${comp.domain}): タスク ${comp.tasks.length}個, 変数 ${comp.variables.length}個`);
        }
      }
    }

    return lines.join('\n');
  }
}

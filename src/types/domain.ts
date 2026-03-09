// === コアドメインモデル型定義 ===
// plan.md セクション3に準拠

import type { ModuleDefinition } from './module-registry';

/** アクターのロール */
export type ActorRole = 'actor' | 'scene' | 'sequence';

/** コンポーネントカテゴリ */
export type ComponentCategory = 'UI' | 'Logic' | 'System' | 'GameObject';

/** 変数定義 */
export interface Variable {
  name: string;
  type: string;
  defaultValue?: unknown;
}

/** タスク定義 */
export interface Task {
  name: string;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

/** ポート定義 */
export interface PortDefinition {
  name: string;
  type: string;
}

/** コンポーネント定義 */
export interface Component {
  id: string;
  name: string;
  category: ComponentCategory;
  domain: string;
  variables: Variable[];
  tasks: Task[];
  dependencies: string[];
  /** モジュールレジストリから取り込まれた場合の元モジュールID */
  sourceModuleId?: string;
}

/** アクター */
export interface Actor {
  id: string;
  name: string;
  role: ActorRole;
  components: string[];       // Component.id[]
  children: string[];         // 子Actor.id[]
  position: { x: number; y: number };
}

/** 接続 */
export interface Connection {
  id: string;
  sourceActorId: string;
  sourcePort: string;
  targetActorId: string;
  targetPort: string;
}

/** シーン */
export interface Scene {
  id: string;
  name: string;
  rootActorId: string;
  actors: Record<string, Actor>;
  connections: Connection[];
}

/** プロジェクト */
export interface Project {
  name: string;
  scenes: Record<string, Scene>;
  components: Record<string, Component>;
  activeSceneId: string | null;
}

/**
 * ModuleDefinitionからComponentに変換するユーティリティ型
 * レジストリのモジュールをプロジェクトのコンポーネントとしてインポートする際に使用
 */
export function moduleToComponent(module: ModuleDefinition): Component {
  return {
    id: crypto.randomUUID(),
    name: module.name,
    category: module.category,
    domain: module.domain,
    variables: module.variables.map((v) => ({
      name: v.name,
      type: v.type,
      defaultValue: undefined,
    })),
    tasks: module.tasks.map((t) => ({
      name: t.name,
      description: t.description,
      inputs: t.inputs,
      outputs: t.outputs,
    })),
    dependencies: module.dependencies,
    sourceModuleId: module.id,
  };
}

// === Ars ドメインモデル型定義 ===
// src/types/domain.ts & src/types/module-registry.ts と対応

export type ActorRole = 'actor' | 'scene' | 'sequence';
export type ComponentCategory = 'UI' | 'Logic' | 'System' | 'GameObject';

export interface Variable {
  name: string;
  type: string;
  defaultValue?: unknown;
}

export interface PortDefinition {
  name: string;
  type: string;
}

export interface Task {
  name: string;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

export interface Component {
  id: string;
  name: string;
  category: ComponentCategory;
  domain: string;
  variables: Variable[];
  tasks: Task[];
  dependencies: string[];
  sourceModuleId?: string;
}

export interface Actor {
  id: string;
  name: string;
  role: ActorRole;
  components: string[];
  children: string[];
  position: { x: number; y: number };
}

export interface Connection {
  id: string;
  sourceActorId: string;
  sourcePort: string;
  targetActorId: string;
  targetPort: string;
}

export interface Scene {
  id: string;
  name: string;
  rootActorId: string;
  actors: Record<string, Actor>;
  connections: Connection[];
}

export interface Project {
  name: string;
  scenes: Record<string, Scene>;
  components: Record<string, Component>;
  activeSceneId: string | null;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  summary: string;
  category: ComponentCategory;
  domain: string;
  required_data: string[];
  variables: Array<{ name: string; type: string; description?: string }>;
  dependencies: string[];
  tasks: Array<{
    name: string;
    description: string;
    inputs: PortDefinition[];
    outputs: PortDefinition[];
  }>;
  tests: Array<{ description: string }>;
  source_path?: string;
  source_repo?: string;
}

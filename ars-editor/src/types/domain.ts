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
  testCases?: string[];
}

export interface Component {
  id: string;
  name: string;
  category: ComponentCategory;
  domain: string;
  variables: Variable[];
  tasks: Task[];
  dependencies: string[];
}

export interface SequenceStep {
  id: string;
  name: string;
  description: string;
  order: number;
}

export interface Actor {
  id: string;
  name: string;
  role: ActorRole;
  components: string[];
  children: string[];
  position: { x: number; y: number };
  parentId?: string | null;
  sequences: SequenceStep[];
  subSceneId?: string | null;
  prefabId?: string | null;
}

export interface Prefab {
  id: string;
  name: string;
  actor: Omit<Actor, 'id' | 'position' | 'parentId' | 'prefabId'>;
}

export interface KeyBinding {
  id: string;
  key: string;
  description: string;
  targetActorId?: string | null;
}

export interface SceneState {
  id: string;
  name: string;
  keyBindings: KeyBinding[];
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
  states: SceneState[];
  activeStateId: string | null;
}

export interface Project {
  name: string;
  scenes: Record<string, Scene>;
  components: Record<string, Component>;
  prefabs: Record<string, Prefab>;
  activeSceneId: string | null;
}

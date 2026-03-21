// === Ars ドメインモデル型定義 ===
// mcp-server/src/types.ts と同一

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

// === バックエンドプラットフォーム ===

export type BackendPlatform = 'ars-native' | 'unity' | 'unreal' | 'godot';

export interface BackendPlatformConfig {
  platform: BackendPlatform;
  platformOptions?: Record<string, unknown>;
}

// === コード生成固有の型 ===

export interface CodegenConfig {
  projectFile: string;
  outputDir: string;
  targetPlatform?: string;
  /** バックエンドプラットフォーム (デフォルト: ars-native) */
  backendPlatform?: BackendPlatform;
  sceneIds?: string[];
  componentIds?: string[];
  dryRun?: boolean;
  maxConcurrent?: number;
  claudeModel?: string;
  claudePermissionMode?: 'auto' | 'default' | 'plan';
}

export interface CodegenTask {
  id: string;
  type: 'scene' | 'component' | 'connection-wiring';
  name: string;
  prompt: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  outputDir: string;
  error?: string;
}

export interface CodegenResult {
  taskId: string;
  success: boolean;
  outputFiles: string[];
  error?: string;
  duration: number;
}

export interface CodegenSession {
  id: string;
  projectName: string;
  startedAt: string;
  tasks: CodegenTask[];
  results: CodegenResult[];
  config: CodegenConfig;
}

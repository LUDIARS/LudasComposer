import type { Node, Edge } from '@xyflow/react';
import type { ActorType } from '@/types/domain';

/** Diagram layer view modes */
export type DiagramLayer = 'domain' | 'system' | 'ui';

// ---------------------------------------------------------------------------
// Node data types
// ---------------------------------------------------------------------------

/** Domain node — represents an Actor treated as a domain aggregate */
export interface DomainNodeData extends Record<string, unknown> {
  actorId: string;
  name: string;
  actorType: ActorType;
  /** Overview from requirements */
  overview: string;
  /** true when this actor is the scene root */
  isRoot: boolean;
  /** Scene name if this actor links to a sub-scene */
  subSceneName: string | null;
}

/** System (module) node — represents a Component with category System/Logic */
export interface ModuleNodeData extends Record<string, unknown> {
  componentId: string;
  name: string;
  category: string;
  domain: string;
  /** Task names exposed by this component */
  taskNames: string[];
  /** Variable names managed by this component */
  variableNames: string[];
}

/** UI node — represents a Component with category UI */
export interface UINodeData extends Record<string, unknown> {
  componentId: string;
  name: string;
  domain: string;
  /** Variable names this UI component reads/displays */
  variableNames: string[];
  /** Task names this UI component exposes */
  taskNames: string[];
}

/** Scene transition node — shown as a lightweight reference to another scene */
export interface SceneRefNodeData extends Record<string, unknown> {
  sceneId: string;
  sceneName: string;
}

/** Actor detail node — expanded center node in detail view */
export interface ActorDetailNodeData extends Record<string, unknown> {
  actorId: string;
  name: string;
  actorType: ActorType;
  isRoot: boolean;
  subSceneName: string | null;
  /** Requirements overview */
  overview: string;
  goals: string;
  role: string;
  behavior: string;
  /** State names (for state type) */
  stateNames: string[];
  /** Flexible content preview */
  flexibleContentPreview: string;
}

// ---------------------------------------------------------------------------
// Flow node type aliases
// ---------------------------------------------------------------------------

export type DomainFlowNode = Node<DomainNodeData, 'domain'>;
export type ModuleFlowNode = Node<ModuleNodeData, 'module'>;
export type UIFlowNode = Node<UINodeData, 'uiComponent'>;
export type SceneRefFlowNode = Node<SceneRefNodeData, 'sceneRef'>;

export type ActorDetailFlowNode = Node<ActorDetailNodeData, 'actorDetail'>;

export type AnyDiagramNode =
  | DomainFlowNode
  | ModuleFlowNode
  | UIFlowNode
  | SceneRefFlowNode
  | ActorDetailFlowNode;

// ---------------------------------------------------------------------------
// Edge data types
// ---------------------------------------------------------------------------

/** Label info carried by edges */
export interface MessageEdgeData extends Record<string, unknown> {
  /** Source domain name */
  sourceLabel: string;
  /** Target domain name */
  targetLabel: string;
  /** Human-readable description of the message */
  description: string;
}

export type DiagramEdge = Edge<MessageEdgeData>;

// ---------------------------------------------------------------------------
// Color theme per layer
// ---------------------------------------------------------------------------

export const LAYER_COLORS: Record<DiagramLayer, { accent: string; bg: string }> = {
  domain: { accent: '#22c55e', bg: 'bg-green-950' },
  system: { accent: '#8b5cf6', bg: 'bg-violet-950' },
  ui:     { accent: '#f59e0b', bg: 'bg-amber-950' },
};

export const DOMAIN_NODE_COLORS = {
  bg: 'bg-green-950',
  border: 'border-green-500',
  header: 'bg-green-600',
};

export const MODULE_NODE_COLORS = {
  bg: 'bg-violet-950',
  border: 'border-violet-500',
  header: 'bg-violet-600',
};

export const UI_NODE_COLORS = {
  bg: 'bg-amber-950',
  border: 'border-amber-500',
  header: 'bg-amber-600',
};

export const SCENE_REF_NODE_COLORS = {
  bg: 'bg-blue-950',
  border: 'border-blue-400',
  header: 'bg-blue-600',
};

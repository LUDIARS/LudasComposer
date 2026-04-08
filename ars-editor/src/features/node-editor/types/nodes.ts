import type { Node, Edge } from '@xyflow/react';
import type { ActorRole, ActorType } from '@/types/domain';

export interface ActorNodeData extends Record<string, unknown> {
  actorId: string;
  name: string;
  role: ActorRole;
  actorType: ActorType;
  isRoot: boolean;
}

export type ActorFlowNode = Node<ActorNodeData, 'actor'>;
export type AnyFlowNode = ActorFlowNode;
export type FlowEdge = Edge;

export const ROLE_COLORS: Record<ActorRole, { bg: string; border: string; header: string }> = {
  scene: { bg: 'bg-blue-950', border: 'border-blue-500', header: 'bg-blue-600' },
  actor: { bg: 'bg-green-950', border: 'border-green-500', header: 'bg-green-600' },
};

export const ACTOR_TYPE_COLORS: Record<ActorType, { badge: string; text: string }> = {
  simple: { badge: 'bg-zinc-600', text: 'text-zinc-300' },
  state: { badge: 'bg-amber-600', text: 'text-amber-300' },
  flexible: { badge: 'bg-purple-600', text: 'text-purple-300' },
};

export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  simple: 'Simple',
  state: 'State',
  flexible: 'Flexible',
};

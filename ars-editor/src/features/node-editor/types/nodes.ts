import type { Node, Edge } from '@xyflow/react';
import type { ActorRole } from '@/types/domain';

export interface ActorNodeData extends Record<string, unknown> {
  actorId: string;
  name: string;
  role: ActorRole;
  componentIds: string[];
  isRoot: boolean;
}

export type ActorFlowNode = Node<ActorNodeData, 'actor'>;
export type GroupFlowNode = Node<ActorNodeData, 'group'>;
export type AnyFlowNode = ActorFlowNode | GroupFlowNode;
export type FlowEdge = Edge;

export const ROLE_COLORS: Record<ActorRole, { bg: string; border: string; header: string }> = {
  scene: { bg: 'bg-blue-950', border: 'border-blue-500', header: 'bg-blue-600' },
  actor: { bg: 'bg-green-950', border: 'border-green-500', header: 'bg-green-600' },
  sequence: { bg: 'bg-orange-950', border: 'border-orange-500', header: 'bg-orange-600' },
};

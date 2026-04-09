import { useCallback, useMemo } from 'react';
import type { Connection as FlowConnection, NodeChange, EdgeChange } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, MarkerType } from '@xyflow/react';
import { useProjectStore } from '@/stores/projectStore';
import type { AnyFlowNode, FlowEdge, ActorNodeData } from '../types/nodes';
import type { ActorRole, ActorType } from '@/types/domain';

export function useNodeEditor() {
  const project = useProjectStore((s) => s.project);
  const updateActorPosition = useProjectStore((s) => s.updateActorPosition);
  const removeActor = useProjectStore((s) => s.removeActor);
  const addMessage = useProjectStore((s) => s.addMessage);
  const removeMessage = useProjectStore((s) => s.removeMessage);

  const activeScene = project.activeSceneId
    ? project.scenes[project.activeSceneId]
    : null;

  const nodes: AnyFlowNode[] = useMemo(() => {
    if (!activeScene) return [];
    return Object.values(activeScene.actors).map((actor) => ({
      id: actor.id,
      type: 'actor' as const,
      position: actor.position,
      data: {
        actorId: actor.id,
        name: actor.name,
        role: actor.role as ActorRole,
        actorType: (actor.actorType ?? 'simple') as ActorType,
        isRoot: actor.id === activeScene.rootActorId,
      } satisfies ActorNodeData,
    }));
  }, [activeScene]);

  const edges: FlowEdge[] = useMemo(() => {
    if (!activeScene) return [];
    return activeScene.messages.map((msg) => ({
      id: msg.id,
      source: msg.sourceDomainId,
      target: msg.targetDomainId,
      animated: true,
      label: msg.name || undefined,
      style: { stroke: '#6b7280' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280', width: 20, height: 20 },
    }));
  }, [activeScene]);

  const onNodesChange = useCallback(
    (changes: NodeChange<AnyFlowNode>[]) => {
      if (!activeScene) return;

      const updated = applyNodeChanges(changes, nodes);

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updateActorPosition(activeScene.id, change.id, change.position);
        }
        if (change.type === 'remove') {
          const actor = activeScene.actors[change.id];
          if (actor && actor.id !== activeScene.rootActorId) {
            removeActor(activeScene.id, change.id);
          }
        }
      }

      return updated;
    },
    [activeScene, nodes, updateActorPosition, removeActor],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      if (!activeScene) return;
      const updated = applyEdgeChanges(changes, edges);
      for (const change of changes) {
        if (change.type === 'remove') {
          removeMessage(activeScene.id, change.id);
        }
      }
      return updated;
    },
    [activeScene, edges, removeMessage],
  );

  const onConnect = useCallback(
    (connection: FlowConnection) => {
      if (!activeScene) return;
      addMessage(activeScene.id, {
        sourceDomainId: connection.source,
        targetDomainId: connection.target,
        name: '',
        description: '',
      });
    },
    [activeScene, addMessage],
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    activeScene,
  };
}

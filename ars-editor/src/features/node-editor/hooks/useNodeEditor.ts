import { useCallback, useMemo } from 'react';
import type { Connection as FlowConnection, NodeChange, EdgeChange } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { useProjectStore } from '@/stores/projectStore';
import type { AnyFlowNode, FlowEdge, ActorNodeData } from '../types/nodes';

export function useNodeEditor() {
  const project = useProjectStore((s) => s.project);
  const updateActorPosition = useProjectStore((s) => s.updateActorPosition);
  const removeActor = useProjectStore((s) => s.removeActor);
  const addConnection = useProjectStore((s) => s.addConnection);
  const removeConnection = useProjectStore((s) => s.removeConnection);

  const activeScene = project.activeSceneId
    ? project.scenes[project.activeSceneId]
    : null;

  const nodes: AnyFlowNode[] = useMemo(() => {
    if (!activeScene) return [];
    return Object.values(activeScene.actors).map((actor) => ({
      id: actor.id,
      type: actor.children.length > 0 ? 'group' : 'actor',
      position: actor.position,
      data: {
        actorId: actor.id,
        name: actor.name,
        role: actor.role,
        componentIds: actor.components,
        isRoot: actor.id === activeScene.rootActorId,
      } satisfies ActorNodeData,
      ...(actor.parentId ? { parentId: actor.parentId } : {}),
      ...(actor.children.length > 0
        ? { style: { width: 400, height: 300 } }
        : {}),
    }));
  }, [activeScene]);

  const edges: FlowEdge[] = useMemo(() => {
    if (!activeScene) return [];
    return activeScene.connections.map((conn) => ({
      id: conn.id,
      source: conn.sourceActorId,
      target: conn.targetActorId,
      sourceHandle: conn.sourcePort || undefined,
      targetHandle: conn.targetPort || undefined,
      animated: true,
      style: { stroke: '#6b7280' },
    }));
  }, [activeScene]);

  const onNodesChange = useCallback(
    (changes: NodeChange<AnyFlowNode>[]) => {
      if (!activeScene) return;

      // Apply changes to get updated nodes (for position)
      const updated = applyNodeChanges(changes, nodes);

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updateActorPosition(activeScene.id, change.id, change.position);
        }
        if (change.type === 'remove') {
          // Don't remove root actor
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
          removeConnection(activeScene.id, change.id);
        }
      }
      return updated;
    },
    [activeScene, edges, removeConnection],
  );

  const onConnect = useCallback(
    (connection: FlowConnection) => {
      if (!activeScene) return;
      addConnection(activeScene.id, {
        sourceActorId: connection.source,
        sourcePort: connection.sourceHandle ?? '',
        targetActorId: connection.target,
        targetPort: connection.targetHandle ?? '',
      });
    },
    [activeScene, addConnection],
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

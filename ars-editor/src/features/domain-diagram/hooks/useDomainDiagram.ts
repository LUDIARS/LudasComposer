import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type {
  DiagramLayer,
  AnyDiagramNode,
  DiagramEdge,
  DomainNodeData,
  ModuleNodeData,
  UINodeData,
  SceneRefNodeData,
  MessageEdgeData,
} from '../types';

const GRID_X = 320;
const GRID_Y = 220;

/**
 * Transform project data into domain-diagram graph data
 * based on the selected layer view.
 */
export function useDomainDiagram(layer: DiagramLayer) {
  const project = useProjectStore((s) => s.project);

  const activeScene = project.activeSceneId
    ? project.scenes[project.activeSceneId]
    : null;

  const { nodes, edges } = useMemo(() => {
    if (!activeScene) return { nodes: [] as AnyDiagramNode[], edges: [] as DiagramEdge[] };

    switch (layer) {
      case 'domain':
        return buildDomainLayer(project, activeScene);
      case 'system':
        return buildSystemLayer(project, activeScene);
      case 'ui':
        return buildUILayer(project, activeScene);
      default:
        return { nodes: [] as AnyDiagramNode[], edges: [] as DiagramEdge[] };
    }
  }, [layer, project, activeScene]);

  return { nodes, edges, activeScene };
}

// ---------------------------------------------------------------------------
// Domain layer: actors as domains, connections as messages, scene transitions
// ---------------------------------------------------------------------------

function buildDomainLayer(
  project: { scenes: Record<string, Scene>; components: Record<string, Component> },
  activeScene: Scene,
): { nodes: AnyDiagramNode[]; edges: DiagramEdge[] } {
  const actors = Object.values(activeScene.actors);
  const nodes: AnyDiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // Build domain nodes for each actor
  actors.forEach((actor, i) => {
    const componentNames = actor.components
      .map((cid) => project.components[cid]?.name)
      .filter(Boolean);

    const subSceneName = actor.subSceneId
      ? project.scenes[actor.subSceneId]?.name ?? null
      : null;

    nodes.push({
      id: `domain-${actor.id}`,
      type: 'domain' as const,
      position: { x: actor.position.x, y: actor.position.y },
      data: {
        actorId: actor.id,
        name: actor.name,
        componentNames,
        childCount: actor.children.length,
        isRoot: actor.id === activeScene.rootActorId,
        subSceneName,
      } satisfies DomainNodeData,
    });
  });

  // Message edges from connections
  for (const conn of activeScene.connections) {
    edges.push({
      id: `msg-${conn.id}`,
      source: `domain-${conn.sourceActorId}`,
      target: `domain-${conn.targetActorId}`,
      type: 'message',
      animated: true,
      data: {
        sourceLabel: conn.sourcePort || 'out',
        targetLabel: conn.targetPort || 'in',
        description: `${conn.sourcePort || 'output'} -> ${conn.targetPort || 'input'}`,
      } satisfies MessageEdgeData,
    });
  }

  // Scene transition edges (subSceneId references)
  const sceneRefIds = new Set<string>();
  for (const actor of actors) {
    if (actor.subSceneId && project.scenes[actor.subSceneId]) {
      const refScene = project.scenes[actor.subSceneId];
      const refNodeId = `sceneRef-${refScene.id}`;

      if (!sceneRefIds.has(refScene.id)) {
        sceneRefIds.add(refScene.id);
        // Place scene reference nodes to the right of the main cluster
        const maxX = Math.max(...actors.map((a) => a.position.x), 0);
        nodes.push({
          id: refNodeId,
          type: 'sceneRef' as const,
          position: {
            x: maxX + GRID_X + 100,
            y: sceneRefIds.size * GRID_Y,
          },
          data: {
            sceneId: refScene.id,
            sceneName: refScene.name,
          } satisfies SceneRefNodeData,
        });
      }

      edges.push({
        id: `transition-${actor.id}-${refScene.id}`,
        source: `domain-${actor.id}`,
        target: refNodeId,
        type: 'message',
        animated: true,
        style: { stroke: '#3b82f6', strokeDasharray: '6 3' },
        data: {
          sourceLabel: actor.name,
          targetLabel: refScene.name,
          description: 'Scene Transition',
        } satisfies MessageEdgeData,
      });
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// System layer: modules (System/Logic components) and their relation to domains
// ---------------------------------------------------------------------------

function buildSystemLayer(
  project: { scenes: Record<string, Scene>; components: Record<string, Component> },
  activeScene: Scene,
): { nodes: AnyDiagramNode[]; edges: DiagramEdge[] } {
  const actors = Object.values(activeScene.actors);
  const nodes: AnyDiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // Collect system/logic components used in this scene
  const usedComponentIds = new Set<string>();
  for (const actor of actors) {
    for (const cid of actor.components) {
      usedComponentIds.add(cid);
    }
  }

  // Domain nodes (actors) — positioned on the right
  actors.forEach((actor, i) => {
    const componentNames = actor.components
      .map((cid) => project.components[cid]?.name)
      .filter(Boolean);

    nodes.push({
      id: `domain-${actor.id}`,
      type: 'domain' as const,
      position: { x: GRID_X * 2.5, y: i * GRID_Y },
      data: {
        actorId: actor.id,
        name: actor.name,
        componentNames,
        childCount: actor.children.length,
        isRoot: actor.id === activeScene.rootActorId,
        subSceneName: null,
      } satisfies DomainNodeData,
    });
  });

  // Module nodes (System/Logic components) — positioned on the left
  let moduleIdx = 0;
  for (const cid of usedComponentIds) {
    const comp = project.components[cid];
    if (!comp) continue;
    if (comp.category !== 'System' && comp.category !== 'Logic') continue;

    nodes.push({
      id: `module-${comp.id}`,
      type: 'module' as const,
      position: { x: 0, y: moduleIdx * GRID_Y },
      data: {
        componentId: comp.id,
        name: comp.name,
        category: comp.category,
        domain: comp.domain,
        taskNames: comp.tasks.map((t) => t.name),
        variableNames: comp.variables.map((v) => v.name),
      } satisfies ModuleNodeData,
    });
    moduleIdx++;

    // Edges from module to each actor that uses it
    for (const actor of actors) {
      if (actor.components.includes(comp.id)) {
        const taskList = comp.tasks.map((t) => t.name).join(', ') || 'attached';
        edges.push({
          id: `sys-${comp.id}-${actor.id}`,
          source: `module-${comp.id}`,
          target: `domain-${actor.id}`,
          type: 'message',
          animated: true,
          data: {
            sourceLabel: comp.name,
            targetLabel: actor.name,
            description: taskList,
          } satisfies MessageEdgeData,
        });
      }
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// UI layer: UI components and what domain information they display
// ---------------------------------------------------------------------------

function buildUILayer(
  project: { scenes: Record<string, Scene>; components: Record<string, Component> },
  activeScene: Scene,
): { nodes: AnyDiagramNode[]; edges: DiagramEdge[] } {
  const actors = Object.values(activeScene.actors);
  const nodes: AnyDiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // Collect UI components used in this scene
  const usedComponentIds = new Set<string>();
  for (const actor of actors) {
    for (const cid of actor.components) {
      usedComponentIds.add(cid);
    }
  }

  // Domain nodes (actors) — positioned on the right
  actors.forEach((actor, i) => {
    const componentNames = actor.components
      .map((cid) => project.components[cid]?.name)
      .filter(Boolean);

    nodes.push({
      id: `domain-${actor.id}`,
      type: 'domain' as const,
      position: { x: GRID_X * 2.5, y: i * GRID_Y },
      data: {
        actorId: actor.id,
        name: actor.name,
        componentNames,
        childCount: actor.children.length,
        isRoot: actor.id === activeScene.rootActorId,
        subSceneName: null,
      } satisfies DomainNodeData,
    });
  });

  // UI nodes — positioned on the left
  let uiIdx = 0;
  for (const cid of usedComponentIds) {
    const comp = project.components[cid];
    if (!comp) continue;
    if (comp.category !== 'UI') continue;

    nodes.push({
      id: `ui-${comp.id}`,
      type: 'uiComponent' as const,
      position: { x: 0, y: uiIdx * GRID_Y },
      data: {
        componentId: comp.id,
        name: comp.name,
        domain: comp.domain,
        variableNames: comp.variables.map((v) => v.name),
        taskNames: comp.tasks.map((t) => t.name),
      } satisfies UINodeData,
    });
    uiIdx++;

    // Edges from UI to each actor that uses it
    for (const actor of actors) {
      if (actor.components.includes(comp.id)) {
        const varList = comp.variables.map((v) => v.name).join(', ') || 'display';
        edges.push({
          id: `ui-${comp.id}-${actor.id}`,
          source: `ui-${comp.id}`,
          target: `domain-${actor.id}`,
          type: 'message',
          animated: true,
          data: {
            sourceLabel: comp.name,
            targetLabel: actor.name,
            description: varList,
          } satisfies MessageEdgeData,
        });
      }
    }
  }

  return { nodes, edges };
}

// Import types locally to keep the hook self-contained
import type { Scene, Component } from '@/types/domain';

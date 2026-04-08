import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type {
  DiagramLayer,
  AnyDiagramNode,
  DiagramEdge,
  DomainNodeData,
  ActorDetailNodeData,
  ModuleNodeData,
  UINodeData,
  SceneRefNodeData,
  MessageEdgeData,
} from '../types';

const GRID_X = 320;
const GRID_Y = 220;

/**
 * Transform project data into domain-diagram graph data
 * based on the selected layer view and optional focus actor.
 */
export function useDomainDiagram(layer: DiagramLayer, focusActorId?: string | null) {
  const project = useProjectStore((s) => s.project);

  const activeScene = project.activeSceneId
    ? project.scenes[project.activeSceneId]
    : null;

  const { nodes, edges } = useMemo(() => {
    if (!activeScene) return { nodes: [] as AnyDiagramNode[], edges: [] as DiagramEdge[] };

    // Detail view when an actor is focused
    if (focusActorId) {
      return buildDetailView(project, activeScene, focusActorId);
    }

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
  }, [layer, focusActorId, project, activeScene]);

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
  actors.forEach((actor) => {
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
  actors.forEach((actor, idx) => {
    const componentNames = actor.components
      .map((cid) => project.components[cid]?.name)
      .filter(Boolean);

    nodes.push({
      id: `domain-${actor.id}`,
      type: 'domain' as const,
      position: { x: GRID_X * 2.5, y: idx * GRID_Y },
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
  actors.forEach((actor, idx) => {
    const componentNames = actor.components
      .map((cid) => project.components[cid]?.name)
      .filter(Boolean);

    nodes.push({
      id: `domain-${actor.id}`,
      type: 'domain' as const,
      position: { x: GRID_X * 2.5, y: idx * GRID_Y },
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

// ---------------------------------------------------------------------------
// Detail view: focused actor with all related objects
// ---------------------------------------------------------------------------

function buildDetailView(
  project: { scenes: Record<string, Scene>; components: Record<string, Component> },
  activeScene: Scene,
  focusActorId: string,
): { nodes: AnyDiagramNode[]; edges: DiagramEdge[] } {
  const actor = activeScene.actors[focusActorId];
  if (!actor) return { nodes: [], edges: [] };

  const nodes: AnyDiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // --- Center: focused actor detail node ---
  const componentsByCategory = new Map<string, { name: string; taskNames: string[]; variableNames: string[] }[]>();
  for (const cid of actor.components) {
    const comp = project.components[cid];
    if (!comp) continue;
    const cat = comp.category || 'Other';
    if (!componentsByCategory.has(cat)) componentsByCategory.set(cat, []);
    componentsByCategory.get(cat)!.push({
      name: comp.name,
      taskNames: comp.tasks.map((t) => t.name),
      variableNames: comp.variables.map((v) => v.name),
    });
  }

  const subSceneName = actor.subSceneId
    ? project.scenes[actor.subSceneId]?.name ?? null
    : null;

  nodes.push({
    id: `detail-${actor.id}`,
    type: 'actorDetail' as const,
    position: { x: 0, y: 0 },
    data: {
      actorId: actor.id,
      name: actor.name,
      isRoot: actor.id === activeScene.rootActorId,
      childCount: actor.children.length,
      subSceneName,
      componentsByCategory: Array.from(componentsByCategory.entries()).map(
        ([category, components]) => ({ category, components }),
      ),
      sequenceStepNames: actor.sequences.map((s) => s.name),
    } satisfies ActorDetailNodeData,
  });

  // --- Connected actors (from connections) ---
  const connectedActorIds = new Set<string>();

  // Outgoing connections: this actor -> other actors
  const outgoing = activeScene.connections.filter(
    (c) => c.sourceActorId === focusActorId,
  );
  // Incoming connections: other actors -> this actor
  const incoming = activeScene.connections.filter(
    (c) => c.targetActorId === focusActorId,
  );

  let rightIdx = 0;
  for (const conn of outgoing) {
    const target = activeScene.actors[conn.targetActorId];
    if (!target) continue;
    const targetNodeId = `domain-${target.id}`;

    if (!connectedActorIds.has(target.id)) {
      connectedActorIds.add(target.id);
      const targetCompNames = target.components
        .map((cid) => project.components[cid]?.name)
        .filter(Boolean);
      nodes.push({
        id: targetNodeId,
        type: 'domain' as const,
        position: { x: GRID_X * 2, y: rightIdx * GRID_Y - GRID_Y },
        data: {
          actorId: target.id,
          name: target.name,
          componentNames: targetCompNames,
          childCount: target.children.length,
          isRoot: target.id === activeScene.rootActorId,
          subSceneName: target.subSceneId
            ? project.scenes[target.subSceneId]?.name ?? null
            : null,
        } satisfies DomainNodeData,
      });
      rightIdx++;
    }

    edges.push({
      id: `out-${conn.id}`,
      source: `detail-${actor.id}`,
      target: targetNodeId,
      type: 'message',
      animated: true,
      data: {
        sourceLabel: conn.sourcePort || 'out',
        targetLabel: conn.targetPort || 'in',
        description: `${conn.sourcePort || 'output'} -> ${conn.targetPort || 'input'}`,
      } satisfies MessageEdgeData,
    });
  }

  let leftIdx = 0;
  for (const conn of incoming) {
    const source = activeScene.actors[conn.sourceActorId];
    if (!source) continue;
    const sourceNodeId = `domain-${source.id}`;

    if (!connectedActorIds.has(source.id)) {
      connectedActorIds.add(source.id);
      const sourceCompNames = source.components
        .map((cid) => project.components[cid]?.name)
        .filter(Boolean);
      nodes.push({
        id: sourceNodeId,
        type: 'domain' as const,
        position: { x: -GRID_X * 2, y: leftIdx * GRID_Y - GRID_Y },
        data: {
          actorId: source.id,
          name: source.name,
          componentNames: sourceCompNames,
          childCount: source.children.length,
          isRoot: source.id === activeScene.rootActorId,
          subSceneName: source.subSceneId
            ? project.scenes[source.subSceneId]?.name ?? null
            : null,
        } satisfies DomainNodeData,
      });
      leftIdx++;
    }

    edges.push({
      id: `in-${conn.id}`,
      source: sourceNodeId,
      target: `detail-${actor.id}`,
      type: 'message',
      animated: true,
      data: {
        sourceLabel: conn.sourcePort || 'out',
        targetLabel: conn.targetPort || 'in',
        description: `${conn.sourcePort || 'output'} -> ${conn.targetPort || 'input'}`,
      } satisfies MessageEdgeData,
    });
  }

  // --- Components as separate nodes (bottom area) ---
  let compIdx = 0;
  for (const cid of actor.components) {
    const comp = project.components[cid];
    if (!comp) continue;

    if (comp.category === 'System' || comp.category === 'Logic') {
      nodes.push({
        id: `module-${comp.id}`,
        type: 'module' as const,
        position: { x: -GRID_X + compIdx * GRID_X, y: GRID_Y * 2 },
        data: {
          componentId: comp.id,
          name: comp.name,
          category: comp.category,
          domain: comp.domain,
          taskNames: comp.tasks.map((t) => t.name),
          variableNames: comp.variables.map((v) => v.name),
        } satisfies ModuleNodeData,
      });
      edges.push({
        id: `comp-${comp.id}-${actor.id}`,
        source: `module-${comp.id}`,
        target: `detail-${actor.id}`,
        type: 'message',
        animated: true,
        style: { stroke: '#8b5cf6' },
        data: {
          sourceLabel: comp.name,
          targetLabel: actor.name,
          description: comp.tasks.map((t) => t.name).join(', ') || 'attached',
        } satisfies MessageEdgeData,
      });
      compIdx++;
    } else if (comp.category === 'UI') {
      nodes.push({
        id: `ui-${comp.id}`,
        type: 'uiComponent' as const,
        position: { x: -GRID_X + compIdx * GRID_X, y: -GRID_Y * 2 },
        data: {
          componentId: comp.id,
          name: comp.name,
          domain: comp.domain,
          variableNames: comp.variables.map((v) => v.name),
          taskNames: comp.tasks.map((t) => t.name),
        } satisfies UINodeData,
      });
      edges.push({
        id: `ui-${comp.id}-${actor.id}`,
        source: `ui-${comp.id}`,
        target: `detail-${actor.id}`,
        type: 'message',
        animated: true,
        style: { stroke: '#f59e0b' },
        data: {
          sourceLabel: comp.name,
          targetLabel: actor.name,
          description: comp.variables.map((v) => v.name).join(', ') || 'displays',
        } satisfies MessageEdgeData,
      });
      compIdx++;
    }
  }

  // --- Scene reference ---
  if (actor.subSceneId && project.scenes[actor.subSceneId]) {
    const refScene = project.scenes[actor.subSceneId];
    const refNodeId = `sceneRef-${refScene.id}`;
    nodes.push({
      id: refNodeId,
      type: 'sceneRef' as const,
      position: { x: GRID_X * 2, y: GRID_Y * 2 },
      data: {
        sceneId: refScene.id,
        sceneName: refScene.name,
      } satisfies SceneRefNodeData,
    });
    edges.push({
      id: `transition-${actor.id}-${refScene.id}`,
      source: `detail-${actor.id}`,
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

  return { nodes, edges };
}

// Import types locally to keep the hook self-contained
import type { Scene, Component } from '@/types/domain';

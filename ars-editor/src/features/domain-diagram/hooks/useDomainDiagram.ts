import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { Scene, Component, ActorType } from '@/types/domain';
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
// Domain layer: actors as domains, messages between them
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
        actorType: (actor.actorType ?? 'simple') as ActorType,
        overview: actor.requirements?.overview?.join(' / ') ?? '',
        isRoot: actor.id === activeScene.rootActorId,
        subSceneName,
      } satisfies DomainNodeData,
    });
  });

  // Message edges
  for (const msg of activeScene.messages) {
    const srcName = activeScene.actors[msg.sourceDomainId]?.name ?? '?';
    const tgtName = activeScene.actors[msg.targetDomainId]?.name ?? '?';
    edges.push({
      id: `msg-${msg.id}`,
      source: `domain-${msg.sourceDomainId}`,
      target: `domain-${msg.targetDomainId}`,
      type: 'message',
      animated: true,
      data: {
        sourceLabel: srcName,
        targetLabel: tgtName,
        description: msg.name || msg.description || '',
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

  // Domain nodes (actors) — positioned on the right
  actors.forEach((actor, idx) => {
    nodes.push({
      id: `domain-${actor.id}`,
      type: 'domain' as const,
      position: { x: GRID_X * 2.5, y: idx * GRID_Y },
      data: {
        actorId: actor.id,
        name: actor.name,
        actorType: (actor.actorType ?? 'simple') as ActorType,
        overview: actor.requirements?.overview?.join(' / ') ?? '',
        isRoot: actor.id === activeScene.rootActorId,
        subSceneName: null,
      } satisfies DomainNodeData,
    });
  });

  // Module nodes (System/Logic components) — positioned on the left
  let moduleIdx = 0;
  for (const comp of Object.values(project.components)) {
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
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// UI layer: UI components and domains
// ---------------------------------------------------------------------------

function buildUILayer(
  project: { scenes: Record<string, Scene>; components: Record<string, Component> },
  activeScene: Scene,
): { nodes: AnyDiagramNode[]; edges: DiagramEdge[] } {
  const actors = Object.values(activeScene.actors);
  const nodes: AnyDiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // Domain nodes (actors) — positioned on the right
  actors.forEach((actor, idx) => {
    nodes.push({
      id: `domain-${actor.id}`,
      type: 'domain' as const,
      position: { x: GRID_X * 2.5, y: idx * GRID_Y },
      data: {
        actorId: actor.id,
        name: actor.name,
        actorType: (actor.actorType ?? 'simple') as ActorType,
        overview: actor.requirements?.overview?.join(' / ') ?? '',
        isRoot: actor.id === activeScene.rootActorId,
        subSceneName: null,
      } satisfies DomainNodeData,
    });
  });

  // UI nodes — positioned on the left
  let uiIdx = 0;
  for (const comp of Object.values(project.components)) {
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

  const subSceneName = actor.subSceneId
    ? project.scenes[actor.subSceneId]?.name ?? null
    : null;

  const actorType = (actor.actorType ?? 'simple') as ActorType;

  // --- Center: focused actor detail node ---
  nodes.push({
    id: `detail-${actor.id}`,
    type: 'actorDetail' as const,
    position: { x: 0, y: 0 },
    data: {
      actorId: actor.id,
      name: actor.name,
      actorType,
      isRoot: actor.id === activeScene.rootActorId,
      subSceneName,
      overview: actor.requirements?.overview?.join(' / ') ?? '',
      goals: actor.requirements?.goals?.join(' / ') ?? '',
      role: actor.requirements?.role?.join(' / ') ?? '',
      behavior: actor.requirements?.behavior?.join(' / ') ?? '',
      stateNames: actor.actorStates?.map((s) => s.name) ?? [],
      flexibleContentPreview: actor.flexibleContent?.slice(0, 100) ?? '',
    } satisfies ActorDetailNodeData,
  });

  // --- Connected actors (from messages) ---
  const connectedActorIds = new Set<string>();

  // Outgoing messages
  const outgoing = activeScene.messages.filter(
    (m) => m.sourceDomainId === focusActorId,
  );
  // Incoming messages
  const incoming = activeScene.messages.filter(
    (m) => m.targetDomainId === focusActorId,
  );

  let rightIdx = 0;
  for (const msg of outgoing) {
    const target = activeScene.actors[msg.targetDomainId];
    if (!target) continue;
    const targetNodeId = `domain-${target.id}`;

    if (!connectedActorIds.has(target.id)) {
      connectedActorIds.add(target.id);
      nodes.push({
        id: targetNodeId,
        type: 'domain' as const,
        position: { x: GRID_X * 2, y: rightIdx * GRID_Y - GRID_Y },
        data: {
          actorId: target.id,
          name: target.name,
          actorType: (target.actorType ?? 'simple') as ActorType,
          overview: target.requirements?.overview ?? '',
          isRoot: target.id === activeScene.rootActorId,
          subSceneName: target.subSceneId
            ? project.scenes[target.subSceneId]?.name ?? null
            : null,
        } satisfies DomainNodeData,
      });
      rightIdx++;
    }

    edges.push({
      id: `out-${msg.id}`,
      source: `detail-${actor.id}`,
      target: targetNodeId,
      type: 'message',
      animated: true,
      data: {
        sourceLabel: actor.name,
        targetLabel: target.name,
        description: msg.name || msg.description || '',
      } satisfies MessageEdgeData,
    });
  }

  let leftIdx = 0;
  for (const msg of incoming) {
    const source = activeScene.actors[msg.sourceDomainId];
    if (!source) continue;
    const sourceNodeId = `domain-${source.id}`;

    if (!connectedActorIds.has(source.id)) {
      connectedActorIds.add(source.id);
      nodes.push({
        id: sourceNodeId,
        type: 'domain' as const,
        position: { x: -GRID_X * 2, y: leftIdx * GRID_Y - GRID_Y },
        data: {
          actorId: source.id,
          name: source.name,
          actorType: (source.actorType ?? 'simple') as ActorType,
          overview: source.requirements?.overview ?? '',
          isRoot: source.id === activeScene.rootActorId,
          subSceneName: source.subSceneId
            ? project.scenes[source.subSceneId]?.name ?? null
            : null,
        } satisfies DomainNodeData,
      });
      leftIdx++;
    }

    edges.push({
      id: `in-${msg.id}`,
      source: sourceNodeId,
      target: `detail-${actor.id}`,
      type: 'message',
      animated: true,
      data: {
        sourceLabel: source.name,
        targetLabel: actor.name,
        description: msg.name || msg.description || '',
      } satisfies MessageEdgeData,
    });
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

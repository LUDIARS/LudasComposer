import type { Project, Actor } from '@/types/domain';
import { generateId } from '@/lib/utils';
import { updateScene, updateActor } from './storeHelpers';

export function addActorAction(
  project: Project,
  sceneId: string,
  actorData: Omit<Actor, 'id'> & { id?: string },
): { project: Project; id: string } {
  const id = actorData.id ?? generateId();
  const actor: Actor = {
    ...actorData,
    id,
    sequences: actorData.sequences ?? [],
    subSceneId: actorData.subSceneId ?? null,
    prefabId: actorData.prefabId ?? null,
  };
  return {
    project: updateScene(project, sceneId, (scene) => ({
      ...scene,
      actors: { ...scene.actors, [id]: actor },
    })),
    id,
  };
}

export function removeActorAction(project: Project, sceneId: string, actorId: string): Project {
  const scene = project.scenes[sceneId];
  if (!scene) return project;
  const removedActor = scene.actors[actorId];
  const { [actorId]: _, ...remainingActors } = scene.actors;
  const updatedActors = Object.fromEntries(
    Object.entries(remainingActors).map(([k, a]) => [
      k,
      { ...a, children: a.children.filter((c) => c !== actorId) },
    ]),
  );
  if (removedActor) {
    for (const childId of removedActor.children) {
      if (updatedActors[childId]) {
        updatedActors[childId] = { ...updatedActors[childId], parentId: null };
      }
    }
  }
  const updatedConnections = scene.connections.filter(
    (c) => c.sourceActorId !== actorId && c.targetActorId !== actorId,
  );
  return updateScene(project, sceneId, () => ({
    ...scene,
    actors: updatedActors,
    connections: updatedConnections,
  }));
}

export function updateActorPositionAction(
  project: Project,
  sceneId: string,
  actorId: string,
  pos: { x: number; y: number },
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({
    ...actor,
    position: pos,
  }));
}

export function setActorComponentsAction(
  project: Project,
  sceneId: string,
  actorId: string,
  componentIds: string[],
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({
    ...actor,
    components: componentIds,
  }));
}

export function setActorParentAction(
  project: Project,
  sceneId: string,
  actorId: string,
  parentId: string | null,
): Project {
  const scene = project.scenes[sceneId];
  if (!scene) return project;
  const actor = scene.actors[actorId];
  if (!actor) return project;

  // Circular dependency check
  if (parentId) {
    let current: string | null | undefined = parentId;
    while (current) {
      if (current === actorId) return project;
      current = scene.actors[current]?.parentId;
    }
  }

  const updatedActors = { ...scene.actors };
  for (const a of Object.values(updatedActors)) {
    if (a.children.includes(actorId)) {
      updatedActors[a.id] = {
        ...a,
        children: a.children.filter((c) => c !== actorId),
      };
    }
  }
  updatedActors[actorId] = { ...actor, parentId };
  if (parentId && updatedActors[parentId]) {
    updatedActors[parentId] = {
      ...updatedActors[parentId],
      children: [...updatedActors[parentId].children, actorId],
    };
  }
  return updateScene(project, sceneId, () => ({ ...scene, actors: updatedActors }));
}

export function renameActorAction(
  project: Project,
  sceneId: string,
  actorId: string,
  name: string,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({ ...actor, name }));
}

export function duplicateActorAction(
  project: Project,
  sceneId: string,
  actorId: string,
  offset = { x: 50, y: 50 },
): { project: Project; newId: string | null } {
  const scene = project.scenes[sceneId];
  if (!scene) return { project, newId: null };
  const actor = scene.actors[actorId];
  if (!actor) return { project, newId: null };

  const newId = generateId();
  const newActor: Actor = {
    ...JSON.parse(JSON.stringify(actor)),
    id: newId,
    name: `${actor.name} (Copy)`,
    position: {
      x: actor.position.x + offset.x,
      y: actor.position.y + offset.y,
    },
    parentId: null,
    children: [],
    prefabId: actor.prefabId,
  };

  const updated = updateScene(project, sceneId, (s) => ({
    ...s,
    actors: { ...s.actors, [newId]: newActor },
  }));
  return { project: updated, newId };
}

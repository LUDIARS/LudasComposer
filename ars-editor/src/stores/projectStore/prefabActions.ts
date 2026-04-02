import type { Project, Actor, Prefab } from '@/types/domain';
import { generateId } from '@/lib/utils';
import { updateScene } from './storeHelpers';

export function createPrefabAction(
  project: Project,
  name: string,
  sceneId: string,
  actorId: string,
): { project: Project; prefabId: string | null } {
  const scene = project.scenes[sceneId];
  if (!scene) return { project, prefabId: null };
  const actor = scene.actors[actorId];
  if (!actor) return { project, prefabId: null };

  const prefabId = generateId();
  const { id: _id, position: _pos, parentId: _pid, prefabId: _pfid, ...actorData } = actor;
  const prefab: Prefab = {
    id: prefabId,
    name,
    actor: JSON.parse(JSON.stringify(actorData)),
  };

  return {
    project: {
      ...project,
      prefabs: { ...project.prefabs, [prefabId]: prefab },
    },
    prefabId,
  };
}

export function deletePrefabAction(project: Project, id: string): Project {
  const { [id]: _, ...remaining } = project.prefabs;
  return { ...project, prefabs: remaining };
}

export function renamePrefabAction(project: Project, id: string, name: string): Project {
  const prefab = project.prefabs[id];
  if (!prefab) return project;
  return {
    ...project,
    prefabs: {
      ...project.prefabs,
      [id]: { ...prefab, name },
    },
  };
}

export function instantiatePrefabAction(
  project: Project,
  prefabId: string,
  sceneId: string,
  position: { x: number; y: number },
): { project: Project; newId: string | null } {
  const prefab = project.prefabs[prefabId];
  if (!prefab) return { project, newId: null };
  const scene = project.scenes[sceneId];
  if (!scene) return { project, newId: null };

  const newId = generateId();
  const newActor: Actor = {
    ...JSON.parse(JSON.stringify(prefab.actor)),
    id: newId,
    position,
    parentId: null,
    prefabId,
  };

  const updated = updateScene(project, sceneId, (s) => ({
    ...s,
    actors: { ...s.actors, [newId]: newActor },
  }));
  return { project: updated, newId };
}

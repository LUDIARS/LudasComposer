import type { Project, Actor, Scene, SceneState } from '@/types/domain';
import { generateId } from '@/lib/utils';

export function createSceneAction(project: Project, name: string): { project: Project } {
  const sceneId = generateId();
  const rootActorId = generateId();
  const rootActor: Actor = {
    id: rootActorId,
    name,
    role: 'scene',
    components: [],
    children: [],
    position: { x: 250, y: 50 },
    parentId: null,
    sequences: [],
    subSceneId: null,
    prefabId: null,
  };
  const defaultStateId = generateId();
  const defaultState: SceneState = {
    id: defaultStateId,
    name: 'Default',
    keyBindings: [],
  };
  const scene: Scene = {
    id: sceneId,
    name,
    rootActorId,
    actors: { [rootActorId]: rootActor },
    connections: [],
    states: [defaultState],
    activeStateId: defaultStateId,
  };
  return {
    project: {
      ...project,
      scenes: { ...project.scenes, [sceneId]: scene },
      activeSceneId: sceneId,
    },
  };
}

export function deleteSceneAction(project: Project, id: string): { project: Project } {
  const { [id]: _, ...remainingScenes } = project.scenes;
  const sceneIds = Object.keys(remainingScenes);
  return {
    project: {
      ...project,
      scenes: remainingScenes,
      activeSceneId:
        project.activeSceneId === id
          ? sceneIds.length > 0 ? sceneIds[0] : null
          : project.activeSceneId,
    },
  };
}

export function renameSceneAction(project: Project, id: string, name: string): Project {
  const scene = project.scenes[id];
  if (!scene) return project;
  return {
    ...project,
    scenes: {
      ...project.scenes,
      [id]: { ...scene, name },
    },
  };
}

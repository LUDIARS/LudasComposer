import type { Project, Scene, Actor } from '@/types/domain';

/** Project 内の Scene を更新するヘルパー */
export function updateScene(
  project: Project,
  sceneId: string,
  updater: (scene: Scene) => Scene,
): Project {
  const scene = project.scenes[sceneId];
  if (!scene) return project;
  return {
    ...project,
    scenes: {
      ...project.scenes,
      [sceneId]: updater(scene),
    },
  };
}

/** Scene 内の Actor を更新するヘルパー */
export function updateActor(
  project: Project,
  sceneId: string,
  actorId: string,
  updater: (actor: Actor) => Actor,
): Project {
  return updateScene(project, sceneId, (scene) => {
    const actor = scene.actors[actorId];
    if (!actor) return scene;
    return {
      ...scene,
      actors: {
        ...scene.actors,
        [actorId]: updater(actor),
      },
    };
  });
}

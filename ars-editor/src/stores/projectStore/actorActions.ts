import type { Project, Actor, Requirements, ActorState } from '@/types/domain';
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
    actorType: actorData.actorType ?? 'simple',
    requirements: actorData.requirements ?? { overview: '', goals: '', role: '', behavior: '' },
    actorStates: actorData.actorStates ?? [],
    flexibleContent: actorData.flexibleContent ?? '',
    subSceneId: actorData.subSceneId ?? null,
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
  const { [actorId]: _, ...remainingActors } = scene.actors;
  const updatedMessages = scene.messages.filter(
    (m) => m.sourceDomainId !== actorId && m.targetDomainId !== actorId,
  );
  return updateScene(project, sceneId, () => ({
    ...scene,
    actors: remainingActors,
    messages: updatedMessages,
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

export function renameActorAction(
  project: Project,
  sceneId: string,
  actorId: string,
  name: string,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({ ...actor, name }));
}

export function setActorTypeAction(
  project: Project,
  sceneId: string,
  actorId: string,
  actorType: string,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({ ...actor, actorType }));
}

export function setActorRequirementsAction(
  project: Project,
  sceneId: string,
  actorId: string,
  requirements: Requirements,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({ ...actor, requirements }));
}

export function setActorStatesAction(
  project: Project,
  sceneId: string,
  actorId: string,
  actorStates: ActorState[],
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({ ...actor, actorStates }));
}

export function addActorStateAction(
  project: Project,
  sceneId: string,
  actorId: string,
  name: string,
): { project: Project; stateId: string } {
  const stateId = generateId();
  const newState: ActorState = { id: stateId, name, processes: [] };
  return {
    project: updateActor(project, sceneId, actorId, (actor) => ({
      ...actor,
      actorStates: [...actor.actorStates, newState],
    })),
    stateId,
  };
}

export function removeActorStateAction(
  project: Project,
  sceneId: string,
  actorId: string,
  stateId: string,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({
    ...actor,
    actorStates: actor.actorStates.filter((s) => s.id !== stateId),
  }));
}

export function updateActorStateAction(
  project: Project,
  sceneId: string,
  actorId: string,
  stateId: string,
  updates: Partial<ActorState>,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({
    ...actor,
    actorStates: actor.actorStates.map((s) =>
      s.id === stateId ? { ...s, ...updates } : s,
    ),
  }));
}

export function setFlexibleContentAction(
  project: Project,
  sceneId: string,
  actorId: string,
  flexibleContent: string,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({ ...actor, flexibleContent }));
}

export function setActorSubSceneAction(
  project: Project,
  sceneId: string,
  actorId: string,
  subSceneId: string | null,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({ ...actor, subSceneId }));
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
  };

  const updated = updateScene(project, sceneId, (s) => ({
    ...s,
    actors: { ...s.actors, [newId]: newActor },
  }));
  return { project: updated, newId };
}

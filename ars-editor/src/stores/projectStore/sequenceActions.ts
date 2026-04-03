import type { Project, SequenceStep } from '@/types/domain';
import { generateId } from '@/lib/utils';
import { updateActor } from './storeHelpers';

export function setActorSequencesAction(
  project: Project,
  sceneId: string,
  actorId: string,
  sequences: SequenceStep[],
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({
    ...actor,
    sequences,
  }));
}

export function addSequenceStepAction(
  project: Project,
  sceneId: string,
  actorId: string,
  stepData: Omit<SequenceStep, 'id'>,
): Project {
  const step: SequenceStep = { ...stepData, id: generateId() };
  return updateActor(project, sceneId, actorId, (actor) => ({
    ...actor,
    sequences: [...actor.sequences, step],
  }));
}

export function removeSequenceStepAction(
  project: Project,
  sceneId: string,
  actorId: string,
  stepId: string,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({
    ...actor,
    sequences: actor.sequences.filter((s) => s.id !== stepId),
  }));
}

export function updateSequenceStepAction(
  project: Project,
  sceneId: string,
  actorId: string,
  stepId: string,
  updates: Partial<SequenceStep>,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({
    ...actor,
    sequences: actor.sequences.map((s) =>
      s.id === stepId ? { ...s, ...updates } : s,
    ),
  }));
}

export function setActorSubSceneAction(
  project: Project,
  sceneId: string,
  actorId: string,
  subSceneId: string | null,
): Project {
  return updateActor(project, sceneId, actorId, (actor) => ({
    ...actor,
    subSceneId,
  }));
}

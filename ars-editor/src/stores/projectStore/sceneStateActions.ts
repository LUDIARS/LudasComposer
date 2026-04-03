import type { Project, SceneState, KeyBinding } from '@/types/domain';
import { generateId } from '@/lib/utils';
import { updateScene } from './storeHelpers';

export function addSceneStateAction(
  project: Project,
  sceneId: string,
  name: string,
): { project: Project; stateId: string } {
  const stateId = generateId();
  const newState: SceneState = { id: stateId, name, keyBindings: [] };
  return {
    project: updateScene(project, sceneId, (scene) => ({
      ...scene,
      states: [...scene.states, newState],
      activeStateId: scene.activeStateId ?? stateId,
    })),
    stateId,
  };
}

export function removeSceneStateAction(
  project: Project,
  sceneId: string,
  stateId: string,
): Project {
  return updateScene(project, sceneId, (scene) => {
    const newStates = scene.states.filter((s) => s.id !== stateId);
    return {
      ...scene,
      states: newStates,
      activeStateId:
        scene.activeStateId === stateId
          ? newStates.length > 0 ? newStates[0].id : null
          : scene.activeStateId,
    };
  });
}

export function renameSceneStateAction(
  project: Project,
  sceneId: string,
  stateId: string,
  name: string,
): Project {
  return updateScene(project, sceneId, (scene) => ({
    ...scene,
    states: scene.states.map((s) =>
      s.id === stateId ? { ...s, name } : s,
    ),
  }));
}

export function setActiveStateAction(
  project: Project,
  sceneId: string,
  stateId: string | null,
): Project {
  return updateScene(project, sceneId, (scene) => ({
    ...scene,
    activeStateId: stateId,
  }));
}

export function addKeyBindingAction(
  project: Project,
  sceneId: string,
  stateId: string,
  bindingData: Omit<KeyBinding, 'id'>,
): { project: Project; bindingId: string } {
  const bindingId = generateId();
  const binding: KeyBinding = { ...bindingData, id: bindingId };
  const updated = updateScene(project, sceneId, (scene) => {
    const newStates = scene.states.map((s) =>
      s.id === stateId
        ? { ...s, keyBindings: [...s.keyBindings, binding] }
        : s,
    );

    let newConnections = scene.connections;
    if (binding.targetActorId && scene.actors[binding.targetActorId]) {
      const alreadyConnected = scene.connections.some(
        (c) =>
          c.sourceActorId === scene.rootActorId &&
          c.targetActorId === binding.targetActorId &&
          c.sourcePort === `key:${binding.key}`,
      );
      if (!alreadyConnected) {
        newConnections = [
          ...scene.connections,
          {
            id: generateId(),
            sourceActorId: scene.rootActorId,
            sourcePort: `key:${binding.key}`,
            targetActorId: binding.targetActorId,
            targetPort: 'input',
          },
        ];
      }
    }

    return { ...scene, states: newStates, connections: newConnections };
  });
  return { project: updated, bindingId };
}

export function updateKeyBindingAction(
  project: Project,
  sceneId: string,
  stateId: string,
  bindingId: string,
  updates: Partial<KeyBinding>,
): Project {
  return updateScene(project, sceneId, (scene) => {
    let updatedBinding: KeyBinding | null = null;
    const newStates = scene.states.map((s) =>
      s.id === stateId
        ? {
            ...s,
            keyBindings: s.keyBindings.map((b) => {
              if (b.id === bindingId) {
                updatedBinding = { ...b, ...updates };
                return updatedBinding;
              }
              return b;
            }),
          }
        : s,
    );

    let newConnections = scene.connections;
    if (updatedBinding && (updatedBinding as KeyBinding).targetActorId) {
      const targetId = (updatedBinding as KeyBinding).targetActorId!;
      const key = (updatedBinding as KeyBinding).key;
      if (scene.actors[targetId]) {
        const alreadyConnected = scene.connections.some(
          (c) =>
            c.sourceActorId === scene.rootActorId &&
            c.targetActorId === targetId &&
            c.sourcePort === `key:${key}`,
        );
        if (!alreadyConnected) {
          newConnections = [
            ...scene.connections,
            {
              id: generateId(),
              sourceActorId: scene.rootActorId,
              sourcePort: `key:${key}`,
              targetActorId: targetId,
              targetPort: 'input',
            },
          ];
        }
      }
    }

    return { ...scene, states: newStates, connections: newConnections };
  });
}

export function removeKeyBindingAction(
  project: Project,
  sceneId: string,
  stateId: string,
  bindingId: string,
): Project {
  return updateScene(project, sceneId, (scene) => ({
    ...scene,
    states: scene.states.map((s) =>
      s.id === stateId
        ? { ...s, keyBindings: s.keyBindings.filter((b) => b.id !== bindingId) }
        : s,
    ),
  }));
}

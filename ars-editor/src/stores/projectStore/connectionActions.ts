import type { Project, Action, Message, Component } from '@/types/domain';
import { generateId } from '@/lib/utils';
import { updateScene } from './storeHelpers';

export function addMessageAction(
  project: Project,
  sceneId: string,
  messageData: Omit<Message, 'id'>,
): Project {
  const message: Message = { ...messageData, id: generateId() };
  return updateScene(project, sceneId, (scene) => ({
    ...scene,
    messages: [...scene.messages, message],
  }));
}

export function removeMessageAction(
  project: Project,
  sceneId: string,
  messageId: string,
): Project {
  return updateScene(project, sceneId, (scene) => ({
    ...scene,
    messages: scene.messages.filter((m) => m.id !== messageId),
  }));
}

export function updateMessageAction(
  project: Project,
  sceneId: string,
  messageId: string,
  updates: Partial<Message>,
): Project {
  return updateScene(project, sceneId, (scene) => ({
    ...scene,
    messages: scene.messages.map((m) =>
      m.id === messageId ? { ...m, ...updates } : m,
    ),
  }));
}

// ── Action CRUD ──────────────────────────────────────

export function addActionAction(
  project: Project,
  sceneId: string,
  actionData: Omit<Action, 'id'>,
): { project: Project; id: string } {
  const id = generateId();
  const action: Action = { ...actionData, id };
  const updated = updateScene(project, sceneId, (scene) => ({
    ...scene,
    actions: { ...scene.actions, [id]: action },
  }));
  return { project: updated, id };
}

export function removeActionAction(
  project: Project,
  sceneId: string,
  actionId: string,
): Project {
  return updateScene(project, sceneId, (scene) => {
    const { [actionId]: _, ...remaining } = scene.actions;
    // メッセージからも参照を除去
    const messages = scene.messages.map((m) => ({
      ...m,
      actionIds: m.actionIds.filter((id) => id !== actionId),
    }));
    return { ...scene, actions: remaining, messages };
  });
}

export function updateActionAction(
  project: Project,
  sceneId: string,
  actionId: string,
  updates: Partial<Action>,
): Project {
  return updateScene(project, sceneId, (scene) => ({
    ...scene,
    actions: {
      ...scene.actions,
      [actionId]: { ...scene.actions[actionId], ...updates },
    },
  }));
}

// ── Component CRUD ───────────────────────────────────

export function upsertComponentAction(project: Project, component: Component): Project {
  return {
    ...project,
    components: {
      ...project.components,
      [component.id]: component,
    },
  };
}

export function deleteComponentAction(project: Project, id: string): Project {
  const { [id]: _, ...remaining } = project.components;
  return { ...project, components: remaining };
}

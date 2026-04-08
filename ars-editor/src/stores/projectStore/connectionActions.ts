import type { Project, Message, Component } from '@/types/domain';
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

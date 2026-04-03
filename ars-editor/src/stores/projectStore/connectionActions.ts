import type { Project, Connection, Component } from '@/types/domain';
import { generateId } from '@/lib/utils';
import { updateScene } from './storeHelpers';

export function addConnectionAction(
  project: Project,
  sceneId: string,
  connectionData: Omit<Connection, 'id'>,
): Project {
  const connection: Connection = { ...connectionData, id: generateId() };
  return updateScene(project, sceneId, (scene) => ({
    ...scene,
    connections: [...scene.connections, connection],
  }));
}

export function removeConnectionAction(
  project: Project,
  sceneId: string,
  connectionId: string,
): Project {
  return updateScene(project, sceneId, (scene) => ({
    ...scene,
    connections: scene.connections.filter((c) => c.id !== connectionId),
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

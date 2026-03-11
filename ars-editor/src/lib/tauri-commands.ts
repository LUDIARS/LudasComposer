import { useProjectStore } from '@/stores/projectStore';
import * as backend from './backend';

export async function saveProjectToFile(path: string): Promise<void> {
  const project = useProjectStore.getState().project;
  await backend.saveProject(path, project);
}

export async function loadProjectFromFile(path: string): Promise<void> {
  const project = await backend.loadProject(path);
  useProjectStore.getState().loadProject(project);
}

export async function getDefaultProjectPath(): Promise<string> {
  return backend.getDefaultProjectPath();
}

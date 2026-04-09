import { useProjectStore } from '@/stores/projectStore';
import * as backend from './backend';
import { safeLoadProject } from './project-loader';

export async function saveProjectToFile(path: string): Promise<void> {
  const project = useProjectStore.getState().project;
  await backend.saveProject(path, project);
}

export async function loadProjectFromFile(path: string): Promise<void> {
  const project = await backend.loadProject(path);
  safeLoadProject(project, path);
}

export async function getDefaultProjectPath(): Promise<string> {
  return backend.getDefaultProjectPath();
}

import { invoke } from '@tauri-apps/api/core';
import type { Project } from '@/types/domain';
import { useProjectStore } from '@/stores/projectStore';

export async function saveProjectToFile(path: string): Promise<void> {
  const project = useProjectStore.getState().project;
  await invoke('save_project', { path, project });
}

export async function loadProjectFromFile(path: string): Promise<void> {
  const project = await invoke<Project>('load_project', { path });
  useProjectStore.getState().loadProject(project);
}

export async function getDefaultProjectPath(): Promise<string> {
  return invoke<string>('get_default_project_path');
}

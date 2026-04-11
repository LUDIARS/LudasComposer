import type { Project } from '@/types/domain';
import type {
  CodegenOptions,
  CodegenBridgeConfig,
  CodegenPreviewResult,
} from '@/types/codegen';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

async function webFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function saveProject(path: string, project: Project): Promise<void> {
  if (isTauri()) {
    await tauriInvoke('save_project', { path, project });
  } else {
    await webFetch('/project/save', {
      method: 'POST',
      body: JSON.stringify({ path, project }),
    });
  }
}

export async function loadProject(path: string): Promise<Project> {
  if (isTauri()) {
    return tauriInvoke<Project>('load_project', { path });
  }
  return webFetch<Project>(`/project/load?path=${encodeURIComponent(path)}`);
}

export async function getDefaultProjectPath(): Promise<string> {
  if (isTauri()) {
    return tauriInvoke<string>('get_default_project_path');
  }
  return webFetch<string>('/project/default-path');
}

export async function listProjects(): Promise<string[]> {
  if (isTauri()) {
    // Tauri doesn't have a list command built-in, return empty
    return [];
  }
  return webFetch<string[]>('/project/list');
}

// ── Code Generation Bridge ──────────────────────────

export async function getCodegenOptions(): Promise<CodegenOptions> {
  return webFetch<CodegenOptions>('/codegen/options');
}

export async function codegenPreview(
  project: Project,
  config: CodegenBridgeConfig,
): Promise<CodegenPreviewResult> {
  return webFetch<CodegenPreviewResult>('/codegen/preview', {
    method: 'POST',
    body: JSON.stringify({ project, config }),
  });
}

export { isTauri };

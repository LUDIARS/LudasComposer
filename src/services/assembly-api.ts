/**
 * アセンブリ管理 Tauri Command ラッパー
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  ProjectAssemblyConfig,
  CoreAssembly,
  ApplicationAssembly,
  ReleaseDepotConfig,
  ResourceDepotRef,
  DataOrganizerRef,
} from '../types/assembly';

interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── 設定全体 ───

export async function getAssemblyConfig(): Promise<CommandResult<ProjectAssemblyConfig>> {
  return invoke<CommandResult<ProjectAssemblyConfig>>('get_assembly_config');
}

// ─── リリースデポ ───

export async function addReleaseDepot(params: {
  name: string;
  url: string;
  auth_token?: string;
}): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('add_release_depot', { params });
}

export async function removeReleaseDepot(name: string): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('remove_release_depot', { name });
}

export async function getReleaseDepots(): Promise<CommandResult<ReleaseDepotConfig[]>> {
  return invoke<CommandResult<ReleaseDepotConfig[]>>('get_release_depots');
}

// ─── コアアセンブリ ───

export async function addCoreAssembly(assembly: CoreAssembly): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('add_core_assembly', { assembly });
}

export async function updateCoreAssembly(assembly: CoreAssembly): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('update_core_assembly', { assembly });
}

export async function removeCoreAssembly(id: string): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('remove_core_assembly', { id });
}

export async function getCoreAssemblies(): Promise<CommandResult<CoreAssembly[]>> {
  return invoke<CommandResult<CoreAssembly[]>>('get_core_assemblies');
}

export async function getCoreAssembly(id: string): Promise<CommandResult<CoreAssembly>> {
  return invoke<CommandResult<CoreAssembly>>('get_core_assembly', { id });
}

// ─── アプリケーションアセンブリ ───

export async function addAppAssembly(assembly: ApplicationAssembly): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('add_app_assembly', { assembly });
}

export async function updateAppAssembly(assembly: ApplicationAssembly): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('update_app_assembly', { assembly });
}

export async function removeAppAssembly(id: string): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('remove_app_assembly', { id });
}

export async function getAppAssemblies(): Promise<CommandResult<ApplicationAssembly[]>> {
  return invoke<CommandResult<ApplicationAssembly[]>>('get_app_assemblies');
}

export async function getAppAssembly(id: string): Promise<CommandResult<ApplicationAssembly>> {
  return invoke<CommandResult<ApplicationAssembly>>('get_app_assembly', { id });
}

export async function getAppAssembliesByScene(sceneId: string): Promise<CommandResult<ApplicationAssembly[]>> {
  return invoke<CommandResult<ApplicationAssembly[]>>('get_app_assemblies_by_scene', { sceneId });
}

// ─── 外部システム参照 ───

export async function setResourceDepotRef(depotRef: ResourceDepotRef | null): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('set_resource_depot_ref', { depotRef });
}

export async function setDataOrganizerRef(orgRef: DataOrganizerRef | null): Promise<CommandResult<void>> {
  return invoke<CommandResult<void>>('set_data_organizer_ref', { orgRef });
}

// ─── 依存関係 ───

export async function resolveConcoreDependencies(appAssemblyId: string): Promise<CommandResult<CoreAssembly[]>> {
  return invoke<CommandResult<CoreAssembly[]>>('resolve_core_dependencies', { appAssemblyId });
}

import { useProjectStore } from './projectStore';
import type { Project } from '@/types/domain';

const MAX_HISTORY = 50;

const past: Project[] = [];
const future: Project[] = [];

export function pushHistory(snapshot: Project) {
  past.push(JSON.parse(JSON.stringify(snapshot)));
  if (past.length > MAX_HISTORY) past.shift();
  future.length = 0;
}

export function undo() {
  if (past.length === 0) return;
  const current = useProjectStore.getState().project;
  future.unshift(JSON.parse(JSON.stringify(current)));
  const prev = past.pop()!;
  useProjectStore.getState().loadProject(prev);
}

export function redo() {
  if (future.length === 0) return;
  const current = useProjectStore.getState().project;
  past.push(JSON.parse(JSON.stringify(current)));
  const next = future.shift()!;
  useProjectStore.getState().loadProject(next);
}

export function canUndo() {
  return past.length > 0;
}

export function canRedo() {
  return future.length > 0;
}

import { useProjectStore } from './projectStore';
import type { Project } from '@/types/domain';
import { SnapshotCommand, type Command } from './memento';

const MAX_HISTORY = 50;

/**
 * CommandHistory (Caretaker): Manages the undo/redo stacks of Command objects.
 * Each command encapsulates mementos (before/after snapshots) for state restoration.
 */
class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private restoringCount = 0;

  /** True while undo/redo is restoring state — prevents re-entry */
  get restoring(): boolean {
    return this.restoringCount > 0;
  }

  /** Push a pre-built command onto the undo stack */
  push(command: Command): void {
    this.undoStack.push(command);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** Undo the most recent command */
  undo(): void {
    if (this.undoStack.length === 0) return;
    const command = this.undoStack.pop()!;
    this.restoringCount++;
    try {
      command.undo();
      this.redoStack.unshift(command);
    } finally {
      this.restoringCount--;
    }
  }

  /** Redo the most recently undone command */
  redo(): void {
    if (this.redoStack.length === 0) return;
    const command = this.redoStack.shift()!;
    this.restoringCount++;
    try {
      command.redo();
      this.undoStack.push(command);
    } finally {
      this.restoringCount--;
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

/** Singleton caretaker instance */
const history = new CommandHistory();

/**
 * Push a snapshot-based command for an already-applied state change.
 * @param snapshot The project state BEFORE the change was applied
 */
export function pushHistory(snapshot: Project): void {
  if (history.restoring) return;
  const restoreProject = (project: Project) =>
    useProjectStore.getState().loadProject(project);
  const command = new SnapshotCommand('edit', snapshot, restoreProject);
  command.setAfter(useProjectStore.getState().project);
  history.push(command);
}

/**
 * Execute a command and record it in the history.
 * The command captures before/after mementos automatically.
 */
export function executeCommand(command: Command): void {
  command.execute();
  history.push(command);
}

export function undo(): void {
  history.undo();
}

export function redo(): void {
  history.redo();
}

export function canUndo(): boolean {
  return history.canUndo();
}

export function canRedo(): boolean {
  return history.canRedo();
}

export function clearHistory(): void {
  history.clear();
}

export function isRestoring(): boolean {
  return history.restoring;
}

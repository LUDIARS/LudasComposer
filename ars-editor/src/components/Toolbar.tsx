import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { canUndo, canRedo, undo, redo } from '@/stores/historyMiddleware';
import * as backend from '@/lib/backend';

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const handleSave = useCallback(async () => {
    try {
      let path = projectPath;
      if (!path) {
        const defaultDir = await backend.getDefaultProjectPath();
        path = `${defaultDir}/${project.name.replace(/\s+/g, '_')}.json`;
      }
      await backend.saveProject(path, project);
      setProjectPath(path);
      setStatus('Saved!');
      setTimeout(() => setStatus(''), 2000);
    } catch {
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Downloaded!');
      setTimeout(() => setStatus(''), 2000);
    }
  }, [project, projectPath]);

  const handleLoad = useCallback(async () => {
    if (backend.isTauri()) {
      try {
        const input = prompt('Enter project file path:');
        if (!input) return;
        const loaded = await backend.loadProject(input);
        loadProject(loaded);
        setProjectPath(input);
        setStatus('Loaded!');
        setTimeout(() => setStatus(''), 2000);
      } catch {
        setStatus('Load failed');
        setTimeout(() => setStatus(''), 2000);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          loadProject(parsed);
          setStatus('Loaded!');
          setTimeout(() => setStatus(''), 2000);
        } catch {
          setStatus('Invalid file');
          setTimeout(() => setStatus(''), 2000);
        }
      };
      input.click();
    }
  }, [loadProject]);

  const handleNew = useCallback(() => {
    if (!confirm('Create a new project? Unsaved changes will be lost.')) return;
    loadProject({
      name: 'Untitled Project',
      scenes: {},
      components: {},
      activeSceneId: null,
    });
    setProjectPath(null);
    setStatus('New project');
    setTimeout(() => setStatus(''), 2000);
  }, [loadProject]);

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border-b border-zinc-700 text-xs">
      {/* File operations */}
      <button
        onClick={handleNew}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        title="New Project"
      >
        New
      </button>
      <button
        onClick={handleLoad}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        title="Open Project"
      >
        Open
      </button>
      <button
        onClick={handleSave}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        title="Save Project (Ctrl+S)"
      >
        Save
      </button>

      <div className="w-px h-4 bg-zinc-600 mx-1" />

      {/* Undo/Redo */}
      <button
        onClick={() => undo()}
        disabled={!canUndo()}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={() => redo()}
        disabled={!canRedo()}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>

      {/* Project name */}
      <div className="flex-1" />
      <span className="text-zinc-500 truncate max-w-[200px]">{project.name}</span>
      {status && (
        <span className="text-green-400 ml-2">{status}</span>
      )}
    </div>
  );
}

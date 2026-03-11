import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { canUndo, canRedo, undo, redo } from '@/stores/historyMiddleware';
import * as backend from '@/lib/backend';

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const isDirty = useEditorStore((s) => s.isDirty);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const projectPath = useEditorStore((s) => s.projectPath);
  const markDirty = useEditorStore((s) => s.markDirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const setProjectPath = useEditorStore((s) => s.setProjectPath);
  const togglePanel = useEditorStore((s) => s.togglePanel);
  const panelVisibility = useEditorStore((s) => s.panelVisibility);
  const [status, setStatus] = useState<string>('');

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2000);
  };

  const handleSave = useCallback(async () => {
    try {
      let path = projectPath;
      if (!path) {
        const defaultDir = await backend.getDefaultProjectPath();
        path = `${defaultDir}/${project.name.replace(/\s+/g, '_')}.json`;
      }
      await backend.saveProject(path, project);
      markSaved(path);
      showStatus('Saved!');
    } catch {
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      markSaved();
      showStatus('Downloaded!');
    }
  }, [project, projectPath, markSaved]);

  const handleLoad = useCallback(async () => {
    if (backend.isTauri()) {
      try {
        const input = prompt('Enter project file path:');
        if (!input) return;
        const loaded = await backend.loadProject(input);
        loadProject(loaded);
        setProjectPath(input);
        markSaved(input);
        showStatus('Loaded!');
      } catch {
        showStatus('Load failed');
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
          markSaved();
          showStatus('Loaded!');
        } catch {
          showStatus('Invalid file');
        }
      };
      input.click();
    }
  }, [loadProject, setProjectPath, markSaved]);

  const handleNew = useCallback(() => {
    if (isDirty && !confirm('Create a new project? Unsaved changes will be lost.')) return;
    loadProject({
      name: 'Untitled Project',
      scenes: {},
      components: {},
      prefabs: {},
      activeSceneId: null,
    });
    setProjectPath(null);
    markSaved();
    showStatus('New project');
  }, [loadProject, setProjectPath, markSaved, isDirty]);

  const lastSavedLabel = lastSavedAt
    ? `Last saved: ${new Date(lastSavedAt).toLocaleTimeString()}`
    : '';

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
        Save{isDirty ? ' *' : ''}
      </button>

      <div className="w-px h-4 bg-zinc-600 mx-1" />

      {/* Undo/Redo */}
      <button
        onClick={() => { undo(); markDirty(); }}
        disabled={!canUndo()}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={() => { redo(); markDirty(); }}
        disabled={!canRedo()}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>

      <div className="w-px h-4 bg-zinc-600 mx-1" />

      {/* View toggles */}
      <button
        onClick={() => togglePanel('componentList')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.componentList
            ? 'bg-blue-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title="Toggle Component List"
      >
        Components
      </button>
      <button
        onClick={() => togglePanel('prefabList')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.prefabList
            ? 'bg-purple-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title="Toggle Prefab List"
      >
        Prefabs
      </button>
      <button
        onClick={() => togglePanel('preview')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.preview
            ? 'bg-blue-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title="Toggle Preview"
      >
        Preview
      </button>

      {/* Project name & status */}
      <div className="flex-1" />
      {lastSavedLabel && !status && (
        <span className="text-zinc-600 mr-2">{lastSavedLabel}</span>
      )}
      <span className="text-zinc-500 truncate max-w-[200px]">
        {project.name}
        {isDirty && <span className="text-amber-400 ml-1">(unsaved)</span>}
      </span>
      {status && (
        <span className="text-green-400 ml-2">{status}</span>
      )}
    </div>
  );
}

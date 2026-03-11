import { useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { SceneList } from './features/scene-manager';
import { NodeCanvas } from './features/node-editor';
import { ComponentPicker } from './features/component-picker';
import { ComponentEditor } from './features/component-editor';
import { ComponentList } from './features/component-list';
import { ScenePreview } from './features/preview';
import { Toolbar } from './components/Toolbar';
import { useEditorStore } from './stores/editorStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProjectStore } from './stores/projectStore';
import * as backend from './lib/backend';

function AppInner() {
  const componentPickerTarget = useEditorStore((s) => s.componentPickerTarget);
  const panelVisibility = useEditorStore((s) => s.panelVisibility);
  const openComponentEditor = useEditorStore((s) => s.openComponentEditor);
  const markDirty = useEditorStore((s) => s.markDirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const projectPath = useEditorStore((s) => s.projectPath);
  const project = useProjectStore((s) => s.project);

  // Track project changes to mark dirty
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    markDirty();
  }, [project, markDirty]);

  const handleSave = useCallback(async () => {
    try {
      let path = projectPath;
      if (!path) {
        const defaultDir = await backend.getDefaultProjectPath();
        path = `${defaultDir}/${project.name.replace(/\s+/g, '_')}.json`;
      }
      await backend.saveProject(path, project);
      markSaved(path);
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
    }
  }, [project, projectPath, markSaved]);

  useKeyboardShortcuts({ onSave: handleSave });

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-900 text-zinc-200">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Scene Manager */}
        {panelVisibility.sceneManager && (
          <div className="w-60 min-w-[240px] bg-zinc-850 border-r border-zinc-700 flex flex-col">
            <div className="flex-1 overflow-hidden">
              <SceneList />
            </div>
            <div className="border-t border-zinc-700 p-2">
              <button
                className="w-full text-xs text-blue-400 hover:text-blue-300 hover:bg-zinc-800 py-2 rounded transition-colors"
                onClick={() => openComponentEditor(null)}
              >
                + New Component
              </button>
            </div>
          </div>
        )}

        {/* Component List Panel */}
        {panelVisibility.componentList && (
          <div className="w-64 min-w-[256px] bg-zinc-850 border-r border-zinc-700">
            <ComponentList />
          </div>
        )}

        {/* Main - Node Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <NodeCanvas />
        </div>

        {/* Preview Panel */}
        {panelVisibility.preview && (
          <div className="w-72 min-w-[288px] bg-zinc-850 border-l border-zinc-700">
            <ScenePreview />
          </div>
        )}

        {/* Right Panel - Component Editor */}
        {panelVisibility.componentEditor && (
          <div className="w-80 min-w-[320px] bg-zinc-850 border-l border-zinc-700">
            <ComponentEditor />
          </div>
        )}

        {/* Modal - Component Picker */}
        {componentPickerTarget && <ComponentPicker />}
      </div>
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}

export default App;

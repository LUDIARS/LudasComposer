import { useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { SceneList } from './features/scene-manager';
import { NodeCanvas } from './features/node-editor';
import { ComponentPicker } from './features/component-picker';
import { ComponentEditor } from './features/component-editor';
import { Toolbar } from './components/Toolbar';
import { useEditorStore } from './stores/editorStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProjectStore } from './stores/projectStore';

function AppInner() {
  const componentPickerTarget = useEditorStore((s) => s.componentPickerTarget);
  const panelVisibility = useEditorStore((s) => s.panelVisibility);
  const openComponentEditor = useEditorStore((s) => s.openComponentEditor);
  const project = useProjectStore((s) => s.project);

  const handleSave = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const defaultDir = await invoke<string>('get_default_project_path');
      const path = `${defaultDir}/${project.name.replace(/\s+/g, '_')}.json`;
      await invoke('save_project', { path, project });
    } catch {
      // Fallback: download as file in browser dev mode
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [project]);

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

        {/* Main - Node Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <NodeCanvas />
        </div>

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

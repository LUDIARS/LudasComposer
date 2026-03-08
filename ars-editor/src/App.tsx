import { ReactFlowProvider } from '@xyflow/react';
import { SceneList } from './features/scene-manager';
import { NodeCanvas } from './features/node-editor';
import { ComponentPicker } from './features/component-picker';
import { ComponentEditor } from './features/component-editor';
import { useEditorStore } from './stores/editorStore';

function App() {
  const componentPickerTarget = useEditorStore((s) => s.componentPickerTarget);
  const panelVisibility = useEditorStore((s) => s.panelVisibility);
  const openComponentEditor = useEditorStore((s) => s.openComponentEditor);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen bg-zinc-900 text-zinc-200">
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
    </ReactFlowProvider>
  );
}

export default App;

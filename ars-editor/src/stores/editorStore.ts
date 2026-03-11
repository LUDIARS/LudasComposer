import { create } from 'zustand';

interface EditorState {
  selectedNodeIds: string[];
  contextMenu: { x: number; y: number } | null;
  componentPickerTarget: string | null;
  componentEditorTarget: string | null;
  panelVisibility: {
    sceneManager: boolean;
    componentEditor: boolean;
    componentList: boolean;
    preview: boolean;
  };
  isDirty: boolean;
  lastSavedAt: number | null;
  projectPath: string | null;

  setSelectedNodes: (ids: string[]) => void;
  openContextMenu: (pos: { x: number; y: number }) => void;
  closeContextMenu: () => void;
  openComponentPicker: (actorId: string) => void;
  closeComponentPicker: () => void;
  openComponentEditor: (componentId: string | null) => void;
  closeComponentEditor: () => void;
  togglePanel: (panel: 'sceneManager' | 'componentEditor' | 'componentList' | 'preview') => void;
  markDirty: () => void;
  markSaved: (path?: string) => void;
  setProjectPath: (path: string | null) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  selectedNodeIds: [],
  contextMenu: null,
  componentPickerTarget: null,
  componentEditorTarget: null,
  panelVisibility: {
    sceneManager: true,
    componentEditor: false,
    componentList: false,
    preview: false,
  },
  isDirty: false,
  lastSavedAt: null,
  projectPath: null,

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),
  openContextMenu: (pos) => set({ contextMenu: pos }),
  closeContextMenu: () => set({ contextMenu: null }),
  openComponentPicker: (actorId) => set({ componentPickerTarget: actorId }),
  closeComponentPicker: () => set({ componentPickerTarget: null }),
  openComponentEditor: (componentId) =>
    set({
      componentEditorTarget: componentId,
      panelVisibility: { sceneManager: true, componentEditor: true },
    }),
  closeComponentEditor: () =>
    set((s) => ({
      componentEditorTarget: null,
      panelVisibility: { ...s.panelVisibility, componentEditor: false },
    })),
  togglePanel: (panel) =>
    set((s) => ({
      panelVisibility: {
        ...s.panelVisibility,
        [panel]: !s.panelVisibility[panel],
      },
    })),
  markDirty: () => set({ isDirty: true }),
  markSaved: (path) =>
    set((s) => ({
      isDirty: false,
      lastSavedAt: Date.now(),
      projectPath: path ?? s.projectPath,
    })),
  setProjectPath: (path) => set({ projectPath: path }),
}));

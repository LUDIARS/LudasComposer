import { create } from 'zustand';
import type { Actor } from '@/types/domain';

interface EditorState {
  selectedNodeIds: string[];
  contextMenu: { x: number; y: number } | null;
  componentPickerTarget: string | null;
  componentEditorTarget: string | null;
  sequenceEditorTarget: string | null;
  subScenePickerTarget: string | null;
  clipboard: Actor[] | null;
  panelVisibility: {
    sceneManager: boolean;
    componentEditor: boolean;
    componentList: boolean;
    preview: boolean;
    prefabList: boolean;
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
  openSequenceEditor: (actorId: string) => void;
  closeSequenceEditor: () => void;
  openSubScenePicker: (actorId: string) => void;
  closeSubScenePicker: () => void;
  copyToClipboard: (actors: Actor[]) => void;
  clearClipboard: () => void;
  togglePanel: (panel: 'sceneManager' | 'componentEditor' | 'componentList' | 'preview' | 'prefabList') => void;
  markDirty: () => void;
  markSaved: (path?: string) => void;
  setProjectPath: (path: string | null) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  selectedNodeIds: [],
  contextMenu: null,
  componentPickerTarget: null,
  componentEditorTarget: null,
  sequenceEditorTarget: null,
  subScenePickerTarget: null,
  clipboard: null,
  panelVisibility: {
    sceneManager: true,
    componentEditor: false,
    componentList: false,
    preview: false,
    prefabList: false,
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
      panelVisibility: { sceneManager: true, componentEditor: true, componentList: false, preview: false, prefabList: false },
    }),
  closeComponentEditor: () =>
    set((s) => ({
      componentEditorTarget: null,
      panelVisibility: { ...s.panelVisibility, componentEditor: false },
    })),
  openSequenceEditor: (actorId) => set({ sequenceEditorTarget: actorId }),
  closeSequenceEditor: () => set({ sequenceEditorTarget: null }),
  openSubScenePicker: (actorId) => set({ subScenePickerTarget: actorId }),
  closeSubScenePicker: () => set({ subScenePickerTarget: null }),
  copyToClipboard: (actors) => set({ clipboard: JSON.parse(JSON.stringify(actors)) }),
  clearClipboard: () => set({ clipboard: null }),
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

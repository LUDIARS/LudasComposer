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
    behaviorEditor: boolean;
    domainDiagram: boolean;
  };
  isDirty: boolean;
  lastSavedAt: number | null;
  projectPath: string | null;
  mobileSceneMenuOpen: boolean;
  mobileBottomSheetOpen: boolean;

  /** AI code generation state */
  isGenerating: boolean;
  generationAbortController: AbortController | null;

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
  togglePanel: (panel: 'sceneManager' | 'componentEditor' | 'componentList' | 'preview' | 'prefabList' | 'behaviorEditor' | 'domainDiagram') => void;
  markDirty: () => void;
  markSaved: (path?: string) => void;
  setProjectPath: (path: string | null) => void;
  setMobileSceneMenu: (open: boolean) => void;
  setMobileBottomSheet: (open: boolean) => void;

  /** Start AI code generation, returns an AbortController to cancel it */
  startGeneration: () => AbortController;
  /** Mark AI code generation as finished */
  finishGeneration: () => void;
  /** Abort running AI code generation */
  abortGeneration: () => void;
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
    behaviorEditor: false,
    domainDiagram: false,
  },
  isDirty: false,
  lastSavedAt: null,
  projectPath: null,
  mobileSceneMenuOpen: false,
  mobileBottomSheetOpen: false,
  isGenerating: false,
  generationAbortController: null,

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),
  openContextMenu: (pos) => set({ contextMenu: pos }),
  closeContextMenu: () => set({ contextMenu: null }),
  openComponentPicker: (actorId) => set({ componentPickerTarget: actorId }),
  closeComponentPicker: () => set({ componentPickerTarget: null }),
  openComponentEditor: (componentId) =>
    set({
      componentEditorTarget: componentId,
      panelVisibility: { sceneManager: true, componentEditor: true, componentList: false, preview: false, prefabList: false, behaviorEditor: false, domainDiagram: false },
      mobileBottomSheetOpen: true,
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
  setMobileSceneMenu: (open) => set({ mobileSceneMenuOpen: open }),
  setMobileBottomSheet: (open) => set({ mobileBottomSheetOpen: open }),

  startGeneration: () => {
    const controller = new AbortController();
    set({ isGenerating: true, generationAbortController: controller });
    return controller;
  },
  finishGeneration: () =>
    set({ isGenerating: false, generationAbortController: null }),
  abortGeneration: () => {
    const { generationAbortController } = useEditorStore.getState();
    if (generationAbortController) {
      generationAbortController.abort();
    }
    set({ isGenerating: false, generationAbortController: null });
  },
}));

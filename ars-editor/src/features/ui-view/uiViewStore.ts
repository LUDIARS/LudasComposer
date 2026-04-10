import { create } from 'zustand';
import { generateId } from '@/lib/utils';
import type {
  UICanvasData,
  UIElement,
  UIElementType,
  UIElementProps,
  RectTransform,
  Vec2,
} from './types';
import { createDefaultCanvas, createDefaultRect, ELEMENT_DEFAULTS } from './types';

interface UIViewState {
  /** Per-scene canvas data */
  canvases: Record<string, UICanvasData>;
  selectedElementId: string | null;
  hoveredElementId: string | null;
  zoom: number;
  panOffset: Vec2;

  // Queries
  getCanvas: (sceneId: string) => UICanvasData;

  // Canvas actions
  ensureCanvas: (sceneId: string) => void;
  setCanvasSize: (sceneId: string, width: number, height: number) => void;

  // Element CRUD
  addElement: (sceneId: string, type: UIElementType, parentId?: string | null) => string;
  removeElement: (sceneId: string, elementId: string) => void;
  renameElement: (sceneId: string, elementId: string, name: string) => void;
  toggleVisibility: (sceneId: string, elementId: string) => void;
  updateRect: (sceneId: string, elementId: string, updates: Partial<RectTransform>) => void;
  updateProps: (sceneId: string, elementId: string, updates: Partial<UIElementProps>) => void;
  reparentElement: (sceneId: string, elementId: string, newParentId: string | null, index?: number) => void;
  reorderElement: (sceneId: string, elementId: string, direction: 'up' | 'down') => void;

  // Selection & viewport
  selectElement: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (offset: Vec2) => void;
  resetView: () => void;
}

function countByType(elements: Record<string, UIElement>, type: UIElementType): number {
  return Object.values(elements).filter((e) => e.type === type).length;
}

function updateCanvasInState(
  state: UIViewState,
  sceneId: string,
  updater: (canvas: UICanvasData) => UICanvasData,
): Partial<UIViewState> {
  const canvas = state.canvases[sceneId] ?? createDefaultCanvas();
  return {
    canvases: {
      ...state.canvases,
      [sceneId]: updater(canvas),
    },
  };
}

/** Recursively collect element and all descendant IDs */
function collectDescendants(elements: Record<string, UIElement>, elementId: string): string[] {
  const el = elements[elementId];
  if (!el) return [];
  const ids = [elementId];
  for (const childId of el.childIds) {
    ids.push(...collectDescendants(elements, childId));
  }
  return ids;
}

export const useUIViewStore = create<UIViewState>()((set, get) => ({
  canvases: {},
  selectedElementId: null,
  hoveredElementId: null,
  zoom: 0.5,
  panOffset: { x: 0, y: 0 },

  getCanvas: (sceneId) => {
    return get().canvases[sceneId] ?? createDefaultCanvas();
  },

  ensureCanvas: (sceneId) =>
    set((state) => {
      if (state.canvases[sceneId]) return {};
      return { canvases: { ...state.canvases, [sceneId]: createDefaultCanvas() } };
    }),

  setCanvasSize: (sceneId, width, height) =>
    set((state) =>
      updateCanvasInState(state, sceneId, (c) => ({ ...c, width, height })),
    ),

  addElement: (sceneId, type, parentId = null) => {
    const id = generateId();
    const state = get();
    const canvas = state.canvases[sceneId] ?? createDefaultCanvas();
    const defaults = ELEMENT_DEFAULTS[type];
    const count = countByType(canvas.elements, type) + 1;

    // Center new elements in parent or canvas
    const parentRect = parentId
      ? canvas.elements[parentId]?.rect
      : null;
    const containerW = parentRect?.width ?? canvas.width;
    const containerH = parentRect?.height ?? canvas.height;
    const elemW = defaults.rect.width ?? 200;
    const elemH = defaults.rect.height ?? 100;

    const element: UIElement = {
      id,
      name: `${type} ${count}`,
      type,
      parentId,
      rect: createDefaultRect({
        x: (containerW - elemW) / 2,
        y: (containerH - elemH) / 2,
        ...defaults.rect,
      }),
      visible: true,
      props: { ...defaults.props },
      childIds: [],
    };

    const newElements = { ...canvas.elements, [id]: element };

    let newRootIds = canvas.rootIds;
    if (parentId && newElements[parentId]) {
      newElements[parentId] = {
        ...newElements[parentId],
        childIds: [...newElements[parentId].childIds, id],
      };
    } else {
      newRootIds = [...canvas.rootIds, id];
    }

    set({
      canvases: {
        ...state.canvases,
        [sceneId]: { ...canvas, elements: newElements, rootIds: newRootIds },
      },
      selectedElementId: id,
    });

    return id;
  },

  removeElement: (sceneId, elementId) =>
    set((state) => {
      const canvas = state.canvases[sceneId];
      if (!canvas) return {};

      const el = canvas.elements[elementId];
      if (!el) return {};

      const idsToRemove = new Set(collectDescendants(canvas.elements, elementId));
      const newElements = { ...canvas.elements };
      for (const id of idsToRemove) {
        delete newElements[id];
      }

      // Remove from parent's childIds or rootIds
      let newRootIds = canvas.rootIds;
      if (el.parentId && newElements[el.parentId]) {
        newElements[el.parentId] = {
          ...newElements[el.parentId],
          childIds: newElements[el.parentId].childIds.filter((c) => c !== elementId),
        };
      } else {
        newRootIds = canvas.rootIds.filter((id) => id !== elementId);
      }

      return {
        canvases: {
          ...state.canvases,
          [sceneId]: { ...canvas, elements: newElements, rootIds: newRootIds },
        },
        selectedElementId:
          state.selectedElementId && idsToRemove.has(state.selectedElementId)
            ? null
            : state.selectedElementId,
      };
    }),

  renameElement: (sceneId, elementId, name) =>
    set((state) =>
      updateCanvasInState(state, sceneId, (c) => ({
        ...c,
        elements: {
          ...c.elements,
          [elementId]: c.elements[elementId]
            ? { ...c.elements[elementId], name }
            : c.elements[elementId],
        },
      })),
    ),

  toggleVisibility: (sceneId, elementId) =>
    set((state) =>
      updateCanvasInState(state, sceneId, (c) => {
        const el = c.elements[elementId];
        if (!el) return c;
        return {
          ...c,
          elements: { ...c.elements, [elementId]: { ...el, visible: !el.visible } },
        };
      }),
    ),

  updateRect: (sceneId, elementId, updates) =>
    set((state) =>
      updateCanvasInState(state, sceneId, (c) => {
        const el = c.elements[elementId];
        if (!el) return c;
        return {
          ...c,
          elements: {
            ...c.elements,
            [elementId]: { ...el, rect: { ...el.rect, ...updates } },
          },
        };
      }),
    ),

  updateProps: (sceneId, elementId, updates) =>
    set((state) =>
      updateCanvasInState(state, sceneId, (c) => {
        const el = c.elements[elementId];
        if (!el) return c;
        return {
          ...c,
          elements: {
            ...c.elements,
            [elementId]: { ...el, props: { ...el.props, ...updates } },
          },
        };
      }),
    ),

  reparentElement: (sceneId, elementId, newParentId, index) =>
    set((state) => {
      const canvas = state.canvases[sceneId];
      if (!canvas) return {};
      const el = canvas.elements[elementId];
      if (!el) return {};

      // Prevent parenting to self or descendant
      if (newParentId) {
        const descendants = collectDescendants(canvas.elements, elementId);
        if (descendants.includes(newParentId)) return {};
      }

      const newElements = { ...canvas.elements };
      let newRootIds = [...canvas.rootIds];

      // Remove from old parent
      if (el.parentId && newElements[el.parentId]) {
        newElements[el.parentId] = {
          ...newElements[el.parentId],
          childIds: newElements[el.parentId].childIds.filter((c) => c !== elementId),
        };
      } else {
        newRootIds = newRootIds.filter((id) => id !== elementId);
      }

      // Add to new parent
      if (newParentId && newElements[newParentId]) {
        const children = [...newElements[newParentId].childIds];
        const insertAt = index != null ? Math.min(index, children.length) : children.length;
        children.splice(insertAt, 0, elementId);
        newElements[newParentId] = { ...newElements[newParentId], childIds: children };
      } else {
        const insertAt = index != null ? Math.min(index, newRootIds.length) : newRootIds.length;
        newRootIds.splice(insertAt, 0, elementId);
      }

      newElements[elementId] = { ...el, parentId: newParentId };

      return {
        canvases: {
          ...state.canvases,
          [sceneId]: { ...canvas, elements: newElements, rootIds: newRootIds },
        },
      };
    }),

  reorderElement: (sceneId, elementId, direction) =>
    set((state) => {
      const canvas = state.canvases[sceneId];
      if (!canvas) return {};
      const el = canvas.elements[elementId];
      if (!el) return {};

      const newElements = { ...canvas.elements };
      let newRootIds = [...canvas.rootIds];

      const siblings = el.parentId
        ? [...(newElements[el.parentId]?.childIds ?? [])]
        : newRootIds;

      const idx = siblings.indexOf(elementId);
      if (idx === -1) return {};

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return {};

      [siblings[idx], siblings[swapIdx]] = [siblings[swapIdx], siblings[idx]];

      if (el.parentId && newElements[el.parentId]) {
        newElements[el.parentId] = { ...newElements[el.parentId], childIds: siblings };
      } else {
        newRootIds = siblings;
      }

      return {
        canvases: {
          ...state.canvases,
          [sceneId]: { ...canvas, elements: newElements, rootIds: newRootIds },
        },
      };
    }),

  selectElement: (id) => set({ selectedElementId: id }),
  setHovered: (id) => set({ hoveredElementId: id }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),
  setPan: (offset) => set({ panOffset: offset }),
  resetView: () => set({ zoom: 0.5, panOffset: { x: 0, y: 0 } }),
}));

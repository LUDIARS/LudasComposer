// UI View types — uGUI-inspired layout system for Ars editor

export type UIElementType = 'Panel' | 'Text' | 'Image' | 'Button';

export interface Vec2 {
  x: number;
  y: number;
}

export interface RectTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorMin: Vec2;
  anchorMax: Vec2;
  pivot: Vec2;
  rotation: number;
}

export interface UIElementProps {
  // Common
  backgroundColor?: string;
  opacity?: number;
  // Panel
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  // Text
  text?: string;
  fontSize?: number;
  fontColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold';
  // Image
  imageUrl?: string;
  imageFit?: 'contain' | 'cover' | 'fill';
  tintColor?: string;
  // Button
  label?: string;
  buttonColor?: string;
  hoverColor?: string;
  textColor?: string;
}

export interface UIElement {
  id: string;
  name: string;
  type: UIElementType;
  parentId: string | null;
  rect: RectTransform;
  visible: boolean;
  props: UIElementProps;
  childIds: string[];
}

export interface UICanvasData {
  width: number;
  height: number;
  elements: Record<string, UIElement>;
  rootIds: string[];
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

// ── Defaults ────────────────────────────────────────

export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;

export function createDefaultCanvas(): UICanvasData {
  return {
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
    elements: {},
    rootIds: [],
  };
}

export function createDefaultRect(overrides?: Partial<RectTransform>): RectTransform {
  return {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    anchorMin: { x: 0.5, y: 0.5 },
    anchorMax: { x: 0.5, y: 0.5 },
    pivot: { x: 0.5, y: 0.5 },
    rotation: 0,
    ...overrides,
  };
}

export const ELEMENT_DEFAULTS: Record<UIElementType, { rect: Partial<RectTransform>; props: UIElementProps }> = {
  Panel: {
    rect: { width: 300, height: 200 },
    props: { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 8 },
  },
  Text: {
    rect: { width: 200, height: 40 },
    props: { text: 'New Text', fontSize: 16, fontColor: '#e6edf3', textAlign: 'center' },
  },
  Image: {
    rect: { width: 150, height: 150 },
    props: { backgroundColor: 'rgba(100, 116, 139, 0.3)', imageFit: 'contain', borderRadius: 4 },
  },
  Button: {
    rect: { width: 160, height: 48 },
    props: { label: 'Button', buttonColor: '#3b82f6', textColor: '#ffffff', borderRadius: 6, fontSize: 14 },
  },
};

export const ELEMENT_TYPE_ICONS: Record<UIElementType, string> = {
  Panel: '\u25A1',  // □
  Text: 'T',
  Image: '\u25A3',  // ▣
  Button: '\u25A2',  // ▢
};

// ── Helpers ─────────────────────────────────────────

export function getAbsolutePosition(
  elementId: string,
  elements: Record<string, UIElement>,
): Vec2 {
  const el = elements[elementId];
  if (!el) return { x: 0, y: 0 };

  let x = el.rect.x;
  let y = el.rect.y;
  let pid = el.parentId;

  while (pid) {
    const parent = elements[pid];
    if (!parent) break;
    x += parent.rect.x;
    y += parent.rect.y;
    pid = parent.parentId;
  }

  return { x, y };
}

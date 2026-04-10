import { useUIViewStore } from '../uiViewStore';
import { useProjectStore } from '@/stores/projectStore';
import { UICanvas } from './UICanvas';
import { UIHierarchy } from './UIHierarchy';
import { UIInspector } from './UIInspector';
import type { UIElementType } from '../types';
import { ELEMENT_TYPE_ICONS } from '../types';

// ── Element toolbar ─────────────────────────────────

const ELEMENT_TYPES: { type: UIElementType; label: string }[] = [
  { type: 'Panel', label: 'Panel' },
  { type: 'Text', label: 'Text' },
  { type: 'Image', label: 'Image' },
  { type: 'Button', label: 'Button' },
];

function UIElementToolbar() {
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const addElement = useUIViewStore((s) => s.addElement);
  const selectedId = useUIViewStore((s) => s.selectedElementId);
  const canvas = useUIViewStore((s) => s.getCanvas(activeSceneId ?? ''));
  const zoom = useUIViewStore((s) => s.zoom);
  const setZoom = useUIViewStore((s) => s.setZoom);
  const resetView = useUIViewStore((s) => s.resetView);

  const handleAdd = (type: UIElementType) => {
    if (!activeSceneId) return;
    // Add as child of selected Panel, otherwise at root
    const parentId =
      selectedId && canvas.elements[selectedId]?.type === 'Panel' ? selectedId : null;
    addElement(activeSceneId, type, parentId);
  };

  return (
    <div
      className="flex items-center gap-1 px-2 shrink-0"
      style={{
        height: 36,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Add element buttons */}
      {ELEMENT_TYPES.map(({ type, label }) => (
        <button
          key={type}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
          style={{
            color: 'var(--text-muted)',
            background: 'transparent',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.color = 'var(--text)';
            (e.target as HTMLElement).style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.color = 'var(--text-muted)';
            (e.target as HTMLElement).style.borderColor = 'var(--border)';
          }}
          onClick={() => handleAdd(type)}
          disabled={!activeSceneId}
          title={`Add ${label}`}
        >
          <span>{ELEMENT_TYPE_ICONS[type]}</span>
          <span>{label}</span>
        </button>
      ))}

      <div className="flex-1" />

      {/* Canvas size */}
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {canvas.width} x {canvas.height}
      </span>

      <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

      {/* Zoom controls */}
      <button
        className="text-xs px-1.5 py-0.5 rounded"
        style={{
          color: 'var(--text-muted)',
          background: 'transparent',
          border: '1px solid var(--border)',
        }}
        onClick={() => setZoom(zoom - 0.1)}
        title="Zoom out"
      >
        -
      </button>
      <span
        className="text-xs w-12 text-center select-none"
        style={{ color: 'var(--text-muted)' }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        className="text-xs px-1.5 py-0.5 rounded"
        style={{
          color: 'var(--text-muted)',
          background: 'transparent',
          border: '1px solid var(--border)',
        }}
        onClick={() => setZoom(zoom + 0.1)}
        title="Zoom in"
      >
        +
      </button>
      <button
        className="text-xs px-2 py-0.5 rounded"
        style={{
          color: 'var(--text-muted)',
          background: 'transparent',
          border: '1px solid var(--border)',
        }}
        onClick={resetView}
        title="Reset view"
      >
        Fit
      </button>
    </div>
  );
}

// ── Main layout ─────────────────────────────────────

export function UIViewLayout() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <UIElementToolbar />
      <div className="flex flex-1 overflow-hidden">
        <UIHierarchy />
        <UICanvas />
        <UIInspector />
      </div>
    </div>
  );
}

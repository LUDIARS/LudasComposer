import { useCallback, useState } from 'react';
import { useUIViewStore } from '../uiViewStore';
import { useProjectStore } from '@/stores/projectStore';
import type { UIElement, UICanvasData, UIElementType } from '../types';
import { ELEMENT_TYPE_ICONS } from '../types';

// ── Hierarchy node (recursive) ──────────────────────

function HierarchyNode({
  elementId,
  canvas,
  sceneId,
  depth,
}: {
  elementId: string;
  canvas: UICanvasData;
  sceneId: string;
  depth: number;
}) {
  const element = canvas.elements[elementId];
  const selectedId = useUIViewStore((s) => s.selectedElementId);
  const selectElement = useUIViewStore((s) => s.selectElement);
  const toggleVisibility = useUIViewStore((s) => s.toggleVisibility);
  const removeElement = useUIViewStore((s) => s.removeElement);

  const [expanded, setExpanded] = useState(true);

  if (!element) return null;

  const isSelected = selectedId === elementId;
  const hasChildren = element.childIds.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 cursor-pointer group"
        style={{
          paddingLeft: depth * 16 + 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          backgroundColor: isSelected ? 'rgba(88, 166, 255, 0.15)' : undefined,
          borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
        }}
        onClick={() => selectElement(elementId)}
        onDoubleClick={() => {
          // Double click to toggle expand
          if (hasChildren) setExpanded(!expanded);
        }}
      >
        {/* Expand/collapse toggle */}
        <button
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-xs"
          style={{
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            padding: 0,
            visibility: hasChildren ? 'visible' : 'hidden',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? '\u25BC' : '\u25B6'}
        </button>

        {/* Type icon */}
        <span
          className="flex-shrink-0 w-4 text-center text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {ELEMENT_TYPE_ICONS[element.type]}
        </span>

        {/* Name */}
        <span
          className="flex-1 text-xs truncate"
          style={{
            color: element.visible ? 'var(--text)' : 'var(--text-muted)',
            textDecoration: element.visible ? undefined : 'line-through',
          }}
        >
          {element.name}
        </span>

        {/* Visibility toggle */}
        <button
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            color: element.visible ? 'var(--text-muted)' : 'var(--red)',
            background: 'none',
            border: 'none',
            padding: 0,
          }}
          onClick={(e) => {
            e.stopPropagation();
            toggleVisibility(sceneId, elementId);
          }}
          title={element.visible ? 'Hide' : 'Show'}
        >
          {element.visible ? '\u25C9' : '\u25CE'}
        </button>

        {/* Delete */}
        <button
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            padding: 0,
          }}
          onClick={(e) => {
            e.stopPropagation();
            removeElement(sceneId, elementId);
          }}
          title="Delete"
        >
          \u2715
        </button>
      </div>

      {/* Children */}
      {expanded &&
        element.childIds.map((childId) => (
          <HierarchyNode
            key={childId}
            elementId={childId}
            canvas={canvas}
            sceneId={sceneId}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

// ── Add element menu ────────────────────────────────

function AddElementButton({ sceneId, parentId }: { sceneId: string; parentId: string | null }) {
  const addElement = useUIViewStore((s) => s.addElement);
  const [menuOpen, setMenuOpen] = useState(false);

  const types: UIElementType[] = ['Panel', 'Text', 'Image', 'Button'];

  return (
    <div className="relative">
      <button
        className="w-full text-xs py-1.5 rounded transition-colors"
        style={{
          color: 'var(--accent)',
          background: 'none',
          border: '1px dashed var(--border)',
        }}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        + Add Element
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute left-0 right-0 z-50 rounded shadow-lg py-1"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              bottom: '100%',
              marginBottom: 4,
            }}
          >
            {types.map((type) => (
              <button
                key={type}
                className="w-full text-left text-xs px-3 py-1.5 transition-colors"
                style={{
                  color: 'var(--text)',
                  background: 'transparent',
                  border: 'none',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.background = 'var(--bg-surface-2)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.background = 'transparent';
                }}
                onClick={() => {
                  addElement(sceneId, type, parentId);
                  setMenuOpen(false);
                }}
              >
                <span className="mr-2">{ELEMENT_TYPE_ICONS[type]}</span>
                {type}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Hierarchy Panel ────────────────────────────

export function UIHierarchy() {
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const sceneId = activeSceneId ?? '';
  const canvas = useUIViewStore((s) => s.getCanvas(sceneId));
  const selectedId = useUIViewStore((s) => s.selectedElementId);
  const addElement = useUIViewStore((s) => s.addElement);

  const handleAddToSelected = useCallback(
    (type: UIElementType) => {
      if (!activeSceneId) return;
      // Add as child of selected element if it's a container type (Panel)
      const parentId =
        selectedId && canvas.elements[selectedId]?.type === 'Panel' ? selectedId : null;
      addElement(activeSceneId, type, parentId);
    },
    [activeSceneId, selectedId, canvas.elements, addElement],
  );

  if (!activeSceneId) {
    return (
      <div
        className="w-56 min-w-[224px] flex items-center justify-center"
        style={{
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: 12,
        }}
      >
        No scene
      </div>
    );
  }

  return (
    <div
      className="w-56 min-w-[224px] flex flex-col"
      style={{
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
          Hierarchy
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {Object.keys(canvas.elements).length}
        </span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {canvas.rootIds.length === 0 && (
          <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            No UI elements yet.
            <br />
            Add elements to start building your layout.
          </div>
        )}

        {canvas.rootIds.map((id) => (
          <HierarchyNode
            key={id}
            elementId={id}
            canvas={canvas}
            sceneId={activeSceneId}
            depth={0}
          />
        ))}
      </div>

      {/* Add element */}
      <div className="shrink-0 px-2 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        <AddElementButton sceneId={activeSceneId} parentId={null} />
      </div>
    </div>
  );
}

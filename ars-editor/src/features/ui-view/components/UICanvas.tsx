import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useUIViewStore } from '../uiViewStore';
import { useProjectStore } from '@/stores/projectStore';
import type { UIElement, UICanvasData, RectTransform, ResizeHandle, Vec2 } from '../types';
import { getAbsolutePosition } from '../types';

// ── Drag state (kept in ref for performance) ────────

type DragMode =
  | { type: 'move'; elementId: string; startX: number; startY: number; origX: number; origY: number }
  | { type: 'resize'; elementId: string; handle: ResizeHandle; startX: number; startY: number; origRect: RectTransform }
  | { type: 'pan'; startX: number; startY: number; origPanX: number; origPanY: number };

const MIN_SIZE = 20;

// ── Element rendering ───────────────────────────────

function renderElementVisual(element: UIElement) {
  const { type, props } = element;

  switch (type) {
    case 'Panel':
      return (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            backgroundColor: props.backgroundColor ?? 'rgba(30, 41, 59, 0.8)',
            borderRadius: props.borderRadius ?? 0,
            border: props.borderWidth
              ? `${props.borderWidth}px solid ${props.borderColor ?? 'rgba(255,255,255,0.2)'}`
              : undefined,
            opacity: props.opacity ?? 1,
          }}
        />
      );
    case 'Text':
      return (
        <div
          className="absolute inset-0 flex items-center px-1 overflow-hidden"
          style={{
            justifyContent:
              props.textAlign === 'left'
                ? 'flex-start'
                : props.textAlign === 'right'
                  ? 'flex-end'
                  : 'center',
            fontSize: props.fontSize ?? 16,
            color: props.fontColor ?? '#e6edf3',
            fontWeight: props.fontWeight ?? 'normal',
            opacity: props.opacity ?? 1,
          }}
        >
          <span className="whitespace-pre-wrap leading-tight">{props.text ?? 'Text'}</span>
        </div>
      );
    case 'Image':
      return (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{
            backgroundColor: props.backgroundColor ?? 'rgba(100, 116, 139, 0.3)',
            borderRadius: props.borderRadius ?? 0,
            opacity: props.opacity ?? 1,
          }}
        >
          {props.imageUrl ? (
            <img
              src={props.imageUrl}
              alt=""
              className="max-w-full max-h-full"
              style={{ objectFit: props.imageFit ?? 'contain' }}
            />
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </div>
      );
    case 'Button':
      return (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden cursor-pointer"
          style={{
            backgroundColor: props.buttonColor ?? '#3b82f6',
            borderRadius: props.borderRadius ?? 6,
            color: props.textColor ?? '#ffffff',
            fontSize: props.fontSize ?? 14,
            fontWeight: 'bold',
            opacity: props.opacity ?? 1,
          }}
        >
          {props.label ?? 'Button'}
        </div>
      );
    case 'Custom': {
      const borderCol = props.borderColor ?? 'var(--purple)';
      return (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            backgroundColor: props.backgroundColor ?? 'transparent',
            border: `2px dashed ${borderCol}`,
            borderRadius: props.borderRadius ?? 0,
            opacity: props.opacity ?? 1,
          }}
        >
          {/* Type name badge (top-left) */}
          <div
            className="absolute flex items-center gap-1 px-1.5 py-0.5"
            style={{
              top: 0,
              left: 0,
              background: borderCol,
              color: '#fff',
              fontSize: 10,
              fontWeight: 'bold',
              lineHeight: 1,
              borderBottomRightRadius: 4,
              maxWidth: '100%',
            }}
          >
            <span style={{ fontSize: 8 }}>{'\u2726'}</span>
            <span className="truncate">{props.typeName || element.name}</span>
          </div>
          {/* Center label showing instance name */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ color: borderCol, fontSize: 12, opacity: 0.6 }}
          >
            {element.name}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

// ── Resize handles ──────────────────────────────────

const HANDLE_POSITIONS: { handle: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
  { handle: 'nw', style: { top: -4, left: -4 }, cursor: 'nwse-resize' },
  { handle: 'n', style: { top: -4, left: '50%', marginLeft: -4 }, cursor: 'ns-resize' },
  { handle: 'ne', style: { top: -4, right: -4 }, cursor: 'nesw-resize' },
  { handle: 'e', style: { top: '50%', right: -4, marginTop: -4 }, cursor: 'ew-resize' },
  { handle: 'se', style: { bottom: -4, right: -4 }, cursor: 'nwse-resize' },
  { handle: 's', style: { bottom: -4, left: '50%', marginLeft: -4 }, cursor: 'ns-resize' },
  { handle: 'sw', style: { bottom: -4, left: -4 }, cursor: 'nesw-resize' },
  { handle: 'w', style: { top: '50%', left: -4, marginTop: -4 }, cursor: 'ew-resize' },
];

// ── Canvas Element (recursive) ──────────────────────

const CanvasElement = memo(function CanvasElement({
  element,
  canvas,
  onStartDrag,
}: {
  element: UIElement;
  canvas: UICanvasData;
  onStartDrag: (elementId: string, e: React.MouseEvent) => void;
}) {
  const selectedId = useUIViewStore((s) => s.selectedElementId);
  const hoveredId = useUIViewStore((s) => s.hoveredElementId);
  const selectElement = useUIViewStore((s) => s.selectElement);
  const setHovered = useUIViewStore((s) => s.setHovered);

  const isSelected = selectedId === element.id;
  const isHovered = hoveredId === element.id;

  if (!element.visible) return null;

  return (
    <div
      data-ui-element={element.id}
      style={{
        position: 'absolute',
        left: element.rect.x,
        top: element.rect.y,
        width: element.rect.width,
        height: element.rect.height,
        transform: element.rect.rotation ? `rotate(${element.rect.rotation}deg)` : undefined,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        selectElement(element.id);
        onStartDrag(element.id, e);
      }}
      onMouseEnter={() => setHovered(element.id)}
      onMouseLeave={() => setHovered(null)}
    >
      {renderElementVisual(element)}

      {/* Hover outline */}
      {isHovered && !isSelected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ border: '1px solid var(--accent)', opacity: 0.5 }}
        />
      )}

      {/* Children */}
      {element.childIds.map((childId) => {
        const child = canvas.elements[childId];
        if (!child) return null;
        return (
          <CanvasElement
            key={childId}
            element={child}
            canvas={canvas}
            onStartDrag={onStartDrag}
          />
        );
      })}
    </div>
  );
});

// ── Selection overlay ───────────────────────────────

function SelectionOverlay({
  elementId,
  canvas,
  zoom,
  panOffset,
  onStartResize,
}: {
  elementId: string;
  canvas: UICanvasData;
  zoom: number;
  panOffset: Vec2;
  onStartResize: (elementId: string, handle: ResizeHandle, e: React.MouseEvent) => void;
}) {
  const element = canvas.elements[elementId];
  if (!element) return null;

  const abs = getAbsolutePosition(elementId, canvas.elements);
  const x = abs.x * zoom + panOffset.x;
  const y = abs.y * zoom + panOffset.y;
  const w = element.rect.width * zoom;
  const h = element.rect.height * zoom;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        border: '2px solid var(--accent)',
        zIndex: 999,
      }}
    >
      {/* Element name label */}
      <div
        className="absolute text-xs px-1 whitespace-nowrap pointer-events-none"
        style={{
          top: -20,
          left: 0,
          color: 'var(--accent)',
          fontSize: 11,
        }}
      >
        {element.name}
      </div>

      {/* Resize handles */}
      {HANDLE_POSITIONS.map(({ handle, style, cursor }) => (
        <div
          key={handle}
          className="absolute pointer-events-auto"
          style={{
            ...style,
            width: 8,
            height: 8,
            backgroundColor: 'var(--accent)',
            border: '1px solid var(--bg)',
            cursor,
            zIndex: 1000,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onStartResize(elementId, handle, e);
          }}
        />
      ))}

      {/* Size label */}
      <div
        className="absolute text-xs px-1 whitespace-nowrap pointer-events-none"
        style={{
          bottom: -18,
          right: 0,
          color: 'var(--text-muted)',
          fontSize: 10,
        }}
      >
        {Math.round(element.rect.width)} x {Math.round(element.rect.height)}
      </div>
    </div>
  );
}

// ── Main Canvas ─────────────────────────────────────

export function UICanvas() {
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const sceneId = activeSceneId ?? '';

  const canvas = useUIViewStore((s) => s.getCanvas(sceneId));
  const selectedId = useUIViewStore((s) => s.selectedElementId);
  const zoom = useUIViewStore((s) => s.zoom);
  const panOffset = useUIViewStore((s) => s.panOffset);
  const selectElement = useUIViewStore((s) => s.selectElement);
  const updateRect = useUIViewStore((s) => s.updateRect);
  const setZoom = useUIViewStore((s) => s.setZoom);
  const setPan = useUIViewStore((s) => s.setPan);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(panOffset);

  // Refs for store actions (stable across renders)
  const updateRectRef = useRef(updateRect);
  const setPanRef = useRef(setPan);

  const sceneIdRef = useRef(sceneId);
  const canvasRef = useRef(canvas);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = panOffset; }, [panOffset]);
  useEffect(() => { updateRectRef.current = updateRect; }, [updateRect]);
  useEffect(() => { setPanRef.current = setPan; }, [setPan]);
  useEffect(() => { sceneIdRef.current = sceneId; }, [sceneId]);
  useEffect(() => { canvasRef.current = canvas; }, [canvas]);

  // ── Fit canvas to viewport on mount ────────────
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !viewportRef.current) return;
    initializedRef.current = true;
    const vp = viewportRef.current.getBoundingClientRect();
    const fitZoom = Math.min(
      (vp.width - 80) / canvas.width,
      (vp.height - 80) / canvas.height,
      1,
    );
    const z = Math.max(0.1, fitZoom);
    setZoom(z);
    setPan({
      x: (vp.width - canvas.width * z) / 2,
      y: (vp.height - canvas.height * z) / 2,
    });
  }, [canvas.width, canvas.height, setZoom, setPan]);

  // ── Mouse drag handlers ────────────────────────

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const z = zoomRef.current;

      if (drag.type === 'move') {
        const dx = (e.clientX - drag.startX) / z;
        const dy = (e.clientY - drag.startY) / z;
        updateRectRef.current(sceneIdRef.current, drag.elementId, {
          x: Math.round(drag.origX + dx),
          y: Math.round(drag.origY + dy),
        });
      } else if (drag.type === 'resize') {
        const dx = (e.clientX - drag.startX) / z;
        const dy = (e.clientY - drag.startY) / z;
        const r = drag.origRect;
        const updates: Partial<RectTransform> = {};

        const h = drag.handle;
        if (h.includes('w')) {
          const newW = Math.max(MIN_SIZE, r.width - dx);
          updates.x = r.x + (r.width - newW);
          updates.width = newW;
        }
        if (h.includes('e')) {
          updates.width = Math.max(MIN_SIZE, r.width + dx);
        }
        if (h.includes('n')) {
          const newH = Math.max(MIN_SIZE, r.height - dy);
          updates.y = r.y + (r.height - newH);
          updates.height = newH;
        }
        if (h.includes('s')) {
          updates.height = Math.max(MIN_SIZE, r.height + dy);
        }

        // Round values
        for (const k of Object.keys(updates) as (keyof typeof updates)[]) {
          (updates as Record<string, number>)[k] = Math.round(updates[k] as number);
        }

        updateRectRef.current(sceneIdRef.current, drag.elementId, updates);
      } else if (drag.type === 'pan') {
        setPanRef.current({
          x: drag.origPanX + (e.clientX - drag.startX),
          y: drag.origPanY + (e.clientY - drag.startY),
        });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      setIsDraggingPan(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ── Zoom with wheel ────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = -e.deltaY * 0.001;
      const newZoom = Math.max(0.1, Math.min(3, zoom + delta));
      const scale = newZoom / zoom;

      setPan({
        x: mouseX - (mouseX - panOffset.x) * scale,
        y: mouseY - (mouseY - panOffset.y) * scale,
      });
      setZoom(newZoom);
    },
    [zoom, panOffset, setZoom, setPan],
  );

  // ── Start element move drag ────────────────────

  const handleStartDrag = useCallback(
    (elementId: string, e: React.MouseEvent) => {
      const el = canvas.elements[elementId];
      if (!el) return;
      dragRef.current = {
        type: 'move',
        elementId,
        startX: e.clientX,
        startY: e.clientY,
        origX: el.rect.x,
        origY: el.rect.y,
      };
      document.body.style.cursor = 'move';
      document.body.style.userSelect = 'none';
    },
    [canvas.elements],
  );

  // ── Start resize drag ─────────────────────────

  const handleStartResize = useCallback(
    (elementId: string, handle: ResizeHandle, e: React.MouseEvent) => {
      const el = canvas.elements[elementId];
      if (!el) return;
      dragRef.current = {
        type: 'resize',
        elementId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origRect: { ...el.rect },
      };
      document.body.style.userSelect = 'none';
    },
    [canvas.elements],
  );

  // ── Background click: deselect or pan ──────────

  const handleViewportMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left/middle clicks on the viewport itself
      if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasBg) return;

      if (e.button === 1 || e.button === 0) {
        // Left click on background → deselect + start pan
        if (e.button === 0) selectElement(null);

        dragRef.current = {
          type: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          origPanX: panOffset.x,
          origPanY: panOffset.y,
        };
        setIsDraggingPan(true);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
    },
    [selectElement, panOffset],
  );

  // ── Delete key ─────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        const sel = useUIViewStore.getState().selectedElementId;
        if (sel) {
          useUIViewStore.getState().removeElement(sceneIdRef.current, sel);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!activeSceneId) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: 'var(--text-muted)' }}
      >
        Select a scene to edit UI layout
      </div>
    );
  }

  // Grid line spacing (in canvas pixels)
  const gridSize = 50;
  const gridColor = 'rgba(255,255,255,0.04)';

  return (
    <div
      ref={viewportRef}
      className="flex-1 overflow-hidden relative"
      style={{ background: '#0a0a12', cursor: isDraggingPan ? 'grabbing' : 'default' }}
      onWheel={handleWheel}
      onMouseDown={handleViewportMouseDown}
    >
      {/* Transformed canvas layer */}
      <div
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          width: canvas.width,
          height: canvas.height,
        }}
      >
        {/* Canvas background with grid */}
        <div
          data-canvas-bg="true"
          style={{
            width: canvas.width,
            height: canvas.height,
            backgroundColor: '#1a1a2e',
            backgroundImage: `
              linear-gradient(${gridColor} 1px, transparent 1px),
              linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            position: 'relative',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            selectElement(null);
            dragRef.current = {
              type: 'pan',
              startX: e.clientX,
              startY: e.clientY,
              origPanX: panOffset.x,
              origPanY: panOffset.y,
            };
            setIsDraggingPan(true);
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
          }}
        >
          {/* Canvas size label */}
          <div
            className="absolute pointer-events-none select-none"
            style={{
              top: -24,
              left: 0,
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            {canvas.width} x {canvas.height}
          </div>

          {/* Root elements */}
          {canvas.rootIds.map((id) => {
            const el = canvas.elements[id];
            if (!el) return null;
            return (
              <CanvasElement
                key={id}
                element={el}
                canvas={canvas}
                onStartDrag={handleStartDrag}
              />
            );
          })}
        </div>
      </div>

      {/* Selection overlay (screen space) */}
      {selectedId && canvas.elements[selectedId] && (
        <SelectionOverlay
          elementId={selectedId}
          canvas={canvas}
          zoom={zoom}
          panOffset={panOffset}
          onStartResize={handleStartResize}
        />
      )}

      {/* Zoom indicator */}
      <div
        className="absolute bottom-3 right-3 text-xs px-2 py-1 rounded select-none"
        style={{
          color: 'var(--text-muted)',
          background: 'rgba(0,0,0,0.5)',
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

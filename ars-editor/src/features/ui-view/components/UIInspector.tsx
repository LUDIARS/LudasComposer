import { useCallback } from 'react';
import { useUIViewStore } from '../uiViewStore';
import { useProjectStore } from '@/stores/projectStore';
import type { UIElement, UIElementType, UIElementProps, RectTransform, Vec2 } from '../types';
import { ELEMENT_TYPE_ICONS } from '../types';

// ── Shared input components ─────────────────────────

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs w-6 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        className="flex-1 text-xs px-2 py-1 rounded min-w-0"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          outline: 'none',
        }}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <Tag
        value={value}
        className="text-xs px-2 py-1 rounded"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          outline: 'none',
          resize: multiline ? 'vertical' : undefined,
          minHeight: multiline ? 60 : undefined,
          fontFamily: 'inherit',
        }}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={value.startsWith('#') ? value : '#ffffff'}
          className="w-6 h-6 rounded cursor-pointer"
          style={{ background: 'none', border: '1px solid var(--border)', padding: 0 }}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          value={value}
          className="text-xs px-1 py-0.5 rounded w-24"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <select
        value={value}
        className="text-xs px-2 py-1 rounded"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          outline: 'none',
        }}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <h4
        className="text-xs font-semibold mb-2"
        style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        {title}
      </h4>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

// ── Anchor presets ──────────────────────────────────

const ANCHOR_PRESETS: {
  label: string;
  min: Vec2;
  max: Vec2;
}[] = [
  { label: 'Center', min: { x: 0.5, y: 0.5 }, max: { x: 0.5, y: 0.5 } },
  { label: 'Top-Left', min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
  { label: 'Top', min: { x: 0.5, y: 0 }, max: { x: 0.5, y: 0 } },
  { label: 'Top-Right', min: { x: 1, y: 0 }, max: { x: 1, y: 0 } },
  { label: 'Left', min: { x: 0, y: 0.5 }, max: { x: 0, y: 0.5 } },
  { label: 'Right', min: { x: 1, y: 0.5 }, max: { x: 1, y: 0.5 } },
  { label: 'Bottom-Left', min: { x: 0, y: 1 }, max: { x: 0, y: 1 } },
  { label: 'Bottom', min: { x: 0.5, y: 1 }, max: { x: 0.5, y: 1 } },
  { label: 'Bottom-Right', min: { x: 1, y: 1 }, max: { x: 1, y: 1 } },
  { label: 'Stretch H', min: { x: 0, y: 0.5 }, max: { x: 1, y: 0.5 } },
  { label: 'Stretch V', min: { x: 0.5, y: 0 }, max: { x: 0.5, y: 1 } },
  { label: 'Stretch All', min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
];

// ── Type-specific property editors ──────────────────

function PanelProps({
  element,
  sceneId,
}: {
  element: UIElement;
  sceneId: string;
}) {
  const updateProps = useUIViewStore((s) => s.updateProps);
  const update = useCallback(
    (p: Partial<UIElementProps>) => updateProps(sceneId, element.id, p),
    [sceneId, element.id, updateProps],
  );

  return (
    <Section title="Panel">
      <ColorInput
        label="Background"
        value={element.props.backgroundColor ?? 'rgba(30,41,59,0.8)'}
        onChange={(v) => update({ backgroundColor: v })}
      />
      <NumberInput
        label="R"
        value={element.props.borderRadius ?? 0}
        onChange={(v) => update({ borderRadius: v })}
        min={0}
      />
      <ColorInput
        label="Border"
        value={element.props.borderColor ?? 'rgba(255,255,255,0.2)'}
        onChange={(v) => update({ borderColor: v })}
      />
      <NumberInput
        label="BW"
        value={element.props.borderWidth ?? 0}
        onChange={(v) => update({ borderWidth: v })}
        min={0}
      />
    </Section>
  );
}

function TextProps({
  element,
  sceneId,
}: {
  element: UIElement;
  sceneId: string;
}) {
  const updateProps = useUIViewStore((s) => s.updateProps);
  const update = useCallback(
    (p: Partial<UIElementProps>) => updateProps(sceneId, element.id, p),
    [sceneId, element.id, updateProps],
  );

  return (
    <Section title="Text">
      <TextInput
        label="Content"
        value={element.props.text ?? ''}
        onChange={(v) => update({ text: v })}
        multiline
      />
      <NumberInput
        label="Size"
        value={element.props.fontSize ?? 16}
        onChange={(v) => update({ fontSize: v })}
        min={1}
      />
      <ColorInput
        label="Color"
        value={element.props.fontColor ?? '#e6edf3'}
        onChange={(v) => update({ fontColor: v })}
      />
      <SelectInput
        label="Align"
        value={element.props.textAlign ?? 'center'}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(v) => update({ textAlign: v as 'left' | 'center' | 'right' })}
      />
      <SelectInput
        label="Weight"
        value={element.props.fontWeight ?? 'normal'}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'bold', label: 'Bold' },
        ]}
        onChange={(v) => update({ fontWeight: v as 'normal' | 'bold' })}
      />
    </Section>
  );
}

function ImageProps({
  element,
  sceneId,
}: {
  element: UIElement;
  sceneId: string;
}) {
  const updateProps = useUIViewStore((s) => s.updateProps);
  const update = useCallback(
    (p: Partial<UIElementProps>) => updateProps(sceneId, element.id, p),
    [sceneId, element.id, updateProps],
  );

  return (
    <Section title="Image">
      <TextInput
        label="URL"
        value={element.props.imageUrl ?? ''}
        onChange={(v) => update({ imageUrl: v })}
      />
      <ColorInput
        label="Background"
        value={element.props.backgroundColor ?? 'rgba(100,116,139,0.3)'}
        onChange={(v) => update({ backgroundColor: v })}
      />
      <SelectInput
        label="Fit"
        value={element.props.imageFit ?? 'contain'}
        options={[
          { value: 'contain', label: 'Contain' },
          { value: 'cover', label: 'Cover' },
          { value: 'fill', label: 'Fill' },
        ]}
        onChange={(v) => update({ imageFit: v as 'contain' | 'cover' | 'fill' })}
      />
    </Section>
  );
}

function ButtonProps({
  element,
  sceneId,
}: {
  element: UIElement;
  sceneId: string;
}) {
  const updateProps = useUIViewStore((s) => s.updateProps);
  const update = useCallback(
    (p: Partial<UIElementProps>) => updateProps(sceneId, element.id, p),
    [sceneId, element.id, updateProps],
  );

  return (
    <Section title="Button">
      <TextInput
        label="Label"
        value={element.props.label ?? 'Button'}
        onChange={(v) => update({ label: v })}
      />
      <ColorInput
        label="Color"
        value={element.props.buttonColor ?? '#3b82f6'}
        onChange={(v) => update({ buttonColor: v })}
      />
      <ColorInput
        label="Text"
        value={element.props.textColor ?? '#ffffff'}
        onChange={(v) => update({ textColor: v })}
      />
      <NumberInput
        label="Size"
        value={element.props.fontSize ?? 14}
        onChange={(v) => update({ fontSize: v })}
        min={1}
      />
      <NumberInput
        label="R"
        value={element.props.borderRadius ?? 6}
        onChange={(v) => update({ borderRadius: v })}
        min={0}
      />
    </Section>
  );
}

// ── Main Inspector Panel ────────────────────────────

export function UIInspector() {
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const sceneId = activeSceneId ?? '';
  const canvas = useUIViewStore((s) => s.getCanvas(sceneId));
  const selectedId = useUIViewStore((s) => s.selectedElementId);
  const updateRect = useUIViewStore((s) => s.updateRect);
  const renameElement = useUIViewStore((s) => s.renameElement);
  const removeElement = useUIViewStore((s) => s.removeElement);
  const addElement = useUIViewStore((s) => s.addElement);

  const element = selectedId ? canvas.elements[selectedId] : null;

  if (!activeSceneId || !element) {
    return (
      <div
        className="w-64 min-w-[256px] flex items-center justify-center"
        style={{
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: 12,
        }}
      >
        {activeSceneId ? 'Select an element to inspect' : 'No scene'}
      </div>
    );
  }

  const handleRectChange = (updates: Partial<RectTransform>) => {
    updateRect(sceneId, element.id, updates);
  };

  return (
    <div
      className="w-64 min-w-[256px] flex flex-col overflow-y-auto"
      style={{
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {ELEMENT_TYPE_ICONS[element.type]}
          </span>
          <input
            type="text"
            value={element.name}
            className="flex-1 text-xs font-semibold px-1 py-0.5 rounded min-w-0"
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--text)',
              outline: 'none',
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'var(--accent)';
              (e.target as HTMLInputElement).style.background = 'var(--bg)';
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'transparent';
              (e.target as HTMLInputElement).style.background = 'transparent';
            }}
            onChange={(e) => renameElement(sceneId, element.id, e.target.value)}
          />
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {element.type}
        </div>
      </div>

      {/* Transform */}
      <Section title="Rect Transform">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={element.rect.x} onChange={(v) => handleRectChange({ x: v })} />
          <NumberInput label="Y" value={element.rect.y} onChange={(v) => handleRectChange({ y: v })} />
          <NumberInput
            label="W"
            value={element.rect.width}
            onChange={(v) => handleRectChange({ width: v })}
            min={20}
          />
          <NumberInput
            label="H"
            value={element.rect.height}
            onChange={(v) => handleRectChange({ height: v })}
            min={20}
          />
        </div>
        <NumberInput
          label="Rot"
          value={element.rect.rotation}
          onChange={(v) => handleRectChange({ rotation: v })}
          step={1}
        />
      </Section>

      {/* Anchors */}
      <Section title="Anchors">
        <div className="flex flex-wrap gap-1">
          {ANCHOR_PRESETS.map((preset) => {
            const isActive =
              element.rect.anchorMin.x === preset.min.x &&
              element.rect.anchorMin.y === preset.min.y &&
              element.rect.anchorMax.x === preset.max.x &&
              element.rect.anchorMax.y === preset.max.y;
            return (
              <button
                key={preset.label}
                className="text-xs px-1.5 py-0.5 rounded transition-colors"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--bg)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  fontSize: 10,
                }}
                onClick={() =>
                  handleRectChange({
                    anchorMin: { ...preset.min },
                    anchorMax: { ...preset.max },
                  })
                }
                title={preset.label}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <NumberInput
            label="Px"
            value={element.rect.pivot.x}
            onChange={(v) => handleRectChange({ pivot: { ...element.rect.pivot, x: v } })}
            step={0.1}
            min={0}
            max={1}
          />
          <NumberInput
            label="Py"
            value={element.rect.pivot.y}
            onChange={(v) => handleRectChange({ pivot: { ...element.rect.pivot, y: v } })}
            step={0.1}
            min={0}
            max={1}
          />
        </div>
      </Section>

      {/* Common appearance */}
      <Section title="Appearance">
        <NumberInput
          label="Op"
          value={element.props.opacity ?? 1}
          onChange={(v) =>
            useUIViewStore.getState().updateProps(sceneId, element.id, { opacity: v })
          }
          step={0.1}
          min={0}
          max={1}
        />
      </Section>

      {/* Type-specific properties */}
      {element.type === 'Panel' && <PanelProps element={element} sceneId={sceneId} />}
      {element.type === 'Text' && <TextProps element={element} sceneId={sceneId} />}
      {element.type === 'Image' && <ImageProps element={element} sceneId={sceneId} />}
      {element.type === 'Button' && <ButtonProps element={element} sceneId={sceneId} />}

      {/* Actions */}
      <div className="px-3 py-3 flex flex-col gap-2">
        {element.type === 'Panel' && (
          <button
            className="w-full text-xs py-1.5 rounded transition-colors"
            style={{
              color: 'var(--accent)',
              background: 'none',
              border: '1px dashed var(--accent)',
            }}
            onClick={() => addElement(sceneId, 'Panel', element.id)}
          >
            + Add Child
          </button>
        )}
        <button
          className="w-full text-xs py-1.5 rounded transition-colors"
          style={{
            color: 'var(--red)',
            background: 'none',
            border: '1px solid var(--red)',
          }}
          onClick={() => removeElement(sceneId, element.id)}
        >
          Delete Element
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useDataStore } from '../dataStore';
import type { DataField, DataFieldType, FieldConstraint } from '../types';
import { FIELD_TYPE_OPTIONS, createDefaultField } from '../types';

// ── Field Row ──────────────────────────────────────

function FieldRow({
  field,
  index,
  schemas,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  field: DataField;
  index: number;
  schemas: Record<string, { id: string; name: string }>;
  onUpdate: (index: number, field: DataField) => void;
  onRemove: (index: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRequired = field.constraints.some((c) => c.type === 'required');

  const handleTypeChange = (kind: DataFieldType['kind']) => {
    let fieldType: DataFieldType;
    switch (kind) {
      case 'enum':
        fieldType = { kind: 'enum', variants: ['option1', 'option2'] };
        break;
      case 'reference':
        fieldType = { kind: 'reference', schemaId: '' };
        break;
      default:
        fieldType = { kind } as DataFieldType;
    }
    onUpdate(index, { ...field, fieldType, defaultValue: undefined });
  };

  const toggleRequired = () => {
    const constraints: FieldConstraint[] = isRequired
      ? field.constraints.filter((c) => c.type !== 'required')
      : [...field.constraints, { type: 'required' }];
    onUpdate(index, { ...field, constraints });
  };

  return (
    <div
      className="group"
      style={{
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Compact row */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        {/* Move buttons */}
        <div className="flex flex-col gap-0">
          <button
            className="text-xs leading-none"
            style={{ color: isFirst ? 'transparent' : 'var(--text-muted)', background: 'none', border: 'none', padding: 0 }}
            onClick={onMoveUp}
            disabled={isFirst}
          >
            {'\u25B2'}
          </button>
          <button
            className="text-xs leading-none"
            style={{ color: isLast ? 'transparent' : 'var(--text-muted)', background: 'none', border: 'none', padding: 0 }}
            onClick={onMoveDown}
            disabled={isLast}
          >
            {'\u25BC'}
          </button>
        </div>

        {/* Name */}
        <input
          type="text"
          value={field.name}
          className="flex-1 text-xs px-1.5 py-0.5 rounded min-w-0"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
          placeholder="field_name"
          onChange={(e) => onUpdate(index, { ...field, name: e.target.value })}
        />

        {/* Type select */}
        <select
          value={field.fieldType.kind}
          className="text-xs px-1 py-0.5 rounded"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
            width: 80,
          }}
          onChange={(e) => handleTypeChange(e.target.value as DataFieldType['kind'])}
        >
          {FIELD_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Required toggle */}
        <button
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            background: isRequired ? 'var(--accent)' : 'transparent',
            color: isRequired ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${isRequired ? 'var(--accent)' : 'var(--border)'}`,
            fontSize: 10,
          }}
          onClick={toggleRequired}
          title="Required"
        >
          Req
        </button>

        {/* Expand */}
        <button
          className="text-xs px-1 py-0.5"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none' }}
          onClick={() => setExpanded(!expanded)}
          title="Details"
        >
          {expanded ? '\u25B4' : '\u25BE'}
        </button>

        {/* Delete */}
        <button
          className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--red)', background: 'none', border: 'none', padding: '0 2px' }}
          onClick={() => onRemove(index)}
          title="Remove field"
        >
          {'\u2715'}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2 flex flex-col gap-1.5" style={{ paddingLeft: 32 }}>
          {/* Description */}
          <div className="flex items-center gap-1">
            <label className="text-xs w-12" style={{ color: 'var(--text-muted)' }}>Desc</label>
            <input
              type="text"
              value={field.description}
              className="flex-1 text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                outline: 'none',
              }}
              onChange={(e) => onUpdate(index, { ...field, description: e.target.value })}
            />
          </div>

          {/* Enum variants */}
          {field.fieldType.kind === 'enum' && (
            <div className="flex items-start gap-1">
              <label className="text-xs w-12 pt-0.5" style={{ color: 'var(--text-muted)' }}>Vals</label>
              <input
                type="text"
                value={field.fieldType.variants.join(', ')}
                className="flex-1 text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
                placeholder="value1, value2, value3"
                onChange={(e) => {
                  const variants = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
                  onUpdate(index, { ...field, fieldType: { kind: 'enum', variants } });
                }}
              />
            </div>
          )}

          {/* Reference schema */}
          {field.fieldType.kind === 'reference' && (
            <div className="flex items-center gap-1">
              <label className="text-xs w-12" style={{ color: 'var(--text-muted)' }}>Ref</label>
              <select
                value={field.fieldType.schemaId}
                className="flex-1 text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
                onChange={(e) => {
                  onUpdate(index, {
                    ...field,
                    fieldType: { kind: 'reference', schemaId: e.target.value },
                  });
                }}
              >
                <option value="">-- select schema --</option>
                {Object.values(schemas).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Default value */}
          <div className="flex items-center gap-1">
            <label className="text-xs w-12" style={{ color: 'var(--text-muted)' }}>Def</label>
            <input
              type="text"
              value={field.defaultValue != null ? String(field.defaultValue) : ''}
              className="flex-1 text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                outline: 'none',
              }}
              placeholder="Default value"
              onChange={(e) => {
                const raw = e.target.value;
                let val: unknown = raw;
                if (field.fieldType.kind === 'int') val = parseInt(raw, 10) || 0;
                else if (field.fieldType.kind === 'float') val = parseFloat(raw) || 0;
                else if (field.fieldType.kind === 'bool') val = raw === 'true';
                onUpdate(index, { ...field, defaultValue: val });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Schema Editor ─────────────────────────────

export function SchemaEditor() {
  const schemas = useDataStore((s) => s.schemas);
  const selectedId = useDataStore((s) => s.selectedSchemaId);
  const updateSchema = useDataStore((s) => s.updateSchema);
  const addField = useDataStore((s) => s.addField);
  const updateField = useDataStore((s) => s.updateField);
  const removeField = useDataStore((s) => s.removeField);
  const moveField = useDataStore((s) => s.moveField);

  const schema = selectedId ? schemas[selectedId] : null;

  if (!schema) {
    return (
      <div
        className="w-72 min-w-[288px] flex items-center justify-center"
        style={{
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: 12,
        }}
      >
        Select a schema to edit
      </div>
    );
  }

  return (
    <div
      className="w-72 min-w-[288px] flex flex-col overflow-hidden"
      style={{
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <input
          type="text"
          value={schema.name}
          className="text-sm font-semibold px-1 py-0.5 rounded w-full"
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
          onChange={(e) => updateSchema(schema.id, { name: e.target.value })}
        />
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: schema.category === 'master' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)',
              color: schema.category === 'master' ? '#60a5fa' : '#c084fc',
              fontSize: 10,
            }}
          >
            {schema.category === 'master' ? 'MASTER' : 'USER'}
          </span>
          <input
            type="text"
            value={schema.description}
            className="flex-1 text-xs px-1.5 py-0.5 rounded"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
            }}
            placeholder="Description..."
            onChange={(e) => updateSchema(schema.id, { description: e.target.value })}
          />
        </div>
      </div>

      {/* Fields header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Fields ({schema.fields.length})
        </span>
      </div>

      {/* Field list */}
      <div className="flex-1 overflow-y-auto">
        {schema.fields.length === 0 && (
          <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            No fields defined.
            <br />
            Add fields to define the data structure.
          </div>
        )}
        {schema.fields.map((field, index) => (
          <FieldRow
            key={index}
            field={field}
            index={index}
            schemas={schemas}
            onUpdate={updateField.bind(null, schema.id)}
            onRemove={removeField.bind(null, schema.id)}
            onMoveUp={() => { if (index > 0) moveField(schema.id, index, index - 1); }}
            onMoveDown={() => { if (index < schema.fields.length - 1) moveField(schema.id, index, index + 1); }}
            isFirst={index === 0}
            isLast={index === schema.fields.length - 1}
          />
        ))}
      </div>

      {/* Add field button */}
      <div className="shrink-0 px-2 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          className="w-full text-xs py-1.5 rounded transition-colors"
          style={{
            color: 'var(--accent)',
            background: 'none',
            border: '1px dashed var(--border)',
          }}
          onClick={() => {
            const name = `field_${schema.fields.length + 1}`;
            addField(schema.id, createDefaultField(name));
          }}
        >
          + Add Field
        </button>
      </div>
    </div>
  );
}

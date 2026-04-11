import { useState } from 'react';
import { useDataStore } from '../dataStore';
import type { DataCategory, DataField, DataFieldType } from '../types';
import { createDefaultField, FIELD_TYPE_OPTIONS } from '../types';

export function SchemaList() {
  const schemas = useDataStore((s) => s.schemas);
  const selectedId = useDataStore((s) => s.selectedSchemaId);
  const selectSchema = useDataStore((s) => s.selectSchema);
  const addSchema = useDataStore((s) => s.addSchema);
  const addField = useDataStore((s) => s.addField);
  const deleteSchema = useDataStore((s) => s.deleteSchema);
  const ensureTable = useDataStore((s) => s.ensureTable);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<DataCategory>('master');
  const [showAdd, setShowAdd] = useState(false);
  const [pendingFields, setPendingFields] = useState<DataField[]>([createDefaultField()]);

  const schemaList = Object.values(schemas);
  const masterSchemas = schemaList.filter((s) => s.category === 'master');
  const userSchemas = schemaList.filter((s) => s.category === 'user');

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = addSchema(name, newCategory);
    // フィールドを追加
    for (const f of pendingFields) {
      if (f.name.trim()) {
        addField(id, { ...f, name: f.name.trim() });
      }
    }
    if (newCategory === 'master') {
      ensureTable(id);
    }
    selectSchema(id);
    setNewName('');
    setPendingFields([createDefaultField()]);
    setShowAdd(false);
  };

  const updatePendingField = (index: number, updates: Partial<DataField>) => {
    setPendingFields((prev) => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const updatePendingFieldType = (index: number, kind: DataFieldType['kind']) => {
    const ft: DataFieldType = kind === 'enum'
      ? { kind: 'enum', variants: [] }
      : kind === 'reference'
        ? { kind: 'reference', schemaId: '' }
        : { kind } as DataFieldType;
    updatePendingField(index, { fieldType: ft });
  };

  const removePendingField = (index: number) => {
    setPendingFields((prev) => prev.filter((_, i) => i !== index));
  };

  const addPendingField = () => {
    setPendingFields((prev) => [...prev, createDefaultField()]);
  };

  const handleSelect = (id: string) => {
    selectSchema(id);
    const schema = schemas[id];
    if (schema?.category === 'master') {
      ensureTable(id);
    }
  };

  const renderSection = (title: string, items: typeof schemaList) => (
    <div className="mb-2">
      <div
        className="text-xs font-semibold px-3 py-1"
        style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        {title} ({items.length})
      </div>
      {items.length === 0 && (
        <div className="px-3 py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          No schemas yet
        </div>
      )}
      {items.map((schema) => {
        const isSelected = selectedId === schema.id;
        return (
          <div
            key={schema.id}
            className="flex items-center gap-1 cursor-pointer group px-3 py-1.5"
            style={{
              backgroundColor: isSelected ? 'rgba(88, 166, 255, 0.15)' : undefined,
              borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
            }}
            onClick={() => handleSelect(schema.id)}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {schema.category === 'master' ? '\u25A6' : '\u25C7'}
            </span>
            <span className="flex-1 text-xs truncate" style={{ color: 'var(--text)' }}>
              {schema.name}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {schema.fields.length}F
            </span>
            <button
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete schema "${schema.name}"?`)) {
                  deleteSchema(schema.id);
                }
              }}
              title="Delete"
            >
              {'\u2715'}
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className="w-56 min-w-[224px] flex flex-col"
      style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Schemas</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{schemaList.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {renderSection('Master Data', masterSchemas)}
        {renderSection('User Data', userSchemas)}
      </div>

      <div className="shrink-0 px-2 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        {showAdd ? (
          <div className="flex flex-col gap-2">
            {/* Schema name + category */}
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Schema name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setShowAdd(false);
              }}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as DataCategory)}
            >
              <option value="master">Master</option>
              <option value="user">User</option>
            </select>

            {/* Inline field definitions */}
            <div className="rounded p-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Fields
              </div>
              <div className="space-y-1.5">
                {pendingFields.map((field, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updatePendingField(i, { name: e.target.value })}
                      placeholder="field name"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.4rem' }}
                    />
                    <select
                      value={field.fieldType.kind}
                      onChange={(e) => updatePendingFieldType(i, e.target.value as DataFieldType['kind'])}
                      style={{ width: '70px', fontSize: '0.7rem', padding: '0.25rem 0.2rem' }}
                    >
                      {FIELD_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removePendingField(i)}
                      style={{ color: 'var(--red)', background: 'none', border: 'none', padding: '0 4px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addPendingField}
                className="w-full text-[10px] mt-1.5 py-0.5 rounded"
                style={{ color: 'var(--accent)', background: 'none', border: '1px dashed var(--border)' }}
              >
                + Field
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-1">
              <button
                className="flex-1 primary"
                style={{ fontSize: '0.75rem', padding: '0.3rem' }}
                onClick={handleAdd}
              >
                Create
              </button>
              <button
                className="flex-1"
                style={{ fontSize: '0.75rem', padding: '0.3rem' }}
                onClick={() => { setShowAdd(false); setPendingFields([createDefaultField()]); }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="w-full text-xs py-1.5 rounded transition-colors"
            style={{ color: 'var(--accent)', background: 'none', border: '1px dashed var(--border)' }}
            onClick={() => setShowAdd(true)}
          >
            + Add Schema
          </button>
        )}
      </div>
    </div>
  );
}

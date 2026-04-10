import { useState } from 'react';
import { useDataStore } from '../dataStore';
import type { DataCategory } from '../types';

export function SchemaList() {
  const schemas = useDataStore((s) => s.schemas);
  const selectedId = useDataStore((s) => s.selectedSchemaId);
  const selectSchema = useDataStore((s) => s.selectSchema);
  const addSchema = useDataStore((s) => s.addSchema);
  const deleteSchema = useDataStore((s) => s.deleteSchema);
  const ensureTable = useDataStore((s) => s.ensureTable);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<DataCategory>('master');
  const [showAdd, setShowAdd] = useState(false);

  const schemaList = Object.values(schemas);
  const masterSchemas = schemaList.filter((s) => s.category === 'master');
  const userSchemas = schemaList.filter((s) => s.category === 'user');

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = addSchema(name, newCategory);
    if (newCategory === 'master') {
      ensureTable(id);
    }
    setNewName('');
    setShowAdd(false);
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
            <span
              className="flex-1 text-xs truncate"
              style={{ color: 'var(--text)' }}
            >
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
      style={{
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
          Schemas
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {schemaList.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {renderSection('Master Data', masterSchemas)}
        {renderSection('User Data', userSchemas)}
      </div>

      <div className="shrink-0 px-2 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        {showAdd ? (
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Schema name..."
              className="text-xs px-2 py-1.5 rounded"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                outline: 'none',
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setShowAdd(false);
              }}
            />
            <div className="flex items-center gap-1">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as DataCategory)}
                className="flex-1 text-xs px-1.5 py-1 rounded"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              >
                <option value="master">Master</option>
                <option value="user">User</option>
              </select>
              <button
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                }}
                onClick={handleAdd}
              >
                Add
              </button>
              <button
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
                onClick={() => setShowAdd(false)}
              >
                {'\u2715'}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="w-full text-xs py-1.5 rounded transition-colors"
            style={{
              color: 'var(--accent)',
              background: 'none',
              border: '1px dashed var(--border)',
            }}
            onClick={() => setShowAdd(true)}
          >
            + Add Schema
          </button>
        )}
      </div>
    </div>
  );
}

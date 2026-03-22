import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { dataApi, type DataSchema, type MasterDataEntry, type UserVariable } from '@/lib/data-api';

type Tab = 'schemas' | 'variables';

export function DataOrganizerPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('schemas');
  const [schemas, setSchemas] = useState<DataSchema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<DataSchema | null>(null);
  const [entries, setEntries] = useState<MasterDataEntry[]>([]);
  const [variables, setVariables] = useState<UserVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ entryId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const loadSchemas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dataApi.getSchemas();
      setSchemas(data);
      if (data.length > 0 && !selectedSchema) {
        setSelectedSchema(data[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schemas');
    } finally {
      setLoading(false);
    }
  }, [selectedSchema]);

  const loadEntries = useCallback(async () => {
    if (!selectedSchema) return;
    try {
      const data = await dataApi.getEntries(selectedSchema.id);
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entries');
    }
  }, [selectedSchema]);

  const loadVariables = useCallback(async () => {
    try {
      const data = await dataApi.getVariables();
      setVariables(data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => { loadSchemas(); }, [loadSchemas]);
  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => {
    if (tab === 'variables') loadVariables();
  }, [tab, loadVariables]);

  const handleUpdateField = async (entryId: string, field: string, rawValue: string) => {
    if (!selectedSchema) return;
    setEditingCell(null);

    // Parse value based on field type
    const fieldDef = selectedSchema.fields.find(f => f.name === field);
    let value: unknown = rawValue;
    if (fieldDef) {
      const ft = fieldDef.field_type.type;
      if (ft === 'Int') value = parseInt(rawValue, 10);
      else if (ft === 'Float') value = parseFloat(rawValue);
      else if (ft === 'Bool') value = rawValue === 'true';
      else {
        try { value = JSON.parse(rawValue); } catch { value = rawValue; }
      }
    }

    try {
      await dataApi.updateField(selectedSchema.id, entryId, field, value);
      await loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update field');
    }
  };

  const handleAddEntry = async () => {
    if (!selectedSchema) return;
    const entryId = prompt('Entry ID:');
    if (!entryId) return;
    const actorId = prompt('Actor ID (optional):') || undefined;
    try {
      await dataApi.createEntry(selectedSchema.id, entryId, actorId);
      await loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create entry');
    }
  };

  const handleExport = async () => {
    try {
      const data = await dataApi.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data-organizer-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await dataApi.importAll(data);
        await loadSchemas();
        await loadEntries();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Import failed');
      }
    };
    input.click();
  };

  // Exposed fields for table columns
  const exposedFields = selectedSchema?.fields.filter(f => f.visibility === 'Exposed') ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-700">
        <h2 className="text-sm font-semibold text-white whitespace-nowrap">{t('dataOrganizer.title')}</h2>
        <div className="flex-1" />
        <button
          onClick={handleExport}
          className="px-3 py-1 text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
        >
          {t('dataOrganizer.export')}
        </button>
        <button
          onClick={handleImport}
          className="px-3 py-1 text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
        >
          {t('dataOrganizer.import')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-700">
        <button
          onClick={() => setTab('schemas')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === 'schemas' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t('dataOrganizer.masterData', { count: schemas.length })}
        </button>
        <button
          onClick={() => setTab('variables')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === 'variables' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t('dataOrganizer.userVariables', { count: variables.length })}
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white">{t('dataOrganizer.dismiss')}</button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {tab === 'schemas' && (
          <>
            {/* Schema List (sidebar) */}
            <div className="w-52 border-r border-zinc-700 overflow-y-auto">
              {loading && <div className="p-3 text-zinc-500 text-xs">{t('dataOrganizer.loading')}</div>}
              {schemas.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSchema(s)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-zinc-800 ${
                    selectedSchema?.id === s.id
                      ? 'bg-zinc-800 text-blue-300'
                      : 'text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-zinc-500 text-[10px]">{s.domain} | {s.fields.length} fields</div>
                </button>
              ))}
              {schemas.length === 0 && !loading && (
                <div className="p-3 text-zinc-500 text-xs text-center">{t('dataOrganizer.noSchemas')}</div>
              )}
            </div>

            {/* Entry Table */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedSchema && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
                    <span className="text-xs text-zinc-400">{selectedSchema.name}</span>
                    {selectedSchema.description && (
                      <span className="text-xs text-zinc-600">- {selectedSchema.description}</span>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={handleAddEntry}
                      className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-zinc-800 rounded transition-colors"
                    >
                      {t('dataOrganizer.addEntry')}
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-zinc-900 text-zinc-400">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium border-b border-zinc-700">{t('dataOrganizer.entryId')}</th>
                          <th className="text-left px-3 py-2 font-medium border-b border-zinc-700">{t('dataOrganizer.actor')}</th>
                          {exposedFields.map(f => (
                            <th key={f.name} className="text-left px-3 py-2 font-medium border-b border-zinc-700">
                              <div>{f.name}</div>
                              <div className="text-[10px] text-zinc-600 font-normal">{f.field_type.type}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map(entry => (
                          <tr key={entry.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                            <td className="px-3 py-2 text-zinc-200 font-mono">{entry.id}</td>
                            <td className="px-3 py-2 text-zinc-400">{entry.actor_id || '-'}</td>
                            {exposedFields.map(f => {
                              const val = entry.values[f.name];
                              const isEditing = editingCell?.entryId === entry.id && editingCell?.field === f.name;
                              return (
                                <td key={f.name} className="px-3 py-2">
                                  {isEditing ? (
                                    <input
                                      autoFocus
                                      value={editValue}
                                      onChange={e => setEditValue(e.target.value)}
                                      onBlur={() => handleUpdateField(entry.id, f.name, editValue)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleUpdateField(entry.id, f.name, editValue);
                                        if (e.key === 'Escape') setEditingCell(null);
                                      }}
                                      className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded border border-blue-500 text-xs w-full focus:outline-none"
                                    />
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingCell({ entryId: entry.id, field: f.name });
                                        setEditValue(val !== undefined ? String(val) : '');
                                      }}
                                      className="text-left w-full text-zinc-200 hover:bg-zinc-700 px-1.5 py-0.5 rounded cursor-text"
                                    >
                                      {val !== undefined ? String(val) : <span className="text-zinc-600">null</span>}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {entries.length === 0 && (
                      <div className="p-4 text-zinc-500 text-xs text-center">{t('dataOrganizer.noEntries')}</div>
                    )}
                  </div>
                </>
              )}
              {!selectedSchema && (
                <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                  {t('dataOrganizer.selectSchema')}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'variables' && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">{t('dataOrganizer.name')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('dataOrganizer.type')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('dataOrganizer.value')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('dataOrganizer.persistence')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('dataOrganizer.actor')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('dataOrganizer.description')}</th>
                </tr>
              </thead>
              <tbody>
                {variables.map((v, i) => (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                    <td className="px-4 py-2 text-zinc-200 font-mono">{v.name}</td>
                    <td className="px-4 py-2 text-zinc-400">{v.var_type}</td>
                    <td className="px-4 py-2 text-zinc-200 font-mono">{JSON.stringify(v.value)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        v.persistence === 'Persistent'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-zinc-600/20 text-zinc-400'
                      }`}>
                        {v.persistence}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-400">{v.actor_id || '-'}</td>
                    <td className="px-4 py-2 text-zinc-500">{v.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {variables.length === 0 && (
              <div className="p-4 text-zinc-500 text-xs text-center">{t('dataOrganizer.noVariables')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { useDataStore } from '../dataStore';
import type { DataField, MasterDataRecord } from '../types';
import { fieldTypeLabel } from '../types';

// ── Cell Editor ────────────────────────────────────

function CellEditor({
  field,
  value,
  onChange,
}: {
  field: DataField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const ft = field.fieldType;

  switch (ft.kind) {
    case 'bool':
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="cursor-pointer"
        />
      );
    case 'int':
      return (
        <input
          type="number"
          value={value != null ? Number(value) : 0}
          step={1}
          className="w-full text-xs px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        />
      );
    case 'float':
      return (
        <input
          type="number"
          value={value != null ? Number(value) : 0}
          step={0.1}
          className="w-full text-xs px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
      );
    case 'enum':
      return (
        <select
          value={String(value ?? '')}
          className="w-full text-xs px-1 py-0.5 rounded"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">--</option>
          {ft.variants.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      );
    case 'reference':
    case 'string':
    default:
      return (
        <input
          type="text"
          value={value != null ? String(value) : ''}
          className="w-full text-xs px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

// ── Import Dialog ──────────────────────────────────

function ImportDialog({
  fields,
  onImport,
  onClose,
}: {
  fields: DataField[];
  onImport: (records: MasterDataRecord[]) => void;
  onClose: () => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): MasterDataRecord[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const records: MasterDataRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const values: Record<string, unknown> = {};

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const field = fields.find((f) => f.name === header);
        if (!field) continue;

        const raw = cells[j] ?? '';
        switch (field.fieldType.kind) {
          case 'int': values[header] = parseInt(raw, 10) || 0; break;
          case 'float': values[header] = parseFloat(raw) || 0; break;
          case 'bool': values[header] = raw === 'true' || raw === '1'; break;
          default: values[header] = raw;
        }
      }

      // Use 'id' column if present, otherwise generate
      const idCol = headers.indexOf('id');
      const id = idCol >= 0 && cells[idCol] ? cells[idCol] : crypto.randomUUID();
      records.push({ id, values });
    }

    return records;
  };

  const handleImport = () => {
    try {
      setError('');
      const records = parseCSV(csvText);
      if (records.length === 0) {
        setError('No records found');
        return;
      }
      onImport(records);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-[520px] max-w-[90vw] max-h-[80vh] flex flex-col rounded-lg shadow-xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Import CSV</span>
          <button
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none' }}
            onClick={onClose}
          >
            {'\u2715'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Expected columns: <strong>id</strong> (optional), {fields.map((f) => f.name).join(', ')}
          </div>

          <div className="flex gap-2">
            <button
              className="text-xs px-3 py-1.5 rounded"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload CSV File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`id,${fields.map((f) => f.name).join(',')}\nrow1_id,value1,value2,...`}
            className="text-xs px-3 py-2 rounded font-mono"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
              resize: 'vertical',
              minHeight: 120,
            }}
          />

          {error && (
            <div className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}>
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            className="text-xs px-4 py-1.5 rounded"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="text-xs px-4 py-1.5 rounded"
            style={{ background: 'var(--accent)', border: 'none', color: '#fff' }}
            onClick={handleImport}
            disabled={!csvText.trim()}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Table View ────────────────────────────────

export function DataTableView() {
  const schemas = useDataStore((s) => s.schemas);
  const tables = useDataStore((s) => s.tables);
  const selectedSchemaId = useDataStore((s) => s.selectedSchemaId);
  const selectedTableId = useDataStore((s) => s.selectedTableId);
  const addRecord = useDataStore((s) => s.addRecord);
  const updateRecord = useDataStore((s) => s.updateRecord);
  const deleteRecord = useDataStore((s) => s.deleteRecord);
  const importRecords = useDataStore((s) => s.importRecords);

  const [showImport, setShowImport] = useState(false);

  const schema = selectedSchemaId ? schemas[selectedSchemaId] : null;
  const table = selectedTableId ? tables[selectedTableId] : null;

  if (!schema) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: 'var(--text-muted)', fontSize: 13 }}
      >
        Select a schema to view/edit data
      </div>
    );
  }

  if (schema.category === 'user') {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-2"
        style={{ color: 'var(--text-muted)', fontSize: 13 }}
      >
        <span>User Data schema</span>
        <span className="text-xs">User data is created at runtime, not editable here.</span>
      </div>
    );
  }

  if (schema.fields.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: 'var(--text-muted)', fontSize: 13 }}
      >
        Add fields to the schema to start editing data
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
          {schema.name}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {table?.records.length ?? 0} records
        </span>
        <div className="flex-1" />
        <button
          className="text-xs px-2 py-1 rounded"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
          onClick={() => setShowImport(true)}
        >
          Import CSV
        </button>
        <button
          className="text-xs px-2 py-1 rounded"
          style={{
            background: 'var(--accent)',
            border: 'none',
            color: '#fff',
          }}
          onClick={() => {
            if (table) addRecord(table.id);
          }}
          disabled={!table}
        >
          + Add Row
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs" style={{ minWidth: schema.fields.length * 140 + 100 }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 1 }}>
              <th
                className="text-left px-2 py-1.5 font-semibold"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: 50 }}
              >
                #
              </th>
              {schema.fields.map((field) => (
                <th
                  key={field.name}
                  className="text-left px-2 py-1.5 font-semibold"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', minWidth: 120 }}
                >
                  <div>{field.name}</div>
                  <div className="font-normal" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {fieldTypeLabel(field.fieldType)}
                  </div>
                </th>
              ))}
              <th
                className="px-2 py-1.5"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: 40 }}
              />
            </tr>
          </thead>
          <tbody>
            {(!table || table.records.length === 0) && (
              <tr>
                <td
                  colSpan={schema.fields.length + 2}
                  className="text-center py-8"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No records yet. Click &quot;+ Add Row&quot; or &quot;Import CSV&quot;.
                </td>
              </tr>
            )}
            {table?.records.map((record, rowIdx) => (
              <tr
                key={record.id}
                className="group"
                style={{
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <td
                  className="px-2 py-1"
                  style={{ color: 'var(--text-muted)', fontSize: 10, verticalAlign: 'middle' }}
                >
                  {rowIdx + 1}
                </td>
                {schema.fields.map((field) => (
                  <td
                    key={field.name}
                    className="px-1 py-0.5"
                    style={{ verticalAlign: 'middle' }}
                  >
                    <CellEditor
                      field={field}
                      value={record.values[field.name]}
                      onChange={(v) => updateRecord(table.id, record.id, field.name, v)}
                    />
                  </td>
                ))}
                <td className="px-1 py-0.5" style={{ verticalAlign: 'middle' }}>
                  <button
                    className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--red)', background: 'none', border: 'none', padding: '2px 4px' }}
                    onClick={() => deleteRecord(table.id, record.id)}
                    title="Delete row"
                  >
                    {'\u2715'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Import dialog */}
      {showImport && table && (
        <ImportDialog
          fields={schema.fields}
          onImport={(records) => importRecords(table.id, records)}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

import { SchemaList } from './SchemaList';
import { SchemaEditor } from './SchemaEditor';
import { DataTableView } from './DataTableView';
import { useDataStore } from '../dataStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useState } from 'react';

// ── Mobile Tab Switcher ────────────────────────────

type MobileTab = 'schemas' | 'fields' | 'data';

function MobileDataView() {
  const selectedSchemaId = useDataStore((s) => s.selectedSchemaId);
  const [tab, setTab] = useState<MobileTab>('schemas');

  const tabs: { key: MobileTab; label: string }[] = [
    { key: 'schemas', label: 'Schemas' },
    { key: 'fields', label: 'Fields' },
    { key: 'data', label: 'Data' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div
        className="flex items-center gap-0.5 px-2 shrink-0"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          height: 32,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1 text-xs font-medium rounded-t"
            style={{
              color: tab === t.key ? 'var(--text)' : 'var(--text-muted)',
              background: tab === t.key ? 'var(--bg-surface-2)' : 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {tab === 'schemas' && (
          <div className="flex-1 overflow-hidden">
            <SchemaList />
          </div>
        )}
        {tab === 'fields' && (
          <div className="flex-1 overflow-hidden">
            {selectedSchemaId ? (
              <SchemaEditor />
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                Select a schema first
              </div>
            )}
          </div>
        )}
        {tab === 'data' && <DataTableView />}
      </div>
    </div>
  );
}

// ── Desktop Layout ─────────────────────────────────

export function DataViewLayout() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileDataView />;
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <SchemaList />
      <SchemaEditor />
      <DataTableView />
    </div>
  );
}

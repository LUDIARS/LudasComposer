import { create } from 'zustand';
import { generateId } from '@/lib/utils';
import type {
  DataSchema,
  DataField,
  MasterDataTable,
  MasterDataRecord,
  DataCategory,
} from './types';
import { createDefaultSchema, getDefaultValueForType } from './types';

interface DataState {
  schemas: Record<string, DataSchema>;
  tables: Record<string, MasterDataTable>;
  selectedSchemaId: string | null;
  selectedTableId: string | null;

  // Schema CRUD
  addSchema: (name: string, category?: DataCategory) => string;
  updateSchema: (id: string, updates: Partial<Omit<DataSchema, 'id'>>) => void;
  deleteSchema: (id: string) => void;
  addField: (schemaId: string, field: DataField) => void;
  updateField: (schemaId: string, fieldIndex: number, field: DataField) => void;
  removeField: (schemaId: string, fieldIndex: number) => void;
  moveField: (schemaId: string, fromIndex: number, toIndex: number) => void;

  // MasterData CRUD
  ensureTable: (schemaId: string) => string;
  addRecord: (tableId: string) => string;
  updateRecord: (tableId: string, recordId: string, field: string, value: unknown) => void;
  deleteRecord: (tableId: string, recordId: string) => void;
  importRecords: (tableId: string, records: MasterDataRecord[]) => number;

  // Selection
  selectSchema: (id: string | null) => void;
  selectTable: (id: string | null) => void;
}

export const useDataStore = create<DataState>()((set, get) => ({
  schemas: {},
  tables: {},
  selectedSchemaId: null,
  selectedTableId: null,

  // ── Schema CRUD ──────────────────────────────────

  addSchema: (name, category = 'master') => {
    const id = generateId();
    const schema = createDefaultSchema(id, name);
    schema.category = category;
    set((s) => ({
      schemas: { ...s.schemas, [id]: schema },
      selectedSchemaId: id,
    }));
    return id;
  },

  updateSchema: (id, updates) =>
    set((s) => {
      const schema = s.schemas[id];
      if (!schema) return {};
      return {
        schemas: { ...s.schemas, [id]: { ...schema, ...updates, id } },
      };
    }),

  deleteSchema: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.schemas;
      // Also delete associated tables
      const tables = { ...s.tables };
      for (const [tid, table] of Object.entries(tables)) {
        if (table.schemaId === id) delete tables[tid];
      }
      return {
        schemas: rest,
        tables,
        selectedSchemaId: s.selectedSchemaId === id ? null : s.selectedSchemaId,
        selectedTableId: s.selectedTableId && tables[s.selectedTableId] ? s.selectedTableId : null,
      };
    }),

  addField: (schemaId, field) =>
    set((s) => {
      const schema = s.schemas[schemaId];
      if (!schema) return {};
      return {
        schemas: {
          ...s.schemas,
          [schemaId]: { ...schema, fields: [...schema.fields, field] },
        },
      };
    }),

  updateField: (schemaId, fieldIndex, field) =>
    set((s) => {
      const schema = s.schemas[schemaId];
      if (!schema || fieldIndex < 0 || fieldIndex >= schema.fields.length) return {};
      const fields = [...schema.fields];
      fields[fieldIndex] = field;
      return {
        schemas: { ...s.schemas, [schemaId]: { ...schema, fields } },
      };
    }),

  removeField: (schemaId, fieldIndex) =>
    set((s) => {
      const schema = s.schemas[schemaId];
      if (!schema) return {};
      const fields = schema.fields.filter((_, i) => i !== fieldIndex);
      return {
        schemas: { ...s.schemas, [schemaId]: { ...schema, fields } },
      };
    }),

  moveField: (schemaId, fromIndex, toIndex) =>
    set((s) => {
      const schema = s.schemas[schemaId];
      if (!schema) return {};
      const fields = [...schema.fields];
      const [moved] = fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, moved);
      return {
        schemas: { ...s.schemas, [schemaId]: { ...schema, fields } },
      };
    }),

  // ── MasterData CRUD ──────────────────────────────

  ensureTable: (schemaId) => {
    const state = get();
    const existing = Object.values(state.tables).find((t) => t.schemaId === schemaId);
    if (existing) {
      set({ selectedTableId: existing.id });
      return existing.id;
    }
    const schema = state.schemas[schemaId];
    const tableId = generateId();
    const table: MasterDataTable = {
      id: tableId,
      schemaId,
      name: schema?.name ?? 'Data',
      records: [],
    };
    set((s) => ({
      tables: { ...s.tables, [tableId]: table },
      selectedTableId: tableId,
    }));
    return tableId;
  },

  addRecord: (tableId) => {
    const state = get();
    const table = state.tables[tableId];
    if (!table) return '';
    const schema = state.schemas[table.schemaId];
    if (!schema) return '';

    const recordId = generateId();
    const values: Record<string, unknown> = {};
    for (const field of schema.fields) {
      values[field.name] = field.defaultValue ?? getDefaultValueForType(field.fieldType);
    }

    const record: MasterDataRecord = { id: recordId, values };
    set((s) => ({
      tables: {
        ...s.tables,
        [tableId]: { ...table, records: [...table.records, record] },
      },
    }));
    return recordId;
  },

  updateRecord: (tableId, recordId, field, value) =>
    set((s) => {
      const table = s.tables[tableId];
      if (!table) return {};
      const records = table.records.map((r) =>
        r.id === recordId ? { ...r, values: { ...r.values, [field]: value } } : r,
      );
      return {
        tables: { ...s.tables, [tableId]: { ...table, records } },
      };
    }),

  deleteRecord: (tableId, recordId) =>
    set((s) => {
      const table = s.tables[tableId];
      if (!table) return {};
      return {
        tables: {
          ...s.tables,
          [tableId]: { ...table, records: table.records.filter((r) => r.id !== recordId) },
        },
      };
    }),

  importRecords: (tableId, records) => {
    const state = get();
    const table = state.tables[tableId];
    if (!table) return 0;

    const merged = [...table.records];
    let imported = 0;
    for (const rec of records) {
      const idx = merged.findIndex((r) => r.id === rec.id);
      if (idx >= 0) {
        merged[idx] = rec;
      } else {
        merged.push(rec);
      }
      imported++;
    }

    set((s) => ({
      tables: { ...s.tables, [tableId]: { ...table, records: merged } },
    }));
    return imported;
  },

  // ── Selection ────────────────────────────────────

  selectSchema: (id) => set({ selectedSchemaId: id }),
  selectTable: (id) => set({ selectedTableId: id }),
}));

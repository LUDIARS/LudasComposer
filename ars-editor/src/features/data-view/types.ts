// Data View types — mirrors ars-core/src/models/data.rs

// ── Field Types ────────────────────────────────────

export type DataFieldType =
  | { kind: 'bool' }
  | { kind: 'int' }
  | { kind: 'float' }
  | { kind: 'string' }
  | { kind: 'enum'; variants: string[] }
  | { kind: 'reference'; schemaId: string };

export type FieldConstraint =
  | { type: 'required' }
  | { type: 'min'; value: number }
  | { type: 'max'; value: number }
  | { type: 'minLength'; value: number }
  | { type: 'maxLength'; value: number }
  | { type: 'pattern'; regex: string };

export interface DataField {
  name: string;
  fieldType: DataFieldType;
  defaultValue?: unknown;
  description: string;
  constraints: FieldConstraint[];
}

export type DataCategory = 'master' | 'user';

export interface DataSchema {
  id: string;
  name: string;
  description: string;
  fields: DataField[];
  category: DataCategory;
}

// ── Master Data ────────────────────────────────────

export interface MasterDataRecord {
  id: string;
  values: Record<string, unknown>;
}

export interface MasterDataTable {
  id: string;
  schemaId: string;
  name: string;
  records: MasterDataRecord[];
}

// ── Helpers ────────────────────────────────────────

export const FIELD_TYPE_OPTIONS: { value: DataFieldType['kind']; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'int', label: 'Int' },
  { value: 'float', label: 'Float' },
  { value: 'bool', label: 'Bool' },
  { value: 'enum', label: 'Enum' },
  { value: 'reference', label: 'Reference' },
];

export function createDefaultField(name = ''): DataField {
  return {
    name,
    fieldType: { kind: 'string' },
    description: '',
    constraints: [],
  };
}

export function createDefaultSchema(id: string, name: string): DataSchema {
  return {
    id,
    name,
    description: '',
    fields: [],
    category: 'master',
  };
}

export function fieldTypeLabel(ft: DataFieldType): string {
  switch (ft.kind) {
    case 'bool': return 'Bool';
    case 'int': return 'Int';
    case 'float': return 'Float';
    case 'string': return 'String';
    case 'enum': return `Enum(${ft.variants.join(',')})`;
    case 'reference': return `Ref(${ft.schemaId})`;
  }
}

export function getDefaultValueForType(ft: DataFieldType): unknown {
  switch (ft.kind) {
    case 'bool': return false;
    case 'int': return 0;
    case 'float': return 0.0;
    case 'string': return '';
    case 'enum': return ft.variants[0] ?? '';
    case 'reference': return '';
  }
}

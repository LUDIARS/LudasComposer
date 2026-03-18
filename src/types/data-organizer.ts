/**
 * Data Organizer - TypeScript型定義
 *
 * マスターデータとユーザーデータを管理するデータオーガナイザーの
 * フロントエンド型定義。Rustバックエンドとの型整合性を保つ。
 */

// === フィールド型定義 ===

export type FieldType =
  | { type: 'Int' }
  | { type: 'Float' }
  | { type: 'String' }
  | { type: 'Bool' }
  | { type: 'Reference'; schema_id: string }
  | { type: 'Array'; element_type: FieldType }
  | { type: 'Vec2' }
  | { type: 'Vec3' }
  | { type: 'Enum'; variants: string[] };

/**
 * フィールドの可視性（ホワイトリスト方式）
 * UnityのSerializeFieldと等価の概念。
 * Exposed: UIに表示され、外部から値を注入可能
 * Hidden: UIに表示されない（デフォルト）
 */
export type FieldVisibility = 'Exposed' | 'Hidden';

/**
 * 更新頻度ヒント
 * 更新頻度に応じて設定の表示/非表示を制御する
 */
export type UpdateFrequency = 'Constant' | 'Rare' | 'Frequent';

/** スキーマ内の1フィールド定義 */
export interface FieldDefinition {
  name: string;
  field_type: FieldType;
  default_value?: unknown;
  visibility: FieldVisibility;
  description: string;
  update_frequency: UpdateFrequency;
}

// === マスターデータ ===

/**
 * データスキーマ定義
 * Excelのシート1枚に相当。各エントリはIDで管理される。
 */
export interface DataSchema {
  id: string;
  name: string;
  domain: string;
  fields: FieldDefinition[];
  description: string;
}

/**
 * マスターデータエントリ
 * ゲーム中に参照されるimmutableな定数データ。
 * 各アクターに対するバリエーションを持つ。
 */
export interface MasterDataEntry {
  id: string;
  schema_id: string;
  actor_id?: string | null;
  values: Record<string, unknown>;
}

/** マスターデータレジストリ全体 */
export interface MasterDataRegistry {
  schemas: Record<string, DataSchema>;
  entries: Record<string, Record<string, MasterDataEntry>>;
}

// === ユーザーデータ ===

/** 永続化マーカー [P] */
export type PersistenceMarker = 'Persistent' | 'Transient';

/** ユーザーデータ変数 */
export interface UserVariable {
  name: string;
  var_type: string;
  value: unknown;
  persistence: PersistenceMarker;
  actor_id?: string | null;
  description: string;
}

/** アクターの生成元情報 */
export type ActorOrigin =
  | { type: 'ScenePlaced'; scene_id: string }
  | { type: 'PrefabInstanced'; prefab_id: string }
  | { type: 'DynamicGenerated'; generator_id: string; seed?: number | null };

/** プログラム生成アクターの状態スナップショット */
export interface ActorSnapshot {
  actor_id: string;
  origin: ActorOrigin;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/** ユーザーデータストア */
export interface UserDataStore {
  variables: Record<string, UserVariable>;
  actor_snapshots: Record<string, ActorSnapshot>;
}

// === ブラックボード ===

/**
 * ブラックボードの読み取りクエリ
 * schema_id, entry_id, field で値を特定する
 */
export interface BlackboardQuery {
  schema_id: string;
  entry_id: string;
  field: string;
}

/** ランタイムオーバーライド */
export interface RuntimeOverride {
  key: string; // "schema_id:entry_id:field" 形式
  value: unknown;
}

// === DataOrganizer ===

/** データオーガナイザー全体 */
export interface DataOrganizerState {
  master_data: MasterDataRegistry;
  user_data: UserDataStore;
}

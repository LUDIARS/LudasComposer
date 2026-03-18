// === ファイル名変換型定義 ===

/** 日本語→英語ネーミングルール */
export interface NamingRule {
  japanese_pattern: string;
  english_name: string;
}

/** ネーミング設定 */
export interface NamingConfig {
  rules: NamingRule[];
  /** カテゴリ別プレフィックス (例: "model" → "mdl_") */
  category_prefixes: Record<string, string>;
  sequence_digits: number;
}

/** D&Dで受け取ったファイル情報 */
export interface DroppedFile {
  path: string;
  original_name: string;
  suggested_category?: string;
  suggested_english_name?: string;
  size: number;
}

/** ファイル登録リクエスト */
export interface FileRegistrationRequest {
  source_path: string;
  original_name: string;
  english_name: string;
  category: string;
  role: string;
}

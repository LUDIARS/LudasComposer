// === MB→FBXエクスポート型定義 ===

export type ExportFormat = 'fbx' | 'glb' | 'gltf';

export type ExportStatus = 'pending' | 'running' | 'completed' | 'failed';

/** MB→FBXエクスポート設定 */
export interface MbExportConfig {
  maya_path?: string;
  output_format: ExportFormat;
  fbx_version: string;
  bake_animation: boolean;
  export_skeleton: boolean;
}

/** エクスポートジョブ */
export interface ExportJob {
  id: string;
  input_path: string;
  output_path: string;
  config: MbExportConfig;
  status: ExportStatus;
  error?: string;
  resource_id?: string;
}

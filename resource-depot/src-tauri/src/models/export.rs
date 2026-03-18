use serde::{Deserialize, Serialize};

/// エクスポートフォーマット
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExportFormat {
    Fbx,
    Glb,
    Gltf,
}

/// エクスポートの状態
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExportStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

/// MB→FBXエクスポート設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MbExportConfig {
    /// Mayaの実行パス（mayapy / mayabatch）
    pub maya_path: Option<String>,
    /// 出力フォーマット
    pub output_format: ExportFormat,
    /// FBXバージョン (例: "FBX202000")
    pub fbx_version: String,
    /// アニメーションをベイクするか
    pub bake_animation: bool,
    /// スケルトンをエクスポートするか
    pub export_skeleton: bool,
}

impl Default for MbExportConfig {
    fn default() -> Self {
        Self {
            maya_path: None,
            output_format: ExportFormat::Fbx,
            fbx_version: "FBX202000".to_string(),
            bake_animation: true,
            export_skeleton: true,
        }
    }
}

/// エクスポートジョブ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportJob {
    pub id: String,
    /// 入力ファイルパス (.mb)
    pub input_path: String,
    /// 出力ファイルパス (.fbx)
    pub output_path: String,
    /// エクスポート設定
    pub config: MbExportConfig,
    /// 状態
    pub status: ExportStatus,
    /// エラーメッセージ
    pub error: Option<String>,
    /// 対応するリソースID（登録済みの場合）
    pub resource_id: Option<String>,
}

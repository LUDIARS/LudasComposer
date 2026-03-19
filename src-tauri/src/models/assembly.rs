use serde::{Deserialize, Serialize};

/// ビルドターゲットプラットフォーム
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BuildTarget {
    Webgl,
    Pc,
}

/// ビルド方式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum BuildMethod {
    /// TypeScript JIT: ホットリロード対応、WebGL/PC共通
    TypescriptJit,
    /// WASM Bundle: Emscriptenコンパイル済みC++コアエンジン
    WasmBundle,
}

/// ビルド設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildConfig {
    pub target: BuildTarget,
    pub method: BuildMethod,
}

/// コアアセンブリの取得元
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CoreAssemblyOrigin {
    Pictor,
    Ergo,
    Other,
}

/// コアアセンブリのアーティファクト種別
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CoreArtifactType {
    /// TypeScriptソースコード
    Source,
    /// Emscriptenコンパイル済みWASMバイナリ
    Wasm,
}

/// カスタマイズ状態
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CustomizationStatus {
    Original,
    Modified,
}

/// コアアセンブリ定義
/// PictorやErgoから取得した変更頻度が低い使いまわせるコード
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreAssembly {
    pub id: String,
    pub name: String,
    pub origin: CoreAssemblyOrigin,
    pub depot_path: String,
    pub version: String,
    pub artifact_type: CoreArtifactType,
    pub customization: CustomizationStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customization_note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_path: Option<String>,
    pub build_targets: Vec<BuildTarget>,
}

/// アプリケーションアセンブリのスコープ
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AssemblyScope {
    Application,
    Scene,
}

/// アプリケーションアセンブリ定義
/// ゲーム固有のプログラム。モノリシックで使いまわせないもの
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationAssembly {
    pub id: String,
    pub name: String,
    pub scope: AssemblyScope,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scene_id: Option<String>,
    pub source_path: String,
    pub build_configs: Vec<BuildConfig>,
    pub core_assembly_dependencies: Vec<String>,
    pub app_assembly_dependencies: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_point: Option<String>,
}

/// リリースデポ接続設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseDepotConfig {
    pub name: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_token: Option<String>,
}

/// リソースデポ参照設定 (実体は別システム)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDepotRef {
    pub name: String,
    pub url: String,
}

/// データオーガナイザー参照設定 (実体は別システム)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataOrganizerRef {
    pub name: String,
    pub url: String,
}

/// プロジェクトのアセンブリ管理設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectAssemblyConfig {
    pub release_depots: Vec<ReleaseDepotConfig>,
    pub core_assemblies: Vec<CoreAssembly>,
    pub application_assemblies: Vec<ApplicationAssembly>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_depot_ref: Option<ResourceDepotRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_organizer_ref: Option<DataOrganizerRef>,
}

impl Default for ProjectAssemblyConfig {
    fn default() -> Self {
        Self {
            release_depots: Vec::new(),
            core_assemblies: Vec::new(),
            application_assemblies: Vec::new(),
            resource_depot_ref: None,
            data_organizer_ref: None,
        }
    }
}

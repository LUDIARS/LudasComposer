#[cfg(feature = "tauri-app")]
pub mod asset;
pub mod project;

#[cfg(feature = "tauri-app")]
pub use asset::*;
pub use project::*;

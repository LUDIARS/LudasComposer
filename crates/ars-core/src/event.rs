use std::any::{Any, TypeId};
use std::fmt::Debug;

/// 全イベントが実装する基底 trait
///
/// プラグインは独自の struct にこの trait を実装してイベントを追加できる。
/// コアイベントは `events` モジュールに定義済み。
pub trait ArsEvent: Any + Debug + Send + Sync + Clone + 'static {
    /// このイベントを定義したモジュールID
    /// コアイベントは "core"、プラグインは自身のID (e.g. "plugin-ergo")
    fn source_module(&self) -> &'static str;

    /// イベントのカテゴリ（ログ・フィルタリング用）
    fn category(&self) -> &'static str;
}

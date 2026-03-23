use std::any::{Any, TypeId};
use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{broadcast, RwLock};

use crate::event::ArsEvent;

type ErasedSender = Box<dyn Any + Send + Sync>;

/// 型安全・プラグイン拡張可能なイベントバス
///
/// - 各イベント型ごとに broadcast channel を保持
/// - プラグインは `register_event` で独自イベントチャンネルを追加可能
/// - 全ハンドラはモジュールの initialize / on_project_open で登録する
#[derive(Clone)]
pub struct EventBus {
    inner: Arc<EventBusInner>,
}

struct EventBusInner {
    /// TypeId → broadcast::Sender<T> (型消去して保持)
    channels: RwLock<HashMap<TypeId, ErasedSender>>,
    /// イベント型 → 発火元モジュールID（依存検証・デバッグ用）
    event_sources: RwLock<HashMap<TypeId, &'static str>>,
    /// broadcast channel のバッファサイズ
    buffer_size: usize,
}

impl EventBus {
    pub fn new(buffer_size: usize) -> Self {
        Self {
            inner: Arc::new(EventBusInner {
                channels: RwLock::new(HashMap::new()),
                event_sources: RwLock::new(HashMap::new()),
                buffer_size,
            }),
        }
    }

    /// イベントチャンネルを登録する
    ///
    /// モジュール起動時に、自分が発火するイベント型ごとに呼ぶ。
    /// 同じ型を複数回呼んでも安全（既存チャンネルを再利用）。
    pub async fn register_event<E: ArsEvent>(&self, source_module_id: &'static str) {
        let type_id = TypeId::of::<E>();
        let mut channels = self.inner.channels.write().await;
        channels.entry(type_id).or_insert_with(|| {
            let (tx, _) = broadcast::channel::<E>(self.inner.buffer_size);
            Box::new(tx)
        });
        self.inner
            .event_sources
            .write()
            .await
            .insert(type_id, source_module_id);
    }

    /// イベントを発火する
    ///
    /// 登録されていない型のイベントを emit しても無視される（エラーにはならない）。
    pub async fn emit<E: ArsEvent>(&self, event: E) {
        let type_id = TypeId::of::<E>();
        let channels = self.inner.channels.read().await;
        if let Some(sender) = channels.get(&type_id) {
            if let Some(tx) = sender.downcast_ref::<broadcast::Sender<E>>() {
                let _ = tx.send(event);
            }
        }
    }

    /// イベントを購読する
    ///
    /// チャンネルが未登録（発火元モジュールが未ロード）の場合は None を返す。
    /// プラグインの Optional 依存はここで None をチェックして対応する。
    pub async fn subscribe<E: ArsEvent>(&self) -> Option<broadcast::Receiver<E>> {
        let type_id = TypeId::of::<E>();
        let channels = self.inner.channels.read().await;
        channels
            .get(&type_id)
            .and_then(|sender| sender.downcast_ref::<broadcast::Sender<E>>())
            .map(|tx| tx.subscribe())
    }

    /// 登録済みイベントの発火元モジュールIDを取得（依存検証用）
    pub async fn get_event_source<E: ArsEvent>(&self) -> Option<&'static str> {
        let type_id = TypeId::of::<E>();
        self.inner
            .event_sources
            .read()
            .await
            .get(&type_id)
            .copied()
    }

    /// 登録済みの全イベント型IDを取得
    pub async fn registered_event_ids(&self) -> Vec<TypeId> {
        self.inner.channels.read().await.keys().copied().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone)]
    struct TestEvent {
        pub value: i32,
    }

    impl ArsEvent for TestEvent {
        fn source_module(&self) -> &'static str { "test" }
        fn category(&self) -> &'static str { "test" }
    }

    #[derive(Debug, Clone)]
    struct UnregisteredEvent;

    impl ArsEvent for UnregisteredEvent {
        fn source_module(&self) -> &'static str { "test" }
        fn category(&self) -> &'static str { "test" }
    }

    #[tokio::test]
    async fn test_register_emit_subscribe() {
        let bus = EventBus::new(16);
        bus.register_event::<TestEvent>("test-module").await;

        let mut rx = bus.subscribe::<TestEvent>().await.unwrap();
        bus.emit(TestEvent { value: 42 }).await;

        let received = rx.recv().await.unwrap();
        assert_eq!(received.value, 42);
    }

    #[tokio::test]
    async fn test_subscribe_unregistered_returns_none() {
        let bus = EventBus::new(16);
        let rx = bus.subscribe::<UnregisteredEvent>().await;
        assert!(rx.is_none());
    }

    #[tokio::test]
    async fn test_event_source_tracking() {
        let bus = EventBus::new(16);
        bus.register_event::<TestEvent>("my-module").await;

        let source = bus.get_event_source::<TestEvent>().await;
        assert_eq!(source, Some("my-module"));
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let bus = EventBus::new(16);
        bus.register_event::<TestEvent>("test").await;

        let mut rx1 = bus.subscribe::<TestEvent>().await.unwrap();
        let mut rx2 = bus.subscribe::<TestEvent>().await.unwrap();

        bus.emit(TestEvent { value: 7 }).await;

        assert_eq!(rx1.recv().await.unwrap().value, 7);
        assert_eq!(rx2.recv().await.unwrap().value, 7);
    }
}

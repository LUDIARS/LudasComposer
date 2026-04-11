/// リアルタイムコラボレーションモジュール
///
/// WebSocketを使用して以下の機能を提供する：
/// - ユーザープレゼンス（接続中のユーザー一覧）
/// - マウスカーソル位置の共有
/// - ファイルロック（排他編集制御）
use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use dashmap::DashMap;
use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

// ========== Types ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CollabMessage {
    #[serde(rename = "join")]
    Join {
        user_id: String,
        display_name: String,
        avatar_url: String,
        color: String,
    },
    #[serde(rename = "leave")]
    Leave { user_id: String },
    #[serde(rename = "cursor")]
    Cursor {
        user_id: String,
        x: f64,
        y: f64,
        scene_id: Option<String>,
    },
    #[serde(rename = "presence")]
    Presence {
        user_id: String,
        scene_id: Option<String>,
        scene_name: Option<String>,
        selected_node_ids: Vec<String>,
        selected_node_names: Vec<String>,
        view_tab: String,
    },
    #[serde(rename = "lock")]
    Lock {
        user_id: String,
        resource_id: String,
        resource_name: String,
    },
    #[serde(rename = "unlock")]
    Unlock {
        user_id: String,
        resource_id: String,
    },
    #[serde(rename = "room_state")]
    RoomState {
        users: Vec<CollabUser>,
        locks: Vec<LockInfo>,
        presences: Vec<UserPresence>,
    },
    #[serde(rename = "lock_result")]
    LockResult {
        resource_id: String,
        granted: bool,
        held_by: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollabUser {
    pub user_id: String,
    pub display_name: String,
    pub avatar_url: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockInfo {
    pub resource_id: String,
    pub resource_name: String,
    pub user_id: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPresence {
    pub user_id: String,
    pub scene_id: Option<String>,
    pub scene_name: Option<String>,
    pub selected_node_ids: Vec<String>,
    pub selected_node_names: Vec<String>,
    pub view_tab: String,
}

// ========== Room Management ==========

struct Room {
    tx: broadcast::Sender<String>,
    users: DashMap<String, CollabUser>,
    locks: DashMap<String, LockInfo>,
    presences: DashMap<String, UserPresence>,
}

impl Room {
    fn new() -> Self {
        let (tx, _) = broadcast::channel(256);
        Self {
            tx,
            users: DashMap::new(),
            locks: DashMap::new(),
            presences: DashMap::new(),
        }
    }
}

#[derive(Clone, Default)]
pub struct CollabState {
    rooms: Arc<DashMap<String, Arc<Room>>>,
}

impl CollabState {
    pub fn new() -> Self {
        Self::default()
    }

    fn get_or_create_room(&self, room_id: &str) -> Arc<Room> {
        self.rooms
            .entry(room_id.to_string())
            .or_insert_with(|| Arc::new(Room::new()))
            .clone()
    }

    fn cleanup_room(&self, room_id: &str) {
        if let Some(room) = self.rooms.get(room_id) {
            if room.users.is_empty() {
                drop(room);
                self.rooms.remove(room_id);
            }
        }
    }
}

// ========== Color Assignment ==========

const COLLAB_COLORS: &[&str] = &[
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b",
];

fn assign_color(user_id: &str) -> String {
    let hash: usize = user_id.bytes().map(|b| b as usize).sum();
    COLLAB_COLORS[hash % COLLAB_COLORS.len()].to_string()
}

// ========== WebSocket Handler ==========

#[derive(Deserialize)]
pub struct WsQuery {
    room: String,
    user_id: String,
    display_name: String,
    avatar_url: Option<String>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<CollabState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, query))
}

/// WebSocketメッセージを送信するヘルパー
async fn ws_send(tx: &mut SplitSink<WebSocket, Message>, text: &str) -> bool {
    tx.send(Message::Text(text.to_string())).await.is_ok()
}

async fn handle_socket(socket: WebSocket, state: CollabState, query: WsQuery) {
    let room_id = query.room.clone();
    let user_id = query.user_id.clone();
    let display_name = query.display_name.clone();
    let avatar_url = query.avatar_url.unwrap_or_default();
    let color = assign_color(&user_id);

    let room = state.get_or_create_room(&room_id);
    let mut rx = room.tx.subscribe();

    // ユーザーを部屋に追加
    room.users.insert(
        user_id.clone(),
        CollabUser {
            user_id: user_id.clone(),
            display_name: display_name.clone(),
            avatar_url: avatar_url.clone(),
            color: color.clone(),
        },
    );

    let (mut ws_tx, ws_rx) = socket.split();

    // 現在のルーム状態を送信
    let users: Vec<CollabUser> = room.users.iter().map(|r| r.value().clone()).collect();
    let locks: Vec<LockInfo> = room.locks.iter().map(|r| r.value().clone()).collect();
    let presences: Vec<UserPresence> = room.presences.iter().map(|r| r.value().clone()).collect();
    if let Ok(json) = serde_json::to_string(&CollabMessage::RoomState { users, locks, presences }) {
        let _ = ws_send(&mut ws_tx, &json).await;
    }

    // 他のユーザーにjoinを通知
    let join_msg = CollabMessage::Join {
        user_id: user_id.clone(),
        display_name: display_name.clone(),
        avatar_url: avatar_url.clone(),
        color: color.clone(),
    };
    if let Ok(json) = serde_json::to_string(&join_msg) {
        let _ = room.tx.send(json);
    }

    let user_id_for_send = user_id.clone();

    // broadcast → WebSocket 転送タスク
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            // 自分のカーソル・プレゼンスメッセージは除外
            if let Ok(
                CollabMessage::Cursor { user_id: ref uid, .. }
                | CollabMessage::Presence { user_id: ref uid, .. },
            ) = serde_json::from_str::<CollabMessage>(&msg)
            {
                if *uid == user_id_for_send {
                    continue;
                }
            }
            if !ws_send(&mut ws_tx, &msg).await {
                break;
            }
        }
    });

    // WebSocket → broadcast 転送タスク
    let room_for_recv = room.clone();
    let user_id_for_recv = user_id.clone();
    let display_name_for_recv = display_name.clone();

    let recv_task = tokio::spawn(async move {
        handle_incoming(ws_rx, &room_for_recv, &user_id_for_recv, &display_name_for_recv).await;
    });

    // どちらかが終了したらクリーンアップ
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // ユーザーのロックをすべて解除
    let user_locks: Vec<String> = room
        .locks
        .iter()
        .filter(|r| r.value().user_id == user_id)
        .map(|r| r.key().clone())
        .collect();
    for resource_id in &user_locks {
        room.locks.remove(resource_id);
        if let Ok(json) = serde_json::to_string(&CollabMessage::Unlock {
            user_id: user_id.clone(),
            resource_id: resource_id.clone(),
        }) {
            let _ = room.tx.send(json);
        }
    }

    // プレゼンスとユーザーを削除して退出を通知
    room.presences.remove(&user_id);
    room.users.remove(&user_id);
    if let Ok(json) = serde_json::to_string(&CollabMessage::Leave {
        user_id: user_id.clone(),
    }) {
        let _ = room.tx.send(json);
    }

    state.cleanup_room(&room_id);
}

/// 受信メッセージの処理
async fn handle_incoming(
    mut ws_rx: SplitStream<WebSocket>,
    room: &Arc<Room>,
    user_id: &str,
    display_name: &str,
) {
    while let Some(Ok(msg)) = ws_rx.next().await {
        let text = match msg {
            Message::Text(t) => t.to_string(),
            Message::Close(_) => break,
            _ => continue,
        };

        let mut collab_msg: CollabMessage = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(_) => continue,
        };

        // サーバー側でuser_idを強制設定
        match &mut collab_msg {
            CollabMessage::Cursor { user_id: uid, .. } => {
                *uid = user_id.to_string();
            }
            CollabMessage::Presence {
                user_id: uid,
                scene_id,
                scene_name,
                selected_node_ids,
                selected_node_names,
                view_tab,
            } => {
                *uid = user_id.to_string();
                room.presences.insert(
                    user_id.to_string(),
                    UserPresence {
                        user_id: user_id.to_string(),
                        scene_id: scene_id.clone(),
                        scene_name: scene_name.clone(),
                        selected_node_ids: selected_node_ids.clone(),
                        selected_node_names: selected_node_names.clone(),
                        view_tab: view_tab.clone(),
                    },
                );
            }
            CollabMessage::Lock {
                user_id: uid,
                resource_id,
                resource_name,
            } => {
                *uid = user_id.to_string();
                let rid = resource_id.clone();
                let rname = resource_name.clone();
                let (granted, held_by) = if let Some(existing) = room.locks.get(&rid) {
                    let is_mine = existing.user_id == user_id;
                    let holder = if !is_mine {
                        Some(existing.display_name.clone())
                    } else {
                        None
                    };
                    (is_mine, holder)
                } else {
                    room.locks.insert(
                        rid.clone(),
                        LockInfo {
                            resource_id: rid.clone(),
                            resource_name: rname,
                            user_id: user_id.to_string(),
                            display_name: display_name.to_string(),
                        },
                    );
                    (true, None)
                };
                if let Ok(json) = serde_json::to_string(&CollabMessage::LockResult {
                    resource_id: rid,
                    granted,
                    held_by,
                }) {
                    let _ = room.tx.send(json);
                }
            }
            CollabMessage::Unlock {
                user_id: uid,
                resource_id,
            } => {
                *uid = user_id.to_string();
                if let Some(lock) = room.locks.get(resource_id) {
                    if lock.user_id == user_id {
                        drop(lock);
                        room.locks.remove(resource_id);
                    }
                }
            }
            _ => {}
        }

        if let Ok(json) = serde_json::to_string(&collab_msg) {
            let _ = room.tx.send(json);
        }
    }
}

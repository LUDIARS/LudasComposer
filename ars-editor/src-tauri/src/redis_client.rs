/// Redis セッション管理クライアント
///
/// セッションデータをRedisで管理する。TTL付きで自動期限切れをサポート。
use redis::aio::ConnectionManager;
use redis::AsyncCommands;

use crate::auth::Session;

const SESSION_PREFIX: &str = "session:";
const SESSION_TTL_SECS: u64 = 7 * 24 * 60 * 60; // 7 days

#[derive(Clone)]
pub struct RedisClient {
    conn: ConnectionManager,
}

impl RedisClient {
    pub async fn new(redis_url: &str) -> Result<Self, String> {
        let client = redis::Client::open(redis_url)
            .map_err(|e| format!("Redis client creation failed: {}", e))?;
        let conn = ConnectionManager::new(client)
            .await
            .map_err(|e| format!("Redis connection failed: {}", e))?;
        Ok(Self { conn })
    }

    fn session_key(session_id: &str) -> String {
        format!("{}{}", SESSION_PREFIX, session_id)
    }

    pub async fn put_session(&self, session: &Session) -> Result<(), String> {
        let mut conn = self.conn.clone();
        let key = Self::session_key(&session.id);
        let json = serde_json::to_string(session)
            .map_err(|e| format!("Failed to serialize session: {}", e))?;

        conn.set_ex::<_, _, ()>(&key, &json, SESSION_TTL_SECS)
            .await
            .map_err(|e| format!("Redis put_session failed: {}", e))?;
        Ok(())
    }

    pub async fn get_session(&self, session_id: &str) -> Result<Option<Session>, String> {
        let mut conn = self.conn.clone();
        let key = Self::session_key(session_id);

        let value: Option<String> = conn
            .get(&key)
            .await
            .map_err(|e| format!("Redis get_session failed: {}", e))?;

        match value {
            Some(json) => {
                let session: Session = serde_json::from_str(&json)
                    .map_err(|e| format!("Failed to deserialize session: {}", e))?;
                Ok(Some(session))
            }
            None => Ok(None),
        }
    }

    pub async fn delete_session(&self, session_id: &str) -> Result<(), String> {
        let mut conn = self.conn.clone();
        let key = Self::session_key(session_id);

        conn.del::<_, ()>(&key)
            .await
            .map_err(|e| format!("Redis delete_session failed: {}", e))?;
        Ok(())
    }
}

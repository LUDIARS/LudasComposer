/// Redis セッション管理クライアント
///
/// セッションデータをRedisで管理する。TTL付きで自動期限切れをサポート。
use redis::aio::ConnectionManager;
use redis::AsyncCommands;

use ars_core::models::Session;

const SESSION_PREFIX: &str = "session:";
/// デフォルト TTL（秒）。AppState から Infisical 値で上書き可能。
const DEFAULT_SESSION_TTL_SECS: u64 = 7 * 24 * 60 * 60;

#[derive(Clone)]
pub struct RedisClient {
    conn: ConnectionManager,
    session_ttl_secs: u64,
}

impl RedisClient {
    pub async fn new(redis_url: &str) -> Result<Self, String> {
        Self::with_ttl(redis_url, DEFAULT_SESSION_TTL_SECS).await
    }

    pub async fn with_ttl(redis_url: &str, session_ttl_secs: u64) -> Result<Self, String> {
        let client = redis::Client::open(redis_url)
            .map_err(|e| format!("Redis client creation failed: {}", e))?;
        let conn = ConnectionManager::new(client)
            .await
            .map_err(|e| format!("Redis connection failed: {}", e))?;
        Ok(Self { conn, session_ttl_secs })
    }

    fn session_key(session_id: &str) -> String {
        format!("{}{}", SESSION_PREFIX, session_id)
    }

    pub async fn put_session(&self, session: &Session) -> Result<(), String> {
        let mut conn = self.conn.clone();
        let key = Self::session_key(&session.id);
        let json = serde_json::to_string(session)
            .map_err(|e| format!("Failed to serialize session: {}", e))?;

        conn.set_ex::<_, _, ()>(&key, &json, self.session_ttl_secs)
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

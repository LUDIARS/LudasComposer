use std::collections::HashMap;
use std::time::{Duration, Instant};

use tokio::sync::RwLock;

/// In-memory cache with per-entry TTL.
pub struct SecretCache {
    entries: RwLock<HashMap<String, CacheEntry>>,
    ttl: Duration,
}

struct CacheEntry {
    value: String,
    inserted_at: Instant,
}

impl SecretCache {
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
            ttl: Duration::from_secs(ttl_secs),
        }
    }

    /// Get a cached value if it exists and hasn't expired.
    pub async fn get(&self, key: &str) -> Option<String> {
        let map = self.entries.read().await;
        let entry = map.get(key)?;
        if entry.inserted_at.elapsed() < self.ttl {
            Some(entry.value.clone())
        } else {
            None
        }
    }

    /// Insert or update a cache entry.
    pub async fn set(&self, key: String, value: String) {
        let mut map = self.entries.write().await;
        map.insert(
            key,
            CacheEntry {
                value,
                inserted_at: Instant::now(),
            },
        );
    }

    /// Remove a specific entry.
    pub async fn invalidate(&self, key: &str) {
        let mut map = self.entries.write().await;
        map.remove(key);
    }

    /// Remove all entries.
    pub async fn invalidate_all(&self) {
        let mut map = self.entries.write().await;
        map.clear();
    }
}

use crate::models::ticket::Ticket;
use std::time::{Duration, Instant};

pub struct TicketCache {
    tickets: Vec<Ticket>,
    last_updated: Option<Instant>,
    cache_duration: Duration,
}

impl TicketCache {
    pub fn new(cache_duration_minutes: u64) -> Self {
        Self {
            tickets: Vec::new(),
            last_updated: None,
            cache_duration: Duration::from_secs(cache_duration_minutes * 60),
        }
    }

    pub fn is_expired(&self) -> bool {
        match self.last_updated {
            Some(t) => t.elapsed() > self.cache_duration,
            None => true,
        }
    }

    pub fn update(&mut self, tickets: Vec<Ticket>) {
        self.tickets = tickets;
        self.last_updated = Some(Instant::now());
    }

    pub fn get_all(&self) -> &[Ticket] {
        &self.tickets
    }

    pub fn get_by_scene(&self, scene_name: &str) -> Vec<&Ticket> {
        self.tickets
            .iter()
            .filter(|t| t.scene_name.as_deref() == Some(scene_name))
            .collect()
    }

    pub fn get_by_object_path(&self, path: &str) -> Vec<&Ticket> {
        self.tickets
            .iter()
            .filter(|t| t.object_path.as_deref() == Some(path))
            .collect()
    }

    pub fn get_near_position(&self, position: [f64; 3], radius: f64) -> Vec<&Ticket> {
        self.tickets
            .iter()
            .filter(|t| {
                if let Some(pos) = t.world_position {
                    let dx = pos[0] - position[0];
                    let dy = pos[1] - position[1];
                    let dz = pos[2] - position[2];
                    (dx * dx + dy * dy + dz * dz).sqrt() <= radius
                } else {
                    false
                }
            })
            .collect()
    }

    pub fn find_by_id(&self, id: &str) -> Option<&Ticket> {
        self.tickets.iter().find(|t| t.id == id)
    }

    pub fn find_by_issue_number(&self, number: u64) -> Option<&Ticket> {
        self.tickets
            .iter()
            .find(|t| t.github_issue_number == Some(number))
    }

    pub fn stats(&self) -> CacheStats {
        let open = self.tickets.iter().filter(|t| t.state == "open").count();
        let closed = self.tickets.iter().filter(|t| t.state == "closed").count();
        CacheStats {
            total: self.tickets.len(),
            open,
            closed,
            is_expired: self.is_expired(),
        }
    }

    pub fn clear(&mut self) {
        self.tickets.clear();
        self.last_updated = None;
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CacheStats {
    pub total: usize,
    pub open: usize,
    pub closed: usize,
    pub is_expired: bool,
}

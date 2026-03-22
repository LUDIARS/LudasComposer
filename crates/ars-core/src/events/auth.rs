use crate::event::ArsEvent;

#[derive(Debug, Clone)]
pub struct UserAuthenticated {
    pub user_id: String,
}

impl ArsEvent for UserAuthenticated {
    fn source_module(&self) -> &'static str { "auth" }
    fn category(&self) -> &'static str { "auth" }
}

#[derive(Debug, Clone)]
pub struct UserLoggedOut;

impl ArsEvent for UserLoggedOut {
    fn source_module(&self) -> &'static str { "auth" }
    fn category(&self) -> &'static str { "auth" }
}

use crate::event::ArsEvent;

#[derive(Debug, Clone)]
pub struct AssemblyConfigChanged {
    pub project_id: String,
}

impl ArsEvent for AssemblyConfigChanged {
    fn source_module(&self) -> &'static str { "assembly" }
    fn category(&self) -> &'static str { "assembly" }
}

#[derive(Debug, Clone)]
pub struct PlatformChanged {
    pub platform: String,
}

impl ArsEvent for PlatformChanged {
    fn source_module(&self) -> &'static str { "assembly" }
    fn category(&self) -> &'static str { "assembly" }
}

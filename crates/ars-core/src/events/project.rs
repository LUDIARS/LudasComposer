use std::path::PathBuf;
use crate::event::ArsEvent;

#[derive(Debug, Clone)]
pub struct ProjectOpened {
    pub project_id: String,
    pub project_root: PathBuf,
}

impl ArsEvent for ProjectOpened {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "project.lifecycle" }
}

#[derive(Debug, Clone)]
pub struct ProjectClosed {
    pub project_id: String,
}

impl ArsEvent for ProjectClosed {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "project.lifecycle" }
}

#[derive(Debug, Clone)]
pub struct ProjectSaved {
    pub project_id: String,
}

impl ArsEvent for ProjectSaved {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "project.lifecycle" }
}

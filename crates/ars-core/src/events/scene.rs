use crate::event::ArsEvent;

#[derive(Debug, Clone)]
pub struct SceneActivated {
    pub scene_id: String,
}

impl ArsEvent for SceneActivated {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}

#[derive(Debug, Clone)]
pub struct ActorAdded {
    pub scene_id: String,
    pub actor_id: String,
}

impl ArsEvent for ActorAdded {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}

#[derive(Debug, Clone)]
pub struct ActorRemoved {
    pub scene_id: String,
    pub actor_id: String,
}

impl ArsEvent for ActorRemoved {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}

#[derive(Debug, Clone)]
pub struct ComponentAttached {
    pub actor_id: String,
    pub component_id: String,
}

impl ArsEvent for ComponentAttached {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}

#[derive(Debug, Clone)]
pub struct ComponentDetached {
    pub actor_id: String,
    pub component_id: String,
}

impl ArsEvent for ComponentDetached {
    fn source_module(&self) -> &'static str { "core" }
    fn category(&self) -> &'static str { "scene" }
}

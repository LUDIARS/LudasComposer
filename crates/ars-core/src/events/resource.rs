use crate::event::ArsEvent;

#[derive(Debug, Clone)]
pub struct ResourceImported {
    pub resource_id: String,
    pub resource_type: String,
}

impl ArsEvent for ResourceImported {
    fn source_module(&self) -> &'static str { "resource-depot" }
    fn category(&self) -> &'static str { "resource" }
}

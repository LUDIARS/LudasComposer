pub mod schema;
pub mod master_data;
pub mod blackboard;
pub mod user_data;
pub mod organizer;
pub mod error;

pub use error::DataOrganizerError;
pub use master_data::{MasterDataEntry, MasterDataRegistry};
pub use blackboard::Blackboard;
pub use user_data::{UserDataStore, PersistenceMarker};
pub use organizer::DataOrganizer;
pub use schema::{DataSchema, FieldDefinition, FieldType, FieldVisibility};

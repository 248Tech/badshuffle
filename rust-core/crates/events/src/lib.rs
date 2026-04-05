use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineEvent {
    pub event_type: String,
    pub entity_type: String,
    pub entity_id: String,
}

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InventoryAction {
    QuoteItems,
    QuoteSummary,
    Conflicts,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryCheckRequest {
    pub action: InventoryAction,
    pub quote_id: i64,
    #[serde(default)]
    pub item_ids: Vec<i64>,
    #[serde(default)]
    pub section_id: Option<i64>,
    #[serde(default)]
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingCheckRequest {
    pub quote_id: i64,
    #[serde(default)]
    pub explicit_tax_rate: Option<f64>,
    #[serde(default)]
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AvailabilityEntry {
    pub stock: i64,
    pub reserved_qty: i64,
    pub potential_qty: i64,
    #[serde(default)]
    pub set_aside_qty: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QuoteConflictEntry {
    pub status: String,
    pub reserved_qty: i64,
    pub potential_qty: i64,
    pub stock: i64,
    pub my_qty: i64,
    #[serde(default)]
    pub set_aside_qty: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QuoteSummaryResult {
    pub has_range: bool,
    pub conflicts: BTreeMap<String, QuoteConflictEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConflictListItem {
    pub item_id: i64,
    pub title: String,
    pub status: String,
    pub quantity_needed: i64,
    pub stock: i64,
    pub reserved_qty: i64,
    pub potential_qty: i64,
    #[serde(default)]
    pub set_aside_qty: i64,
    pub shortage: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConflictListQuote {
    pub quote_id: i64,
    pub quote_name: Option<String>,
    pub event_date: Option<String>,
    pub rental_start: Option<String>,
    pub rental_end: Option<String>,
    pub delivery_date: Option<String>,
    pub pickup_date: Option<String>,
    pub is_reserved: bool,
    pub status: Option<String>,
    pub items: Vec<ConflictListItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConflictsResult {
    pub conflicts: Vec<ConflictListQuote>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum InventoryCheckResult {
    QuoteItems {
        result: BTreeMap<String, AvailabilityEntry>,
    },
    QuoteSummary {
        result: QuoteSummaryResult,
    },
    Conflicts {
        result: ConflictsResult,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryCheckResponse {
    pub action: InventoryAction,
    #[serde(flatten)]
    pub result: InventoryCheckResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuotePricingResult {
    pub subtotal: f64,
    pub delivery_total: f64,
    pub custom_subtotal: f64,
    pub adjustment_total: f64,
    pub taxable_amount: f64,
    pub tax_rate: f64,
    pub tax: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PricingCheckResponse {
    pub quote_id: i64,
    pub result: QuotePricingResult,
}

#[derive(Debug, thiserror::Error)]
pub enum InventoryContractError {
    #[error("invalid quote id")]
    InvalidQuoteId,
}

pub mod discord_reader;
pub mod github;
pub mod gitlab;
pub mod jira;
pub mod confluence;
pub mod mcp;

use async_trait::async_trait;
use chrono::NaiveDate;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CollectedData {
    pub source: String,
    pub raw: serde_json::Value,
}

#[async_trait]
pub trait Connector: Send + Sync {
    fn name(&self) -> &str;
    fn is_enabled(&self) -> bool;
    async fn collect(&self, date: &NaiveDate) -> Result<CollectedData, String>;
    fn format_toon(&self, data: &CollectedData) -> String;
}

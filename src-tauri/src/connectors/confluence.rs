use async_trait::async_trait;
use chrono::NaiveDate;

use super::mcp::McpClient;
use super::{CollectedData, Connector};
use crate::config::McpConnectorConfig;
use crate::keychain;

pub struct ConfluenceConnector {
    config: McpConnectorConfig,
}

impl ConfluenceConnector {
    pub fn new(config: McpConnectorConfig) -> Self {
        Self { config }
    }

    fn client(&self) -> Result<McpClient, String> {
        let token = keychain::get_connector_token("confluence").ok();
        Ok(McpClient::new(&self.config.mcp_url, token))
    }
}

#[async_trait]
impl Connector for ConfluenceConnector {
    fn name(&self) -> &str {
        "confluence"
    }

    fn is_enabled(&self) -> bool {
        self.config.enabled && !self.config.mcp_url.is_empty()
    }

    async fn collect(&self, date: &NaiveDate) -> Result<CollectedData, String> {
        let client = self.client()?;
        let date_str = date.format("%Y-%m-%d").to_string();

        // CQL: pages created or modified by current user on this date
        let cql = format!(
            "(creator = currentUser() AND created >= \"{}\") \
             OR (contributor = currentUser() AND lastModified >= \"{}\" AND lastModified < \"{}\") \
             ORDER BY lastModified DESC",
            date_str, date_str,
            (*date + chrono::Duration::days(1)).format("%Y-%m-%d"),
        );

        let result = client
            .call_tool(
                "confluence_search",
                serde_json::json!({
                    "cql": cql,
                    "limit": 50
                }),
            )
            .await?;

        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap_or_default();

        Ok(CollectedData {
            source: "confluence".to_string(),
            raw: parsed,
        })
    }

    fn format_toon(&self, data: &CollectedData) -> String {
        let mut output = String::new();

        let empty = vec![];
        let pages = data.raw["results"]
            .as_array()
            .or_else(|| data.raw.as_array())
            .unwrap_or(&empty);

        if pages.is_empty() {
            return output;
        }

        output.push_str(&format!(
            "confluence_pages[{}]{{id,title,space,status,last_updated,url}}:\n",
            pages.len()
        ));

        for page in pages {
            let id = page["id"].as_str().unwrap_or("");
            let title = page["title"].as_str().unwrap_or("").replace(',', ";");
            let space = page["space"]["name"].as_str()
                .or_else(|| page["space"]["key"].as_str())
                .unwrap_or("");
            let status = page["status"].as_str().unwrap_or("");
            let updated = page["version"]["when"].as_str()
                .or_else(|| page["lastModified"].as_str())
                .unwrap_or("");
            let url = page["_links"]["webui"].as_str().unwrap_or("");
            output.push_str(&format!(" {},{},{},{},{},{}\n", id, title, space, status, updated, url));
        }

        output
    }
}

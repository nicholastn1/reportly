use async_trait::async_trait;
use chrono::NaiveDate;

use super::mcp::McpClient;
use super::{CollectedData, Connector};
use crate::config::McpConnectorConfig;
use crate::keychain;

pub struct JiraConnector {
    config: McpConnectorConfig,
}

impl JiraConnector {
    pub fn new(config: McpConnectorConfig) -> Self {
        Self { config }
    }

    fn client(&self) -> Result<McpClient, String> {
        let token = keychain::get_connector_token("jira").ok();
        Ok(McpClient::new(&self.config.mcp_url, token))
    }
}

#[async_trait]
impl Connector for JiraConnector {
    fn name(&self) -> &str {
        "jira"
    }

    fn is_enabled(&self) -> bool {
        self.config.enabled && !self.config.mcp_url.is_empty()
    }

    async fn collect(&self, date: &NaiveDate) -> Result<CollectedData, String> {
        let client = self.client()?;
        let date_str = date.format("%Y-%m-%d").to_string();

        // Comprehensive JQL: everything the user touched on this date
        // - Assigned to me AND updated on this date
        // - Status changed on this date (transitions)
        // - I commented on this date
        // - Created by me on this date
        let jql = format!(
            "(assignee = currentUser() AND updated >= \"{}\" AND updated < \"{} 23:59\") \
             OR (status CHANGED DURING (\"{}\", \"{} 23:59\") BY currentUser()) \
             OR (creator = currentUser() AND created >= \"{}\" AND created < \"{} 23:59\") \
             ORDER BY updated DESC",
            date_str, date_str,
            date_str, date_str,
            date_str, date_str,
        );

        let result = client
            .call_tool(
                "jira_search",
                serde_json::json!({
                    "jql": jql,
                    "limit": 50
                }),
            )
            .await?;

        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap_or_default();

        Ok(CollectedData {
            source: "jira".to_string(),
            raw: parsed,
        })
    }

    fn format_toon(&self, data: &CollectedData) -> String {
        let mut output = String::new();

        let empty = vec![];
        let issues = data.raw["issues"]
            .as_array()
            .or_else(|| data.raw.as_array())
            .unwrap_or(&empty);

        if issues.is_empty() {
            return output;
        }

        output.push_str(&format!(
            "jira_issues[{}]{{key,summary,type,status,priority,assignee,updated}}:\n",
            issues.len()
        ));

        for issue in issues {
            let key = issue["key"].as_str().unwrap_or("");
            let fields = &issue["fields"];
            let summary = fields["summary"].as_str().unwrap_or("").replace(',', ";");
            let issuetype = fields["issuetype"]["name"].as_str().unwrap_or("");
            let status = fields["status"]["name"].as_str().unwrap_or("");
            let priority = fields["priority"]["name"].as_str().unwrap_or("");
            let assignee = fields["assignee"]["displayName"].as_str().unwrap_or("");
            let updated = fields["updated"].as_str().unwrap_or("");
            output.push_str(&format!(
                " {},{},{},{},{},{},{}\n",
                key, summary, issuetype, status, priority, assignee, updated
            ));
        }

        output
    }
}

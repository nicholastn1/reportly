use async_trait::async_trait;
use chrono::NaiveDate;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};

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

    fn auth_header(&self) -> Result<String, String> {
        let email = self.config.email.as_deref().unwrap_or_default();
        let token = keychain::get_connector_token("jira")
            .or_else(|_| keychain::get_connector_token("confluence"))
            .map_err(|_| "Atlassian API token não configurado no Keychain".to_string())?;
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", email, token));
        Ok(format!("Basic {}", encoded))
    }
}

#[async_trait]
impl Connector for JiraConnector {
    fn name(&self) -> &str {
        "jira"
    }

    fn is_enabled(&self) -> bool {
        self.config.enabled && self.config.instance_url.as_ref().map_or(false, |u| !u.is_empty())
    }

    async fn collect(&self, date: &NaiveDate) -> Result<CollectedData, String> {
        let instance_url = self.config.instance_url.as_deref()
            .ok_or("Jira instance_url não configurada")?;
        let auth = self.auth_header()?;
        let date_str = date.format("%Y-%m-%d").to_string();

        let jql = format!(
            "(assignee = currentUser() AND updated >= \"{}\" AND updated < \"{} 23:59\") \
             OR (status CHANGED DURING (\"{}\", \"{} 23:59\") BY currentUser()) \
             OR (creator = currentUser() AND created >= \"{}\" AND created < \"{} 23:59\") \
             ORDER BY updated DESC",
            date_str, date_str,
            date_str, date_str,
            date_str, date_str,
        );

        let url = format!("{}/rest/api/3/search/jql", instance_url.trim_end_matches('/'));

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&auth).map_err(|e| e.to_string())?);

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| e.to_string())?;

        let body = serde_json::json!({
            "jql": jql,
            "maxResults": 50,
            "fields": ["key", "summary", "issuetype", "status", "priority", "assignee", "updated"]
        });

        let response = client
            .post(&url)
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Jira request failed: {}", e))?;

        let status = response.status();
        let text = response.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Jira API error ({}): {}", status, &text[..text.len().min(200)]));
        }

        let parsed: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| format!("Jira parse error: {}", e))?;

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

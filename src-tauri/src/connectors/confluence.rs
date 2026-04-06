use async_trait::async_trait;
use chrono::NaiveDate;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};

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

    fn auth_header(&self) -> Result<String, String> {
        let email = self.config.email.as_deref().unwrap_or_default();
        let token = keychain::get_connector_token("confluence")
            .or_else(|_| keychain::get_connector_token("jira"))
            .map_err(|_| "Atlassian API token não configurado no Keychain".to_string())?;
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", email, token));
        Ok(format!("Basic {}", encoded))
    }
}

#[async_trait]
impl Connector for ConfluenceConnector {
    fn name(&self) -> &str {
        "confluence"
    }

    fn is_enabled(&self) -> bool {
        self.config.enabled && self.config.instance_url.as_ref().is_some_and(|u| !u.is_empty())
    }

    async fn collect(&self, date: &NaiveDate) -> Result<CollectedData, String> {
        let instance_url = self.config.instance_url.as_deref()
            .ok_or("Confluence instance_url não configurada")?;
        let auth = self.auth_header()?;
        let date_str = date.format("%Y-%m-%d").to_string();
        let next_day = (*date + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

        let cql = format!(
            "(creator = currentUser() AND created >= \"{}\") \
             OR (contributor = currentUser() AND lastModified >= \"{}\" AND lastModified < \"{}\") \
             ORDER BY lastModified DESC",
            date_str, date_str, next_day,
        );

        let url = format!(
            "{}/wiki/rest/api/content/search",
            instance_url.trim_end_matches('/')
        );

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&auth).map_err(|e| e.to_string())?);

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| e.to_string())?;

        let response = client
            .get(&url)
            .headers(headers)
            .query(&[("cql", &cql), ("limit", &"50".to_string()), ("expand", &"space,version".to_string())])
            .send()
            .await
            .map_err(|e| format!("Confluence request failed: {}", e))?;

        let status = response.status();
        let text = response.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Confluence API error ({}): {}", status, &text[..text.len().min(200)]));
        }

        let parsed: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| format!("Confluence parse error: {}", e))?;

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

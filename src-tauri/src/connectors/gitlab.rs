use async_trait::async_trait;
use chrono::NaiveDate;
use serde::Deserialize;
use std::process::Command;

use super::{CollectedData, Connector};
use crate::config::CliConnectorConfig;

pub struct GitLabConnector {
    config: CliConnectorConfig,
}

impl GitLabConnector {
    pub fn new(config: CliConnectorConfig) -> Self {
        Self { config }
    }

    fn glab(&self, args: &[&str]) -> Result<String, String> {
        let mut cmd = Command::new("glab");
        if let Some(ref host) = self.config.hostname {
            cmd.args(["--hostname", host]);
        }
        cmd.args(args);
        let output = cmd.output().map_err(|e| format!("glab not found: {}", e))?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("glab error: {}", err))
        }
    }

    fn get_username(&self) -> Result<String, String> {
        if let Some(ref u) = self.config.username {
            return Ok(u.clone());
        }
        let output = self.glab(&["api", "/user"])?;
        let parsed: serde_json::Value = serde_json::from_str(&output)
            .map_err(|e| format!("parse user: {}", e))?;
        parsed["username"].as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "could not detect gitlab username".to_string())
    }
}

#[derive(Debug, Deserialize)]
struct GlabMr {
    iid: u64,
    title: String,
    state: String,
    web_url: String,
    source_branch: String,
}

#[derive(Debug, Deserialize)]
struct GlabEvent {
    action_name: Option<String>,
    target_title: Option<String>,
    target_type: Option<String>,
    push_data: Option<serde_json::Value>,
    created_at: Option<String>,
}

#[async_trait]
impl Connector for GitLabConnector {
    fn name(&self) -> &str {
        "gitlab"
    }

    fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    async fn collect(&self, date: &NaiveDate) -> Result<CollectedData, String> {
        let username = GitLabConnector::get_username(self)?;
        let date_str = date.format("%Y-%m-%d").to_string();

        // Get user events for the date via API
        let events_json = self.glab(&[
            "api", "/events",
            "-X", "GET",
            "-f", &format!("after={}", (*date - chrono::Duration::days(1)).format("%Y-%m-%d")),
            "-f", &format!("before={}", (*date + chrono::Duration::days(1)).format("%Y-%m-%d")),
            "-f", "per_page=100",
        ]).unwrap_or_else(|_| "[]".to_string());

        // Get MRs authored by me, updated on this date
        let mrs_json = self.glab(&[
            "api", "/merge_requests",
            "-X", "GET",
            "-f", "scope=all",
            "-f", &format!("author_username={}", username),
            "-f", &format!("updated_after={}T00:00:00Z", date_str),
            "-f", &format!("updated_before={}T23:59:59Z", date_str),
            "-f", "per_page=50",
        ]).unwrap_or_else(|_| "[]".to_string());

        let events: Vec<GlabEvent> = serde_json::from_str(&events_json).unwrap_or_default();
        let mrs: Vec<GlabMr> = serde_json::from_str(&mrs_json).unwrap_or_default();

        Ok(CollectedData {
            source: "gitlab".to_string(),
            raw: serde_json::json!({
                "events": events.len(),
                "merge_requests": mrs.iter().map(|mr| serde_json::json!({
                    "iid": mr.iid,
                    "title": mr.title,
                    "state": mr.state,
                    "web_url": mr.web_url,
                    "source_branch": mr.source_branch,
                })).collect::<Vec<_>>(),
                "event_details": events.iter().filter_map(|e| {
                    Some(serde_json::json!({
                        "action": e.action_name.as_deref()?,
                        "target": e.target_title.as_deref().unwrap_or(""),
                        "type": e.target_type.as_deref().unwrap_or(""),
                        "date": e.created_at.as_deref().unwrap_or(""),
                    }))
                }).collect::<Vec<_>>(),
            }),
        })
    }

    fn format_toon(&self, data: &CollectedData) -> String {
        let mut output = String::new();

        if let Some(mrs) = data.raw["merge_requests"].as_array() {
            if !mrs.is_empty() {
                output.push_str(&format!(
                    "merge_requests[{}]{{iid,title,state,branch,url}}:\n",
                    mrs.len()
                ));
                for mr in mrs {
                    let iid = mr["iid"].as_u64().unwrap_or(0);
                    let title = mr["title"].as_str().unwrap_or("").replace(',', ";");
                    let state = mr["state"].as_str().unwrap_or("");
                    let branch = mr["source_branch"].as_str().unwrap_or("");
                    let url = mr["web_url"].as_str().unwrap_or("");
                    output.push_str(&format!(" !{},{},{},{},{}\n", iid, title, state, branch, url));
                }
                output.push('\n');
            }
        }

        if let Some(events) = data.raw["event_details"].as_array() {
            if !events.is_empty() {
                output.push_str(&format!("events[{}]{{action,target,type}}:\n", events.len()));
                for e in events {
                    let action = e["action"].as_str().unwrap_or("");
                    let target = e["target"].as_str().unwrap_or("").replace(',', ";");
                    let etype = e["type"].as_str().unwrap_or("");
                    output.push_str(&format!(" {},{},{}\n", action, target, etype));
                }
            }
        }

        output
    }
}

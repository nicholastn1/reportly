use async_trait::async_trait;
use chrono::NaiveDate;
use std::process::Command;

use super::{CollectedData, Connector};
use crate::config::CliConnectorConfig;

pub struct GitHubConnector {
    config: CliConnectorConfig,
}

impl GitHubConnector {
    pub fn new(config: CliConnectorConfig) -> Self {
        Self { config }
    }

    fn gh(&self, args: &[&str]) -> Result<String, String> {
        let output = Command::new("gh")
            .args(args)
            .output()
            .map_err(|e| format!("gh not found: {}", e))?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("gh error: {}", err))
        }
    }

    fn get_username(&self) -> Result<String, String> {
        if let Some(ref u) = self.config.username {
            return Ok(u.clone());
        }
        let output = self.gh(&["api", "/user", "--jq", ".login"])?;
        Ok(output.trim().to_string())
    }
}

#[async_trait]
impl Connector for GitHubConnector {
    fn name(&self) -> &str {
        "github"
    }

    fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    async fn collect(&self, date: &NaiveDate) -> Result<CollectedData, String> {
        let username = self.get_username()?;
        let date_str = date.format("%Y-%m-%d").to_string();

        // Search PRs authored by user on this date
        let prs_query = format!("author:{} created:{}", username, date_str);
        let prs_json = self.gh(&[
            "api", "search/issues",
            "-f", &format!("q={} is:pr", prs_query),
            "-f", "per_page=50",
            "--jq", ".items",
        ]).unwrap_or_else(|_| "[]".to_string());

        // Search PRs reviewed by user on this date
        let reviews_query = format!("reviewed-by:{} updated:{}", username, date_str);
        let reviews_json = self.gh(&[
            "api", "search/issues",
            "-f", &format!("q={} is:pr", reviews_query),
            "-f", "per_page=50",
            "--jq", ".items",
        ]).unwrap_or_else(|_| "[]".to_string());

        // User events (pushes, issues, etc)
        let events_json = self.gh(&[
            "api", &format!("/users/{}/events?per_page=100", username),
        ]).unwrap_or_else(|_| "[]".to_string());

        let prs: Vec<serde_json::Value> = serde_json::from_str(&prs_json).unwrap_or_default();
        let reviews: Vec<serde_json::Value> = serde_json::from_str(&reviews_json).unwrap_or_default();
        let events: Vec<serde_json::Value> = serde_json::from_str(&events_json).unwrap_or_default();

        // Filter events to the target date
        let date_prefix = date_str.clone();
        let day_events: Vec<_> = events.iter().filter(|e| {
            e["created_at"].as_str()
                .map(|d| d.starts_with(&date_prefix))
                .unwrap_or(false)
        }).cloned().collect();

        Ok(CollectedData {
            source: "github".to_string(),
            raw: serde_json::json!({
                "prs_authored": prs,
                "prs_reviewed": reviews,
                "events": day_events,
            }),
        })
    }

    fn format_toon(&self, data: &CollectedData) -> String {
        let mut output = String::new();

        if let Some(prs) = data.raw["prs_authored"].as_array() {
            if !prs.is_empty() {
                output.push_str(&format!("authored_prs[{}]{{number,title,state,repo,url}}:\n", prs.len()));
                for pr in prs {
                    let num = pr["number"].as_u64().unwrap_or(0);
                    let title = pr["title"].as_str().unwrap_or("").replace(',', ";");
                    let state = pr["state"].as_str().unwrap_or("");
                    let repo = pr["repository_url"].as_str().unwrap_or("")
                        .split("/repos/").last().unwrap_or("");
                    let url = pr["html_url"].as_str().unwrap_or("");
                    output.push_str(&format!(" #{},{},{},{},{}\n", num, title, state, repo, url));
                }
                output.push('\n');
            }
        }

        if let Some(prs) = data.raw["prs_reviewed"].as_array() {
            if !prs.is_empty() {
                output.push_str(&format!("reviewed_prs[{}]{{number,title,repo,url}}:\n", prs.len()));
                for pr in prs {
                    let num = pr["number"].as_u64().unwrap_or(0);
                    let title = pr["title"].as_str().unwrap_or("").replace(',', ";");
                    let repo = pr["repository_url"].as_str().unwrap_or("")
                        .split("/repos/").last().unwrap_or("");
                    let url = pr["html_url"].as_str().unwrap_or("");
                    output.push_str(&format!(" #{},{},{},{}\n", num, title, repo, url));
                }
                output.push('\n');
            }
        }

        if let Some(events) = data.raw["events"].as_array() {
            // Summarize push events
            let pushes: Vec<_> = events.iter()
                .filter(|e| e["type"].as_str() == Some("PushEvent"))
                .collect();
            if !pushes.is_empty() {
                output.push_str(&format!("pushes[{}]{{repo,commits}}:\n", pushes.len()));
                for push in &pushes {
                    let repo = push["repo"]["name"].as_str().unwrap_or("");
                    let commits = push["payload"]["size"].as_u64().unwrap_or(0);
                    output.push_str(&format!(" {},{} commits\n", repo, commits));
                }
            }
        }

        output
    }
}

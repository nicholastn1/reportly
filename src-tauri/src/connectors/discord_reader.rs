use async_trait::async_trait;
use chrono::{NaiveDate, NaiveDateTime, TimeZone, Utc};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, USER_AGENT};
use serde::Deserialize;

use super::{CollectedData, Connector};
use crate::config::DiscordReadConfig;
use crate::keychain;

const BASE_URL: &str = "https://discord.com/api/v9";
const DISCORD_EPOCH: u64 = 1420070400000; // Discord epoch in ms

pub struct DiscordReaderConnector {
    config: DiscordReadConfig,
}

impl DiscordReaderConnector {
    pub fn new(config: DiscordReadConfig) -> Self {
        Self { config }
    }

    fn headers(&self) -> Result<HeaderMap, String> {
        let token = keychain::get_token()?;
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&token).map_err(|e| e.to_string())?);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"),
        );
        Ok(headers)
    }

    fn snowflake_to_date(&self, id: &str) -> Option<NaiveDate> {
        let id_num: u64 = id.parse().ok()?;
        let timestamp_ms = (id_num >> 22) + DISCORD_EPOCH;
        let dt = Utc.timestamp_millis_opt(timestamp_ms as i64).single()?;
        Some(dt.date_naive())
    }

    async fn list_channels(&self) -> Result<Vec<Channel>, String> {
        let client = reqwest::Client::new();
        let resp = client
            .get(format!("{}/users/@me/channels", BASE_URL))
            .headers(self.headers()?)
            .send()
            .await
            .map_err(|e| format!("Discord channels error: {}", e))?;

        let text = resp.text().await.map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| format!("Parse channels error: {}", e))
    }

    async fn fetch_messages(
        &self,
        channel_id: &str,
        date: &NaiveDate,
    ) -> Result<Vec<Message>, String> {
        let client = reqwest::Client::new();
        let headers = self.headers()?;
        let mut all_messages = Vec::new();
        let mut before: Option<String> = None;

        loop {
            let mut url = format!("{}/channels/{}/messages?limit=100", BASE_URL, channel_id);
            if let Some(ref b) = before {
                url.push_str(&format!("&before={}", b));
            }

            let resp = client
                .get(&url)
                .headers(headers.clone())
                .send()
                .await
                .map_err(|e| format!("Discord messages error: {}", e))?;

            let text = resp.text().await.map_err(|e| e.to_string())?;
            let messages: Vec<Message> =
                serde_json::from_str(&text).map_err(|e| format!("Parse messages: {}", e))?;

            if messages.is_empty() {
                break;
            }

            let mut found_today = false;
            for msg in &messages {
                if let Ok(ts) = NaiveDateTime::parse_from_str(
                    &msg.timestamp[..19],
                    "%Y-%m-%dT%H:%M:%S",
                ) {
                    if ts.date() == *date {
                        all_messages.push(msg.clone());
                        found_today = true;
                    }
                }
            }

            if !found_today && !all_messages.is_empty() {
                break; // Past today's messages
            }

            before = messages.last().map(|m| m.id.clone());

            if messages.len() < 100 {
                break;
            }

            // Rate limit
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        }

        all_messages.reverse(); // Chronological order
        Ok(all_messages)
    }
}

#[async_trait]
impl Connector for DiscordReaderConnector {
    fn name(&self) -> &str {
        "discord"
    }

    fn is_enabled(&self) -> bool {
        self.config.enabled && keychain::has_token()
    }

    async fn collect(&self, date: &NaiveDate) -> Result<CollectedData, String> {
        let channels = if self.config.process_all {
            let all = self.list_channels().await?;
            // Filter to DMs with recent messages (today)
            all.into_iter()
                .filter(|c| {
                    c.channel_type == 1 || c.channel_type == 3 // DM or Group DM
                })
                .filter(|c| {
                    // Include channels with last message within +/- 1 day (timezone tolerance)
                    c.last_message_id
                        .as_ref()
                        .and_then(|id| self.snowflake_to_date(id))
                        .map(|d| {
                            let diff = (d - *date).num_days().abs();
                            diff <= 1
                        })
                        .unwrap_or(false)
                })
                .collect::<Vec<_>>()
        } else {
            match &self.config.channel_id {
                Some(id) => vec![Channel {
                    id: id.clone(),
                    channel_type: 1,
                    recipients: None,
                    name: None,
                    last_message_id: None,
                }],
                None => return Err("No channel configured".to_string()),
            }
        };

        let mut conversations = Vec::new();
        for channel in channels {
            let messages = self.fetch_messages(&channel.id, date).await?;
            if messages.is_empty() {
                continue;
            }
            let channel_name = channel
                .name
                .or_else(|| {
                    channel.recipients.as_ref().and_then(|r| {
                        r.first().map(|u| {
                            u.global_name
                                .as_ref()
                                .unwrap_or(&u.username)
                                .clone()
                        })
                    })
                })
                .unwrap_or_else(|| channel.id.clone());

            conversations.push(serde_json::json!({
                "channel_id": channel.id,
                "channel_name": channel_name,
                "messages": messages,
            }));
        }

        Ok(CollectedData {
            source: "discord".to_string(),
            raw: serde_json::json!({ "conversations": conversations }),
        })
    }

    fn format_toon(&self, data: &CollectedData) -> String {
        let mut output = String::new();
        let empty = vec![];
        let convos = data.raw["conversations"].as_array().unwrap_or(&empty);

        for convo in convos {
            let name = convo["channel_name"].as_str().unwrap_or("Unknown");
            let channel_id = convo["channel_id"].as_str().unwrap_or("");
            let empty_msgs = vec![];
            let messages = convo["messages"].as_array().unwrap_or(&empty_msgs);

            output.push_str("conversation:\n");
            output.push_str(&format!(" channel: {} (ID: {})\n", name, channel_id));
            output.push_str(&format!(" message_count: {}\n\n", messages.len()));
            output.push_str(&format!(
                "messages[{}]{{id,author,timestamp,content}}:\n",
                messages.len()
            ));

            for msg in messages {
                let id = msg["id"].as_str().unwrap_or("");
                let author = msg["author"]["global_name"]
                    .as_str()
                    .or_else(|| msg["author"]["username"].as_str())
                    .unwrap_or("unknown");
                let ts = msg["timestamp"].as_str().unwrap_or("");
                let content = msg["content"]
                    .as_str()
                    .unwrap_or("")
                    .replace('\n', " ")
                    .replace(',', ";");
                output.push_str(&format!(" {},{},{},{}\n", id, author, &ts[..19.min(ts.len())], content));
            }
            output.push('\n');
        }
        output
    }
}

#[derive(Debug, Clone, Deserialize)]
struct Channel {
    id: String,
    #[serde(rename = "type")]
    channel_type: u8,
    recipients: Option<Vec<User>>,
    name: Option<String>,
    last_message_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
struct User {
    username: String,
    global_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
struct Message {
    id: String,
    content: String,
    timestamp: String,
    author: User,
}

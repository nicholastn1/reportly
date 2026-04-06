use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, ORIGIN, REFERER, USER_AGENT};
use serde::Serialize;

use crate::keychain;

#[derive(Debug, Serialize)]
pub struct DiscordMessage {
    pub content: String,
}

pub async fn send_message(channel_id: &str, content: &str) -> Result<String, String> {
    let token = keychain::get_token()?;

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&token).map_err(|e| e.to_string())?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        ),
    );
    headers.insert(ORIGIN, HeaderValue::from_static("https://discord.com"));
    headers.insert(
        REFERER,
        HeaderValue::from_str(&format!("https://discord.com/channels/{}", channel_id))
            .map_err(|e| e.to_string())?,
    );

    let client = reqwest::Client::new();
    let body = DiscordMessage {
        content: content.to_string(),
    };

    let url = format!(
        "https://discord.com/api/v10/channels/{}/messages",
        channel_id
    );

    let response = client
        .post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;

    if status.is_success() {
        // Try to extract message ID
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(id) = parsed.get("id").and_then(|v| v.as_str()) {
                return Ok(id.to_string());
            }
        }
        Ok("sent".to_string())
    } else {
        Err(format!("Discord API error ({}): {}", status, text))
    }
}

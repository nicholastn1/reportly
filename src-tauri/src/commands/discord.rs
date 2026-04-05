use serde::Serialize;

use crate::config;
use crate::discord as discord_client;
use crate::keychain;
use crate::vault;

#[derive(Debug, Serialize)]
pub struct SendResult {
    pub success: bool,
    pub message_id: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DiscordConfig {
    pub channel_id: String,
    pub has_token: bool,
}

#[tauri::command]
pub async fn send_to_discord(date: String) -> Result<SendResult, String> {
    let cfg = config::load_config();
    let parsed = vault::parse_date(&date)?;

    let content = vault::read_report(&cfg.vault_path, &parsed)?
        .ok_or_else(|| format!("No report found for {}", date))?;

    if cfg.channel_id.is_empty() {
        return Err("Discord channel ID not configured".to_string());
    }

    match discord_client::send_message(&cfg.channel_id, &content).await {
        Ok(message_id) => Ok(SendResult {
            success: true,
            message_id: Some(message_id),
            error: None,
        }),
        Err(e) => Ok(SendResult {
            success: false,
            message_id: None,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub fn get_discord_config() -> Result<DiscordConfig, String> {
    let cfg = config::load_config();
    Ok(DiscordConfig {
        channel_id: cfg.channel_id,
        has_token: keychain::has_token(),
    })
}

#[tauri::command]
pub fn save_discord_token(token: String) -> Result<(), String> {
    keychain::save_token(&token)
}

#[tauri::command]
pub fn get_config() -> Result<config::AppConfig, String> {
    Ok(config::load_config())
}

#[tauri::command]
pub fn save_config(config_data: config::AppConfig) -> Result<(), String> {
    config::save_config(&config_data)
}

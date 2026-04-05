use chrono::Local;
use tauri::{AppHandle, Emitter};

use crate::config;
use crate::digest;
use crate::keychain;
use crate::openai;
use crate::vault;

#[tauri::command]
pub async fn generate_digest(app: AppHandle, date: Option<String>) -> Result<digest::DigestResult, String> {
    let cfg = config::load_config();
    let parsed = match date {
        Some(d) => vault::parse_date(&d)?,
        None => Local::now().date_naive(),
    };
    digest::generate(&cfg, &parsed, |progress| {
        app.emit("digest-progress", &progress).ok();
    }).await
}

#[tauri::command]
pub async fn apply_digest_to_report(
    date: String,
    yesterday_content: String,
    today_suggestions: Option<String>,
) -> Result<(), String> {
    let cfg = config::load_config();
    let parsed = vault::parse_date(&date)?;
    let path = vault::report_path(&cfg.vault_path, &parsed);

    let mut content = if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| e.to_string())?
    } else {
        format!("## Daily Report - {}\n\n**O que foi feito ontem:**\n\n**O que será feito hoje:**\n", date)
    };

    let yesterday_marker = "**O que foi feito ontem:**";
    let today_marker = "**O que será feito hoje:**";

    // Extract existing "yesterday" section to check for duplicates
    let existing_yesterday = if content.contains(yesterday_marker) && content.contains(today_marker) {
        let start = content.find(yesterday_marker).unwrap() + yesterday_marker.len();
        let end = content.find(today_marker).unwrap();
        content[start..end].trim().to_string()
    } else {
        String::new()
    };

    // If there's existing content, use AI to merge (avoid duplicates)
    let items_to_add = if !existing_yesterday.is_empty() && !yesterday_content.trim().is_empty() {
        match openai::merge_items(&cfg.openai.model, &existing_yesterday, &yesterday_content).await {
            Ok(merged) => {
                let text = merged.text.trim().to_string();
                if text.is_empty() { None } else { Some(text) }
            }
            Err(e) => {
                log::warn!("Merge failed, appending all: {}", e);
                Some(yesterday_content)
            }
        }
    } else if !yesterday_content.trim().is_empty() {
        Some(yesterday_content)
    } else {
        None
    };

    // Insert new yesterday items before "O que será feito hoje:"
    if let Some(items) = items_to_add {
        if content.contains(today_marker) {
            content = content.replace(
                today_marker,
                &format!("{}\n\n{}", items, today_marker),
            );
        } else {
            content.push_str(&format!("\n{}\n", items));
        }
    }

    // Insert today suggestions after "O que será feito hoje:"
    if let Some(suggestions) = today_suggestions {
        if content.contains(today_marker) {
            content = content.replace(
                today_marker,
                &format!("{}\n{}", today_marker, suggestions),
            );
        }
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_openai_key(key: String) -> Result<(), String> {
    keychain::save_openai_key(&key)
}

#[tauri::command]
pub fn save_connector_token(connector: String, token: String) -> Result<(), String> {
    keychain::save_connector_token(&connector, &token)
}

#[tauri::command]
pub fn get_connectors_status() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "openai": keychain::has_openai_key(),
        "discord": keychain::has_token(),
        "gitlab": keychain::has_connector_token("gitlab"),
        "jira": keychain::has_connector_token("jira"),
        "confluence": keychain::has_connector_token("confluence"),
        "github": keychain::has_connector_token("github"),
    }))
}

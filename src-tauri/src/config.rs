use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub vault_path: String,
    pub channel_id: String,
    pub schedule: ScheduleConfig,
    #[serde(default)]
    pub openai: OpenAiConfig,
    #[serde(default)]
    pub connectors: ConnectorsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleConfig {
    pub enabled: bool,
    pub days: Vec<u8>,
    pub time: String,
    pub auto_send: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiConfig {
    pub model: String,
}

impl Default for OpenAiConfig {
    fn default() -> Self {
        Self {
            model: "gpt-4o-mini".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConnectorsConfig {
    #[serde(default)]
    pub discord_read: DiscordReadConfig,
    #[serde(default)]
    pub gitlab: CliConnectorConfig,
    #[serde(default)]
    pub jira: McpConnectorConfig,
    #[serde(default)]
    pub confluence: McpConnectorConfig,
    #[serde(default)]
    pub github: CliConnectorConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordReadConfig {
    pub enabled: bool,
    pub process_all: bool,
    pub channel_id: Option<String>,
}

impl Default for DiscordReadConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            process_all: true,
            channel_id: None,
        }
    }
}

/// CLI-based connector (gh, glab) — zero config, uses existing auth
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CliConnectorConfig {
    pub enabled: bool,
    pub username: Option<String>,
    /// GitLab: self-hosted hostname (e.g. git.gocase.com.br)
    pub hostname: Option<String>,
}

/// Atlassian connector (Jira, Confluence) — REST API with Basic Auth
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct McpConnectorConfig {
    pub enabled: bool,
    /// Legacy MCP URL field (kept for backwards compat, ignored if instance_url is set)
    #[serde(default)]
    pub mcp_url: String,
    pub username: Option<String>,
    /// Atlassian instance URL, e.g. "https://mycompany.atlassian.net"
    #[serde(default)]
    pub instance_url: Option<String>,
    /// Atlassian account email for Basic Auth
    #[serde(default)]
    pub email: Option<String>,
}


impl Default for AppConfig {
    fn default() -> Self {
        Self {
            vault_path: dirs::home_dir()
                .unwrap_or_default()
                .join("Documents/Personal/Work")
                .to_string_lossy()
                .to_string(),
            channel_id: String::new(),
            schedule: ScheduleConfig {
                enabled: false,
                days: vec![1, 2, 3, 4, 5],
                time: "09:00".to_string(),
                auto_send: false,
            },
            openai: OpenAiConfig::default(),
            connectors: ConnectorsConfig::default(),
        }
    }
}

fn config_path() -> PathBuf {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("com.dailyreport.manager");
    fs::create_dir_all(&dir).ok();
    dir.join("config.json")
}

pub fn load_config() -> AppConfig {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => {
            let config = AppConfig::default();
            save_config(&config).ok();
            config
        }
    }
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

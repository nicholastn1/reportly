use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Represents an MCP server detected from Claude Code configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedMcpServer {
    pub name: String,
    pub transport: String, // "stdio" or "http"
    pub source: String,    // "global" or project path
    /// For HTTP servers
    pub url: Option<String>,
    /// For stdio servers
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
}

/// Raw Claude settings.json structure (partial)
#[derive(Debug, Deserialize)]
struct ClaudeSettings {
    #[serde(default, rename = "mcpServers")]
    mcp_servers: HashMap<String, RawMcpServer>,
}

/// Raw .mcp.json structure
#[derive(Debug, Deserialize)]
struct McpJsonFile {
    #[serde(default, rename = "mcpServers")]
    mcp_servers: HashMap<String, RawMcpServer>,
}

#[derive(Debug, Deserialize)]
struct RawMcpServer {
    #[serde(rename = "type")]
    server_type: Option<String>,
    url: Option<String>,
    command: Option<String>,
    args: Option<Vec<String>>,
}

/// Detect all MCP servers from Claude Code configuration
pub fn detect_servers() -> Vec<DetectedMcpServer> {
    let mut servers = Vec::new();

    // 1. Read global ~/.claude/settings.json
    if let Some(home) = dirs::home_dir() {
        let settings_path = home.join(".claude").join("settings.json");
        if let Ok(content) = std::fs::read_to_string(&settings_path) {
            if let Ok(settings) = serde_json::from_str::<ClaudeSettings>(&content) {
                for (name, raw) in settings.mcp_servers {
                    servers.push(to_detected(name, raw, "global".to_string()));
                }
            }
        }
    }

    // 2. Scan known project directories for .mcp.json
    let scan_roots = get_scan_roots();
    for root in scan_roots {
        scan_for_mcp_json(&root, &mut servers, 3);
    }

    // Deduplicate by name (prefer project-level over global)
    let mut seen: HashMap<String, usize> = HashMap::new();
    let mut deduped: Vec<DetectedMcpServer> = Vec::new();
    for server in servers {
        if let Some(&idx) = seen.get(&server.name) {
            // Prefer project-level (non-global) over global
            if deduped[idx].source == "global" && server.source != "global" {
                deduped[idx] = server;
            }
        } else {
            seen.insert(server.name.clone(), deduped.len());
            deduped.push(server);
        }
    }

    deduped
}

fn to_detected(name: String, raw: RawMcpServer, source: String) -> DetectedMcpServer {
    let is_http = raw.server_type.as_deref() == Some("http") || raw.url.is_some();
    DetectedMcpServer {
        name,
        transport: if is_http { "http".to_string() } else { "stdio".to_string() },
        source,
        url: raw.url,
        command: raw.command,
        args: raw.args,
    }
}

fn get_scan_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(home) = dirs::home_dir() {
        let documents = home.join("Documents");
        if documents.exists() {
            // Scan common code directories
            for sub in &["Personal", "Gocase", "Projects", "Work"] {
                let path = documents.join(sub);
                if path.exists() {
                    roots.push(path);
                }
            }
        }
    }
    roots
}

fn scan_for_mcp_json(dir: &PathBuf, servers: &mut Vec<DetectedMcpServer>, depth: u8) {
    if depth == 0 {
        return;
    }
    let mcp_path = dir.join(".mcp.json");
    if mcp_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&mcp_path) {
            if let Ok(mcp_file) = serde_json::from_str::<McpJsonFile>(&content) {
                let source = dir.to_string_lossy().to_string();
                for (name, raw) in mcp_file.mcp_servers {
                    servers.push(to_detected(name, raw, source.clone()));
                }
            }
        }
    }

    // Recurse into subdirectories
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                // Skip hidden dirs and common non-project dirs
                if !name.starts_with('.') && name != "node_modules" && name != "target" {
                    scan_for_mcp_json(&path, servers, depth - 1);
                }
            }
        }
    }
}

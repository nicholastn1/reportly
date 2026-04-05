use crate::claude_mcp;

#[tauri::command]
pub fn detect_claude_mcp_servers() -> Result<Vec<claude_mcp::DetectedMcpServer>, String> {
    Ok(claude_mcp::detect_servers())
}

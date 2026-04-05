use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};

#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    method: String,
    params: JsonRpcParams,
    id: u32,
}

#[derive(Debug, Serialize)]
struct JsonRpcParams {
    name: String,
    arguments: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    result: Option<JsonRpcResult>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcResult {
    content: Vec<ContentItem>,
}

#[derive(Debug, Deserialize)]
struct ContentItem {
    #[serde(rename = "type")]
    _type: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    message: String,
}

pub struct McpClient {
    url: String,
    token: Option<String>,
    request_id: AtomicU32,
}

impl McpClient {
    pub fn new(url: &str, token: Option<String>) -> Self {
        Self {
            url: url.to_string(),
            token,
            request_id: AtomicU32::new(1),
        }
    }

    pub async fn call_tool(
        &self,
        name: &str,
        arguments: serde_json::Value,
    ) -> Result<String, String> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst);

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            method: "tools/call".to_string(),
            params: JsonRpcParams {
                name: name.to_string(),
                arguments,
            },
            id,
        };

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Some(ref token) = self.token {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", token))
                    .map_err(|e| e.to_string())?,
            );
        }

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| e.to_string())?;

        let response = client
            .post(&self.url)
            .headers(headers)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("MCP request failed: {}", e))?;

        let status = response.status();
        let text = response.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("MCP HTTP error ({}): {}", status, text));
        }

        let parsed: JsonRpcResponse =
            serde_json::from_str(&text).map_err(|e| format!("MCP parse error: {}", e))?;

        if let Some(err) = parsed.error {
            return Err(format!("MCP error: {}", err.message));
        }

        parsed
            .result
            .and_then(|r| r.content.into_iter().find(|c| c._type == "text"))
            .map(|c| c.text)
            .ok_or_else(|| "Empty MCP response".to_string())
    }
}

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};

use crate::keychain;

const API_URL: &str = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT: &str = "Extraia dos dados abaixo APENAS itens concretos de trabalho realizados. \
Formato: bullet points (- item) curtos e objetivos, como se fossem entradas de um daily report. \
Inclua números de tickets/tasks/MRs quando mencionados (ex: PROJ-123, !456). \
NÃO inclua: nome da plataforma, quem disse o quê, contexto de conversa, saudações, ou informações pessoais. \
NÃO invente nada. Se não houver itens de trabalho concretos, responda com uma string vazia. \
Os dados estão em formato TOON (Token-Oriented Object Notation).";

const SUGGESTIONS_PROMPT: &str = "Com base nas atividades de ontem abaixo, sugira de 2 a 5 items \
para 'O que será feito hoje'. Regras:\n\
- Apenas continuações lógicas e follow-ups do que foi feito ontem\n\
- Se uma task/ticket foi CRIADA ontem, sugira implementá-la (com o número, ex: PROJ-123)\n\
- Se algo precisa de task mas não foi criada, sugira criar\n\
- NÃO sugira reuniões, syncs, ou alinhamentos a menos que estejam explicitamente mencionados como pendentes\n\
- NÃO invente tarefas genéricas (ex: 'revisar código', 'atualizar documentação') se não houver evidência\n\
- Inclua números de tickets/MRs quando disponíveis\n\
- Formato: bullet points (- item), curtos e objetivos\n\
Responda APENAS com os bullet points.";

#[derive(Debug, Clone, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

#[derive(Debug, Clone, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct Summary {
    pub text: String,
    pub usage: Option<Usage>,
    pub estimated_cost: f64,
}

fn estimate_cost(model: &str, usage: &Usage) -> f64 {
    let (input_price, output_price) = match model {
        "gpt-4o-mini" => (0.15, 0.60),
        "gpt-4o" => (2.50, 10.00),
        "gpt-4-turbo" => (10.00, 30.00),
        "gpt-4" => (30.00, 60.00),
        "gpt-3.5-turbo" => (0.50, 1.50),
        _ => (0.15, 0.60), // default to mini pricing
    };
    (usage.prompt_tokens as f64 / 1_000_000.0 * input_price)
        + (usage.completion_tokens as f64 / 1_000_000.0 * output_price)
}

async fn call_openai(model: &str, system: &str, user_content: &str) -> Result<Summary, String> {
    let api_key = keychain::get_openai_key()?;

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", api_key)).map_err(|e| e.to_string())?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let request = ChatRequest {
        model: model.to_string(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_content.to_string(),
            },
        ],
    };

    let client = reqwest::Client::new();
    let response = client
        .post(API_URL)
        .headers(headers)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("OpenAI API error ({}): {}", status, text));
    }

    let parsed: ChatResponse =
        serde_json::from_str(&text).map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = parsed
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    let cost = parsed
        .usage
        .as_ref()
        .map(|u| estimate_cost(model, u))
        .unwrap_or(0.0);

    Ok(Summary {
        text: content,
        usage: parsed.usage,
        estimated_cost: cost,
    })
}

pub async fn summarize(model: &str, toon_content: &str) -> Result<Summary, String> {
    call_openai(model, SYSTEM_PROMPT, toon_content).await
}

pub async fn suggest_today(model: &str, yesterday_summary: &str) -> Result<Summary, String> {
    call_openai(model, SUGGESTIONS_PROMPT, yesterday_summary).await
}

const MERGE_PROMPT: &str = "Você receberá dois blocos: EXISTENTE (conteúdo atual do report) e NOVO (itens do digest). \
Sua tarefa: retornar APENAS os itens do NOVO que NÃO estão já mencionados no EXISTENTE. \
Se um item já está coberto (mesmo com palavras diferentes), NÃO inclua. \
Retorne no formato bullet points (- item). Se todos os itens já existem, retorne string vazia.";

pub async fn merge_items(model: &str, existing: &str, new_items: &str) -> Result<Summary, String> {
    let user_content = format!("EXISTENTE:\n{}\n\nNOVO:\n{}", existing, new_items);
    call_openai(model, MERGE_PROMPT, &user_content).await
}

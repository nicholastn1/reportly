use chrono::NaiveDate;
use serde::Serialize;

use crate::config::AppConfig;
use crate::connectors::confluence::ConfluenceConnector;
use crate::connectors::discord_reader::DiscordReaderConnector;
use crate::connectors::github::GitHubConnector;
use crate::connectors::gitlab::GitLabConnector;
use crate::connectors::jira::JiraConnector;
use crate::connectors::Connector;
use crate::openai;

#[derive(Debug, Clone, Serialize)]
pub struct DigestResult {
    pub platform_summaries: Vec<PlatformSummary>,
    pub suggestions: Option<String>,
    pub total_tokens: u32,
    pub total_cost: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlatformSummary {
    pub platform: String,
    pub summary: String,
    pub tokens: u32,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DigestProgress {
    pub step: String,
    pub detail: String,
    pub current: u32,
    pub total: u32,
}

pub async fn generate<F>(config: &AppConfig, date: &NaiveDate, on_progress: F) -> Result<DigestResult, String>
where
    F: Fn(DigestProgress),
{
    let connectors: Vec<Box<dyn Connector>> = vec![
        Box::new(DiscordReaderConnector::new(config.connectors.discord_read.clone())),
        Box::new(GitLabConnector::new(config.connectors.gitlab.clone())),
        Box::new(JiraConnector::new(config.connectors.jira.clone())),
        Box::new(ConfluenceConnector::new(config.connectors.confluence.clone())),
        Box::new(GitHubConnector::new(config.connectors.github.clone())),
    ];

    let enabled: Vec<_> = connectors.into_iter().filter(|c| c.is_enabled()).collect();

    if enabled.is_empty() {
        return Err("Nenhum conector habilitado".to_string());
    }

    let enabled_count = enabled.len() as u32;
    let enabled_names: Vec<_> = enabled.iter().map(|c| c.name().to_string()).collect();

    // Collect sequentially
    let mut collected = Vec::new();
    let mut errors = Vec::new();

    for (i, connector) in enabled.iter().enumerate() {
        on_progress(DigestProgress {
            step: "collecting".to_string(),
            detail: format!("Coletando dados de {}", connector.name()),
            current: i as u32 + 1,
            total: enabled_count,
        });

        match connector.collect(date).await {
            Ok(data) => {
                let toon = connector.format_toon(&data);
                if !toon.trim().is_empty() {
                    collected.push((connector.name().to_string(), toon));
                } else {
                    errors.push(format!("{}: sem dados para esta data", connector.name()));
                }
            }
            Err(e) => {
                errors.push(format!("{}: {}", connector.name(), e));
            }
        }
    }

    if collected.is_empty() {
        let detail = if errors.is_empty() {
            format!("Conectores habilitados: {}. Nenhum retornou dados.", enabled_names.join(", "))
        } else {
            format!("Detalhes:\n{}", errors.join("\n"))
        };
        return Err(format!("Nenhum dado coletado dos conectores. {}", detail));
    }

    // Summarize each platform via OpenAI
    let model = &config.openai.model;
    let mut summaries = Vec::new();
    let mut total_tokens = 0u32;
    let mut total_cost = 0.0f64;
    let collected_count = collected.len() as u32;

    for (i, (platform, toon)) in collected.iter().enumerate() {
        on_progress(DigestProgress {
            step: "summarizing".to_string(),
            detail: format!("Sumarizando {}", platform),
            current: i as u32 + 1,
            total: collected_count,
        });

        match openai::summarize(model, toon).await {
            Ok(summary) => {
                let tokens = summary.usage.as_ref().map(|u| u.total_tokens).unwrap_or(0);
                total_tokens += tokens;
                total_cost += summary.estimated_cost;
                summaries.push(PlatformSummary {
                    platform: platform.clone(),
                    summary: summary.text,
                    tokens,
                    cost: summary.estimated_cost,
                });
            }
            Err(e) => {
                log::warn!("OpenAI summarization failed for {}: {}", platform, e);
                summaries.push(PlatformSummary {
                    platform: platform.clone(),
                    summary: format!("(erro ao sumarizar: {})", e),
                    tokens: 0,
                    cost: 0.0,
                });
            }
        }
    }

    // Generate suggestions
    on_progress(DigestProgress {
        step: "suggesting".to_string(),
        detail: "Gerando sugestoes para hoje".to_string(),
        current: 1,
        total: 1,
    });

    let all_summaries_text: String = summaries
        .iter()
        .map(|s| format!("[{}]\n{}", s.platform, s.summary))
        .collect::<Vec<_>>()
        .join("\n\n");

    let suggestions = match openai::suggest_today(model, &all_summaries_text).await {
        Ok(s) => {
            total_tokens += s.usage.as_ref().map(|u| u.total_tokens).unwrap_or(0);
            total_cost += s.estimated_cost;
            Some(s.text)
        }
        Err(e) => {
            log::warn!("Failed to generate suggestions: {}", e);
            None
        }
    };

    on_progress(DigestProgress {
        step: "done".to_string(),
        detail: "Digest completo".to_string(),
        current: 1,
        total: 1,
    });

    Ok(DigestResult {
        platform_summaries: summaries,
        suggestions,
        total_tokens,
        total_cost,
    })
}

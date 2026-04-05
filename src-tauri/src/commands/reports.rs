use chrono::Local;
use serde::Serialize;

use crate::config;
use crate::vault;

#[derive(Debug, Serialize)]
pub struct Report {
    pub date: String,
    pub content: String,
    pub path: String,
    pub exists: bool,
}

#[tauri::command]
pub fn get_today_report() -> Result<Report, String> {
    let cfg = config::load_config();
    let today = Local::now().date_naive();
    let date_str = today.format("%d.%m.%y").to_string();

    match vault::read_report(&cfg.vault_path, &today)? {
        Some(content) => {
            let path = vault::report_path(&cfg.vault_path, &today);
            Ok(Report {
                date: date_str,
                content,
                path: path.to_string_lossy().to_string(),
                exists: true,
            })
        }
        None => Ok(Report {
            date: date_str,
            content: String::new(),
            path: vault::report_path(&cfg.vault_path, &today)
                .to_string_lossy()
                .to_string(),
            exists: false,
        }),
    }
}

#[tauri::command]
pub fn get_report(date: String) -> Result<Report, String> {
    let cfg = config::load_config();
    let parsed = vault::parse_date(&date)?;

    match vault::read_report(&cfg.vault_path, &parsed)? {
        Some(content) => {
            let path = vault::report_path(&cfg.vault_path, &parsed);
            Ok(Report {
                date,
                content,
                path: path.to_string_lossy().to_string(),
                exists: true,
            })
        }
        None => Ok(Report {
            date: date.clone(),
            content: String::new(),
            path: vault::report_path(&cfg.vault_path, &parsed)
                .to_string_lossy()
                .to_string(),
            exists: false,
        }),
    }
}

#[tauri::command]
pub fn save_report(date: String, content: String) -> Result<(), String> {
    let cfg = config::load_config();
    let parsed = vault::parse_date(&date)?;
    vault::write_report(&cfg.vault_path, &parsed, &content)
}

#[tauri::command]
pub fn list_reports(year: i32, month: u32) -> Result<Vec<vault::ReportEntry>, String> {
    let cfg = config::load_config();
    vault::list_reports(&cfg.vault_path, year, month)
}

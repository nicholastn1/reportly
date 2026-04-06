use chrono::{Datelike, NaiveDate};
use std::fs;
use std::path::PathBuf;

const MONTHS: &[&str] = &[
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

pub fn report_path(vault_path: &str, date: &NaiveDate) -> PathBuf {
    let year = date.format("%Y").to_string();
    let month_name = MONTHS[date.month() as usize];
    let filename = format!("Daily Report - {}.md", date.format("%d.%m.%y"));

    PathBuf::from(vault_path)
        .join(year)
        .join(month_name)
        .join("Daily Reports")
        .join(filename)
}

pub fn parse_date(date_str: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(date_str, "%d.%m.%y").map_err(|e| format!("Invalid date: {}", e))
}

pub fn read_report(vault_path: &str, date: &NaiveDate) -> Result<Option<String>, String> {
    let path = report_path(vault_path, date);
    if path.exists() {
        fs::read_to_string(&path)
            .map(Some)
            .map_err(|e| e.to_string())
    } else {
        Ok(None)
    }
}

pub fn write_report(vault_path: &str, date: &NaiveDate, content: &str) -> Result<(), String> {
    let path = report_path(vault_path, date);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

pub fn list_reports(
    vault_path: &str,
    year: i32,
    month: u32,
) -> Result<Vec<ReportEntry>, String> {
    let month_name = MONTHS.get(month as usize).ok_or("Invalid month")?;
    let dir = PathBuf::from(vault_path)
        .join(year.to_string())
        .join(month_name)
        .join("Daily Reports");

    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = vec![];
    let read_dir = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("Daily Report - ") || !name.ends_with(".md") {
            continue;
        }
        let date_str = name
            .trim_start_matches("Daily Report - ")
            .trim_end_matches(".md");

        if parse_date(date_str).is_ok() {
            let content = fs::read_to_string(entry.path()).unwrap_or_default();
            let preview: String = content.lines().take(5).collect::<Vec<_>>().join("\n");
            entries.push(ReportEntry {
                date: date_str.to_string(),
                preview,
                path: entry.path().to_string_lossy().to_string(),
            });
        }
    }

    entries.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(entries)
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ReportEntry {
    pub date: String,
    pub preview: String,
    pub path: String,
}

/// List the N most recent reports across all months, scanning back up to 3 months.
pub fn list_recent_reports(vault_path: &str, limit: usize) -> Result<Vec<ReportEntry>, String> {
    let today = chrono::Local::now().date_naive();
    let mut all_entries = Vec::new();

    // Scan current month and up to 2 previous months
    let mut year = today.year();
    let mut month = today.month();
    for _ in 0..3 {
        if let Ok(entries) = list_reports(vault_path, year, month) {
            all_entries.extend(entries);
        }
        if month == 1 {
            month = 12;
            year -= 1;
        } else {
            month -= 1;
        }
    }

    // Sort by date descending and deduplicate
    all_entries.sort_by(|a, b| b.date.cmp(&a.date));
    all_entries.dedup_by(|a, b| a.date == b.date);
    all_entries.truncate(limit);

    Ok(all_entries)
}

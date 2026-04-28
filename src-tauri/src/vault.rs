use chrono::{Datelike, Duration, NaiveDate, Weekday};
use std::fs;
use std::path::PathBuf;

const MONTHS: &[&str] = &[
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const SECTION_TODAY: &str = "**O que será feito hoje:**";

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

/// Most recent weekday strictly before `date` (skips Sat/Sun).
pub fn previous_business_day(date: &NaiveDate) -> NaiveDate {
    let mut d = *date - Duration::days(1);
    while matches!(d.weekday(), Weekday::Sat | Weekday::Sun) {
        d -= Duration::days(1);
    }
    d
}

/// Body under `**O que será feito hoje:**` until next `**...**` header or EOF.
pub fn extract_today_section(content: &str) -> String {
    let Some(idx) = content.find(SECTION_TODAY) else {
        return String::new();
    };
    let after = &content[idx + SECTION_TODAY.len()..];
    let body = match after.find("\n**") {
        Some(end) => &after[..end],
        None => after,
    };
    body.trim().to_string()
}

/// Create today's report from the previous business day's "será feito hoje"
/// section. No-op if today's file already exists.
pub fn carry_forward_if_missing(vault_path: &str, today: &NaiveDate) -> Result<(), String> {
    if report_path(vault_path, today).exists() {
        return Ok(());
    }

    let yesterday = previous_business_day(today);
    let yesterday_section = match read_report(vault_path, &yesterday)? {
        Some(content) => extract_today_section(&content),
        None => String::new(),
    };

    let ontem_block = if yesterday_section.is_empty() {
        String::new()
    } else {
        format!("{}\n", yesterday_section)
    };

    let body = format!(
        "## Daily Report - {date}\n\n**O que foi feito ontem:**\n{ontem}\n**O que será feito hoje:**\n",
        date = today.format("%d.%m.%y"),
        ontem = ontem_block,
    );

    write_report(vault_path, today, &body)
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

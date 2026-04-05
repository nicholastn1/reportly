use std::fs;
use std::path::PathBuf;
use std::process::Command;

use crate::config::{load_config, ScheduleConfig};

const LABEL: &str = "com.dailyreport.manager.schedule";

fn plist_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join("Library/LaunchAgents")
        .join(format!("{}.plist", LABEL))
}

fn app_binary_path() -> String {
    // In debug, use the binary directly; in release, use the .app bundle
    let exe = std::env::current_exe().unwrap_or_default();
    exe.to_string_lossy().to_string()
}

fn generate_plist(schedule: &ScheduleConfig) -> String {
    let binary = app_binary_path();

    // Parse time "HH:MM"
    let parts: Vec<&str> = schedule.time.split(':').collect();
    let hour: u8 = parts.first().and_then(|h| h.parse().ok()).unwrap_or(9);
    let minute: u8 = parts.get(1).and_then(|m| m.parse().ok()).unwrap_or(0);

    // Build StartCalendarInterval entries for each day
    let intervals: String = schedule
        .days
        .iter()
        .map(|day| {
            format!(
                "        <dict>
            <key>Weekday</key>
            <integer>{}</integer>
            <key>Hour</key>
            <integer>{}</integer>
            <key>Minute</key>
            <integer>{}</integer>
        </dict>",
                day, hour, minute
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{binary}</string>
        <string>--scheduled-send</string>
    </array>
    <key>StartCalendarInterval</key>
    <array>
{intervals}
    </array>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>"#,
        label = LABEL,
        binary = binary,
        intervals = intervals,
    )
}

pub fn install_agent() -> Result<(), String> {
    let config = load_config();
    if !config.schedule.enabled {
        return Err("Schedule is not enabled".to_string());
    }

    let plist = generate_plist(&config.schedule);
    let path = plist_path();

    // Ensure LaunchAgents dir exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Unload existing first (ignore errors)
    unload_agent().ok();

    // Write plist
    fs::write(&path, plist).map_err(|e| format!("Failed to write plist: {}", e))?;

    // Load
    let output = Command::new("launchctl")
        .args(["load", &path.to_string_lossy()])
        .output()
        .map_err(|e| format!("Failed to run launchctl: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("launchctl load failed: {}", stderr))
    }
}

pub fn uninstall_agent() -> Result<(), String> {
    unload_agent()?;
    let path = plist_path();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn unload_agent() -> Result<(), String> {
    let path = plist_path();
    if !path.exists() {
        return Ok(());
    }
    Command::new("launchctl")
        .args(["unload", &path.to_string_lossy()])
        .output()
        .map_err(|e| format!("Failed to run launchctl: {}", e))?;
    Ok(())
}

pub fn is_agent_installed() -> bool {
    let output = Command::new("launchctl")
        .args(["list"])
        .output()
        .ok();
    match output {
        Some(o) => String::from_utf8_lossy(&o.stdout).contains(LABEL),
        None => false,
    }
}

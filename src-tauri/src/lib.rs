mod claude_mcp;
mod commands;
mod config;
mod connectors;
mod digest;
mod discord;
mod keychain;
mod openai;
mod scheduler;
mod vault;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Check if launched with --scheduled-send
            let is_scheduled = std::env::args().any(|a| a == "--scheduled-send");

            // System tray
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Open", true, None::<&str>)?;
            let send_now =
                MenuItem::with_id(app, "send_now", "Send Report...", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &send_now, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Reportly")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().ok();
                            window.set_focus().ok();
                        }
                    }
                    "send_now" => {
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().ok();
                            window.set_focus().ok();
                            app.emit("trigger-send", ()).ok();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // If launched via --scheduled-send, emit event to show approval dialog
            if is_scheduled {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    // Give the frontend a moment to load
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    if let Some(window) = handle.get_webview_window("main") {
                        window.show().ok();
                        window.set_focus().ok();
                    }
                    handle.emit("trigger-send", ()).ok();
                });
            }

            // In-process scheduler: check every 60s if it's time to send
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_triggered: Option<String> = None;
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                    let cfg = config::load_config();
                    if !cfg.schedule.enabled {
                        continue;
                    }

                    let now = chrono::Local::now();
                    let weekday = now.format("%u").to_string(); // 1=Mon..7=Sun
                    let current_day: u8 = weekday.parse().unwrap_or(0);
                    let current_time = now.format("%H:%M").to_string();

                    // Check if current day is in schedule
                    if !cfg.schedule.days.contains(&current_day) {
                        continue;
                    }

                    // Check if current time matches
                    if current_time != cfg.schedule.time {
                        continue;
                    }

                    // Prevent triggering multiple times in the same minute
                    let key = format!("{}-{}", now.format("%Y-%m-%d"), current_time);
                    if last_triggered.as_deref() == Some(&key) {
                        continue;
                    }
                    last_triggered = Some(key);

                    // Trigger!
                    if cfg.schedule.auto_send {
                        // Auto-send without dialog
                        handle.emit("auto-send", ()).ok();
                    } else {
                        // Show approval dialog
                        if let Some(window) = handle.get_webview_window("main") {
                            window.show().ok();
                            window.set_focus().ok();
                        }
                        handle.emit("trigger-send", ()).ok();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::reports::get_today_report,
            commands::reports::get_report,
            commands::reports::save_report,
            commands::reports::list_reports,
            commands::discord::send_to_discord,
            commands::discord::get_discord_config,
            commands::discord::save_discord_token,
            commands::discord::get_config,
            commands::discord::save_config,
            commands::schedule::install_launch_agent,
            commands::schedule::uninstall_launch_agent,
            commands::schedule::get_launch_agent_status,
            commands::digest::generate_digest,
            commands::digest::apply_digest_to_report,
            commands::digest::save_openai_key,
            commands::digest::save_connector_token,
            commands::digest::get_connectors_status,
            commands::claude_mcp::detect_claude_mcp_servers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

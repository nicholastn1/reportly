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
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // macOS app menu with About metadata
            let version = app.config().version.clone();
            let about = PredefinedMenuItem::about(
                app,
                Some("Sobre o Reportly"),
                Some(AboutMetadata {
                    version,
                    authors: Some(vec!["Nicholas Nogueira".into()]),
                    copyright: Some("© 2026 Nicholas Nogueira".into()),
                    ..Default::default()
                }),
            )?;
            let hide = PredefinedMenuItem::hide(app, None)?;
            let hide_others = PredefinedMenuItem::hide_others(app, None)?;
            let show_all = PredefinedMenuItem::show_all(app, None)?;
            let quit = PredefinedMenuItem::quit(app, None)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let separator2 = PredefinedMenuItem::separator(app)?;

            let app_menu = Submenu::with_items(
                app,
                "Reportly",
                true,
                &[&about, &separator, &hide, &hide_others, &show_all, &separator2, &quit],
            )?;

            // File menu
            let close_window = PredefinedMenuItem::close_window(app, None)?;
            let file_menu = Submenu::with_items(app, "File", true, &[&close_window])?;

            // Edit menu
            let undo = PredefinedMenuItem::undo(app, None)?;
            let redo = PredefinedMenuItem::redo(app, None)?;
            let sep_e1 = PredefinedMenuItem::separator(app)?;
            let cut = PredefinedMenuItem::cut(app, None)?;
            let copy = PredefinedMenuItem::copy(app, None)?;
            let paste = PredefinedMenuItem::paste(app, None)?;
            let select_all = PredefinedMenuItem::select_all(app, None)?;
            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[&undo, &redo, &sep_e1, &cut, &copy, &paste, &select_all],
            )?;

            // View menu
            let fullscreen = PredefinedMenuItem::fullscreen(app, None)?;
            let view_menu = Submenu::with_items(app, "View", true, &[&fullscreen])?;

            // Window menu
            let minimize = PredefinedMenuItem::minimize(app, None)?;
            let zoom = PredefinedMenuItem::maximize(app, None)?;
            let window_menu = Submenu::with_items(app, "Window", true, &[&minimize, &zoom])?;

            let menu_bar = Menu::with_items(
                app,
                &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu],
            )?;
            app.set_menu(menu_bar)?;

            // Check if launched with --scheduled-send
            let is_scheduled = std::env::args().any(|a| a == "--scheduled-send");

            // System tray
            let tray_quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_show = MenuItem::with_id(app, "show", "Open", true, None::<&str>)?;
            let tray_send =
                MenuItem::with_id(app, "send_now", "Send Report...", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&tray_show, &tray_send, &tray_quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
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
            commands::reports::list_recent_reports,
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

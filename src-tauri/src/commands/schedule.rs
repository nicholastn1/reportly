use crate::scheduler;

#[tauri::command]
pub fn install_launch_agent() -> Result<(), String> {
    scheduler::install_agent()
}

#[tauri::command]
pub fn uninstall_launch_agent() -> Result<(), String> {
    scheduler::uninstall_agent()
}

#[tauri::command]
pub fn get_launch_agent_status() -> Result<bool, String> {
    Ok(scheduler::is_agent_installed())
}

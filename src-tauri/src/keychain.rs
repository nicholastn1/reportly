use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};
use std::sync::Once;

const SERVICE: &str = "com.reportly";
const OLD_SERVICE: &str = "com.dailyreport.manager";

static MIGRATE_ONCE: Once = Once::new();

const ACCOUNTS: &[&str] = &[
    "discord-token",
    "openai-api-key",
    "gitlab-token",
    "jira-token",
    "confluence-token",
    "github-token",
];

fn migrate_from_old_service() {
    MIGRATE_ONCE.call_once(|| {
        for account in ACCOUNTS {
            if let Ok(bytes) = get_generic_password(OLD_SERVICE, account) {
                let value = String::from_utf8_lossy(&bytes);
                if set_generic_password(SERVICE, account, value.as_bytes()).is_ok() {
                    delete_generic_password(OLD_SERVICE, account).ok();
                }
            }
        }
    });
}

fn get_key(account: &str) -> Result<String, String> {
    migrate_from_old_service();
    get_generic_password(SERVICE, account)
        .map(|bytes| String::from_utf8_lossy(&bytes).to_string())
        .map_err(|e| format!("Not found in Keychain: {}", e))
}

fn save_key(account: &str, value: &str) -> Result<(), String> {
    migrate_from_old_service();
    delete_generic_password(SERVICE, account).ok();
    set_generic_password(SERVICE, account, value.as_bytes())
        .map_err(|e| format!("Failed to save: {}", e))
}

fn has_key(account: &str) -> bool {
    migrate_from_old_service();
    get_generic_password(SERVICE, account).is_ok()
}

// Discord token
pub fn get_token() -> Result<String, String> {
    get_key("discord-token")
}
pub fn save_token(token: &str) -> Result<(), String> {
    save_key("discord-token", token)
}
pub fn has_token() -> bool {
    has_key("discord-token")
}

// OpenAI API key
pub fn get_openai_key() -> Result<String, String> {
    get_key("openai-api-key")
}
pub fn save_openai_key(key: &str) -> Result<(), String> {
    save_key("openai-api-key", key)
}
pub fn has_openai_key() -> bool {
    has_key("openai-api-key")
}

// Connector tokens (gitlab, jira, confluence, github)
pub fn get_connector_token(connector: &str) -> Result<String, String> {
    get_key(&format!("{}-token", connector))
}
pub fn save_connector_token(connector: &str, token: &str) -> Result<(), String> {
    save_key(&format!("{}-token", connector), token)
}
pub fn has_connector_token(connector: &str) -> bool {
    has_key(&format!("{}-token", connector))
}

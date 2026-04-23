use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

/// Возвращает информацию о приложении
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "КОНТЕНТУМ Studio".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

/// Возвращает текущую платформу
#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

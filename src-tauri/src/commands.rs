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

// --- Stage D: Аппаратные кодировщики ---

/// Информация о кодировщике
#[derive(Serialize, Clone)]
pub struct EncoderInfo {
    /// Идентификатор кодировщика (videotoolbox, nvenc, qsv, amf, cpu)
    pub name: String,
    /// Тип: "hw" (аппаратный) или "sw" (программный)
    pub encoder_type: String,
    /// Платформа: macOS, Windows, все
    pub platform: String,
    /// Человекочитаемое название
    pub label: String,
    /// Доступен ли на текущей системе
    pub available: bool,
    /// Оценка нагрузки на CPU (0-100%)
    pub estimated_cpu_usage: u8,
}

/// Результат детекции кодировщиков
#[derive(Serialize)]
pub struct EncoderDetectionResult {
    /// Все кодировщики с информацией о доступности
    pub encoders: Vec<EncoderInfo>,
    /// Рекомендуемый кодировщик для этой системы
    pub recommended: String,
}

/// Информация о системе
#[derive(Serialize)]
pub struct SystemInfo {
    /// Операционная система
    pub os: String,
    /// Архитектура процессора
    pub arch: String,
    /// Количество логических ядер CPU
    pub cpu_cores: usize,
    /// Имя GPU (если удалось определить)
    pub gpu_name: Option<String>,
}

/// Детектирует доступные аппаратные кодировщики.
/// macOS: VideoToolbox всегда доступен.
/// Windows: проверяет наличие DLL для NVENC, QSV, AMF.
/// Linux: только CPU.
#[tauri::command]
pub fn detect_encoders() -> EncoderDetectionResult {
    let os = std::env::consts::OS;
    let mut encoders = Vec::new();
    let mut recommended = String::from("cpu");

    // VideoToolbox (macOS)
    let vt_available = os == "macos";
    encoders.push(EncoderInfo {
        name: "videotoolbox".to_string(),
        encoder_type: "hw".to_string(),
        platform: "macOS".to_string(),
        label: "VideoToolbox (Apple)".to_string(),
        available: vt_available,
        estimated_cpu_usage: 5,
    });

    // NVENC (NVIDIA) — проверяем наличие DLL на Windows
    let nvenc_available = if os == "windows" {
        check_nvenc_available()
    } else {
        false
    };
    encoders.push(EncoderInfo {
        name: "nvenc".to_string(),
        encoder_type: "hw".to_string(),
        platform: "Windows".to_string(),
        label: "NVENC (NVIDIA)".to_string(),
        available: nvenc_available,
        estimated_cpu_usage: 5,
    });

    // QSV (Intel Quick Sync) — проверяем наличие DLL на Windows
    let qsv_available = if os == "windows" {
        check_qsv_available()
    } else {
        false
    };
    encoders.push(EncoderInfo {
        name: "qsv".to_string(),
        encoder_type: "hw".to_string(),
        platform: "Windows".to_string(),
        label: "Quick Sync (Intel)".to_string(),
        available: qsv_available,
        estimated_cpu_usage: 8,
    });

    // AMF (AMD) — проверяем наличие DLL на Windows
    let amf_available = if os == "windows" {
        check_amf_available()
    } else {
        false
    };
    encoders.push(EncoderInfo {
        name: "amf".to_string(),
        encoder_type: "hw".to_string(),
        platform: "Windows".to_string(),
        label: "AMF (AMD)".to_string(),
        available: amf_available,
        estimated_cpu_usage: 7,
    });

    // CPU (программный) — всегда доступен
    encoders.push(EncoderInfo {
        name: "cpu".to_string(),
        encoder_type: "sw".to_string(),
        platform: "все".to_string(),
        label: "CPU (программный)".to_string(),
        available: true,
        estimated_cpu_usage: 65,
    });

    // Определяем рекомендуемый: приоритет аппаратных
    if vt_available {
        recommended = "videotoolbox".to_string();
    } else if nvenc_available {
        recommended = "nvenc".to_string();
    } else if qsv_available {
        recommended = "qsv".to_string();
    } else if amf_available {
        recommended = "amf".to_string();
    }

    EncoderDetectionResult {
        encoders,
        recommended,
    }
}

/// Проверяет наличие NVIDIA NVENC по DLL
fn check_nvenc_available() -> bool {
    #[cfg(target_os = "windows")]
    {
        let paths = [
            "C:\\Windows\\System32\\nvEncodeAPI64.dll",
            "C:\\Windows\\System32\\nvEncodeAPI.dll",
            "C:\\Windows\\System32\\nvcuda.dll",
        ];
        return paths.iter().any(|p| std::path::Path::new(p).exists());
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

/// Проверяет наличие Intel Quick Sync Video по DLL
fn check_qsv_available() -> bool {
    #[cfg(target_os = "windows")]
    {
        let paths = [
            "C:\\Windows\\System32\\mfx_mft_h264vd_64.dll",
            "C:\\Windows\\System32\\mfxhw64.dll",
            "C:\\Windows\\System32\\libmfxhw64.dll",
            "C:\\Windows\\System32\\igfx11cmrt64.dll",
        ];
        return paths.iter().any(|p| std::path::Path::new(p).exists());
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

/// Проверяет наличие AMD AMF по DLL
fn check_amf_available() -> bool {
    #[cfg(target_os = "windows")]
    {
        let paths = [
            "C:\\Windows\\System32\\amfrt64.dll",
            "C:\\Windows\\System32\\amdh264enc64.dll",
        ];
        return paths.iter().any(|p| std::path::Path::new(p).exists());
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

/// Возвращает информацию о системе: ОС, архитектура, ядра CPU, GPU
#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    let cpu_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);

    let gpu_name = detect_gpu_name();

    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpu_cores,
        gpu_name,
    }
}

/// Пытается определить имя GPU через системные утилиты
fn detect_gpu_name() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        // На macOS используем system_profiler
        if let Ok(output) = std::process::Command::new("system_profiler")
            .args(["SPDisplaysDataType", "-detailLevel", "mini"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("Chipset Model:") || trimmed.starts_with("Chip:") {
                    return Some(trimmed.split(':').nth(1)?.trim().to_string());
                }
            }
        }
        None
    }

    #[cfg(target_os = "windows")]
    {
        // На Windows используем WMIC
        if let Ok(output) = std::process::Command::new("wmic")
            .args(["path", "Win32_VideoController", "get", "Name", "/value"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("Name=") {
                    return Some(trimmed.trim_start_matches("Name=").trim().to_string());
                }
            }
        }
        None
    }

    #[cfg(target_os = "linux")]
    {
        // На Linux используем lspci
        if let Ok(output) = std::process::Command::new("lspci").output() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if line.contains("VGA") || line.contains("3D") || line.contains("Display") {
                    // Формат: "XX:XX.X VGA compatible controller: НАЗВАНИЕ"
                    if let Some(name) = line.split(':').last() {
                        return Some(name.trim().to_string());
                    }
                }
            }
        }
        None
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        None
    }
}

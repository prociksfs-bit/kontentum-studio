import { useState, useCallback } from "react";

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

const GITHUB_REPO = "prociksfs-bit/kontentum-studio";

// Глобальная переменная, подставляется Vite через define
declare const __APP_VERSION__: string;
const CURRENT_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

/**
 * Хук для проверки обновлений через GitHub Releases API.
 * Сравнивает текущую версию с последней на GitHub.
 */
export function useUpdateChecker() {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    setError(null);

    try {
      const resp = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          headers: { Accept: "application/vnd.github.v3+json" },
        }
      );

      if (!resp.ok) {
        if (resp.status === 404) {
          setError("Релизы не найдены");
          return;
        }
        throw new Error(`GitHub API ошибка: ${resp.status}`);
      }

      const data = await resp.json();
      const latestVersion = (data.tag_name as string).replace(/^v/, "");

      // Определяем платформу и ищем нужный ассет
      const platform = detectPlatform();
      const assets = data.assets as Array<{ name: string; browser_download_url: string }>;

      let downloadUrl = data.html_url; // fallback на страницу релиза
      for (const asset of assets) {
        if (matchesPlatform(asset.name, platform)) {
          downloadUrl = asset.browser_download_url;
          break;
        }
      }

      const available = compareVersions(latestVersion, CURRENT_VERSION) > 0;

      const info: UpdateInfo = {
        available,
        currentVersion: CURRENT_VERSION,
        latestVersion,
        downloadUrl,
        releaseNotes: data.body || "",
        publishedAt: data.published_at || "",
      };

      setUpdateInfo(info);
      console.log(
        available
          ? `Доступна новая версия: ${latestVersion} (текущая: ${CURRENT_VERSION})`
          : `Установлена последняя версия: ${CURRENT_VERSION}`
      );
    } catch (err: any) {
      const msg = err.message || "Ошибка проверки обновлений";
      setError(msg);
      console.error("Ошибка проверки обновлений:", msg);
    } finally {
      setChecking(false);
    }
  }, []);

  const openDownload = useCallback(async () => {
    if (!updateInfo?.downloadUrl) return;

    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(updateInfo.downloadUrl);
    } catch {
      window.open(updateInfo.downloadUrl, "_blank");
    }
  }, [updateInfo]);

  const dismiss = useCallback(() => setUpdateInfo(null), []);

  return { checking, updateInfo, error, checkForUpdates, openDownload, dismiss };
}

// Определение платформы
function detectPlatform(): "mac-arm" | "mac-intel" | "windows" | "unknown" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) {
    // Apple Silicon detection (не точный, но для Apple чипов подходит)
    // В Tauri мы можем определить точнее через Rust, но для простоты используем UA
    if (ua.includes("arm") || !ua.includes("intel")) {
      return "mac-arm";
    }
    return "mac-intel";
  }
  if (ua.includes("win")) return "windows";
  return "unknown";
}

// Проверка соответствия ассета платформе
function matchesPlatform(filename: string, platform: string): boolean {
  const f = filename.toLowerCase();
  switch (platform) {
    case "mac-arm":
      return f.includes("aarch64") && (f.endsWith(".dmg") || f.endsWith(".app.tar.gz"));
    case "mac-intel":
      return f.includes("x86_64") && f.includes("darwin") && (f.endsWith(".dmg") || f.endsWith(".app.tar.gz"));
    case "windows":
      return f.endsWith(".exe") || f.endsWith(".msi");
    default:
      return false;
  }
}

// Сравнение версий: > 0 если a > b
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

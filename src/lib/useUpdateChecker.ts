import { useState, useCallback, useEffect } from "react";

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

// Глобальная переменная, подставляется Vite через define
declare const __APP_VERSION__: string;
const CURRENT_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

/**
 * Хук для проверки и установки обновлений.
 * Использует Tauri Updater Plugin (нативное обновление без переустановки).
 * Fallback на GitHub Releases API если плагин недоступен.
 */
export function useUpdateChecker() {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  // Проверка через Tauri Updater Plugin
  const checkViaTauri = useCallback(async (): Promise<boolean> => {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update) {
        console.log(`Tauri Updater: доступна v${update.version} (текущая: ${CURRENT_VERSION})`);
        setUpdateInfo({
          available: true,
          currentVersion: CURRENT_VERSION,
          latestVersion: update.version,
          downloadUrl: "", // Не нужен — Tauri обновляет сам
          releaseNotes: update.body || "",
          publishedAt: update.date || "",
        });

        // Сохраняем объект update для последующей установки
        (window as any).__tauriUpdate = update;
        return true;
      } else {
        console.log(`Tauri Updater: установлена последняя версия ${CURRENT_VERSION}`);
        setUpdateInfo({
          available: false,
          currentVersion: CURRENT_VERSION,
          latestVersion: CURRENT_VERSION,
          downloadUrl: "",
          releaseNotes: "",
          publishedAt: "",
        });
        return true;
      }
    } catch (err: any) {
      console.warn("Tauri Updater недоступен:", err?.message || err);
      return false;
    }
  }, []);

  // Fallback: проверка через GitHub Releases API
  const checkViaGitHub = useCallback(async () => {
    const resp = await fetch(
      "https://api.github.com/repos/prociksfs-bit/kontentum-studio/releases/latest",
      { headers: { Accept: "application/vnd.github.v3+json" } }
    );

    if (!resp.ok) {
      if (resp.status === 404) {
        setError("Релизы не найдены");
        return;
      }
      throw new Error(`GitHub API: ${resp.status}`);
    }

    const data = await resp.json();
    const latestVersion = (data.tag_name as string).replace(/^v/, "");
    const platform = detectPlatform();
    const assets = data.assets as Array<{ name: string; browser_download_url: string }>;

    let downloadUrl = data.html_url;
    for (const asset of assets) {
      if (matchesPlatform(asset.name, platform)) {
        downloadUrl = asset.browser_download_url;
        break;
      }
    }

    const available = compareVersions(latestVersion, CURRENT_VERSION) > 0;

    setUpdateInfo({
      available,
      currentVersion: CURRENT_VERSION,
      latestVersion,
      downloadUrl,
      releaseNotes: data.body || "",
      publishedAt: data.published_at || "",
    });

    console.log(
      available
        ? `GitHub: доступна v${latestVersion} (текущая: ${CURRENT_VERSION})`
        : `GitHub: установлена последняя версия ${CURRENT_VERSION}`
    );
  }, []);

  // Основная функция проверки
  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    setError(null);

    try {
      // Сначала пробуем Tauri Updater (нативные обновления)
      const tauriOk = await checkViaTauri();
      if (!tauriOk) {
        // Fallback на GitHub
        await checkViaGitHub();
      }
    } catch (err: any) {
      const msg = err?.message || "Ошибка проверки обновлений";
      setError(msg);
      console.error("Ошибка проверки обновлений:", msg);
    } finally {
      setChecking(false);
    }
  }, [checkViaTauri, checkViaGitHub]);

  // Установка обновления через Tauri или открытие ссылки
  const openDownload = useCallback(async () => {
    // Если есть объект обновления от Tauri — устанавливаем нативно
    const tauriUpdate = (window as any).__tauriUpdate;
    if (tauriUpdate) {
      try {
        setInstalling(true);
        console.log("Скачиваем и устанавливаем обновление...");

        await tauriUpdate.downloadAndInstall((event: any) => {
          if (event.event === "Started" && event.data?.contentLength) {
            console.log(`Скачивание: ${(event.data.contentLength / 1024 / 1024).toFixed(1)} МБ`);
          } else if (event.event === "Progress") {
            // Прогресс скачивания
          } else if (event.event === "Finished") {
            console.log("Скачивание завершено, устанавливаем...");
          }
        });

        console.log("Обновление установлено! Перезапуск...");

        // Перезапуск приложения
        try {
          const { relaunch } = await import("@tauri-apps/plugin-process");
          await relaunch();
        } catch {
          console.warn("Не удалось перезапустить автоматически. Перезапустите приложение вручную.");
        }
      } catch (err: any) {
        console.error("Ошибка установки обновления:", err?.message || err);
        setError(`Ошибка установки: ${err?.message || "неизвестно"}`);
        setInstalling(false);
      }
      return;
    }

    // Fallback — открываем URL скачивания
    if (!updateInfo?.downloadUrl) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(updateInfo.downloadUrl);
    } catch {
      window.open(updateInfo.downloadUrl, "_blank");
    }
  }, [updateInfo]);

  const dismiss = useCallback(() => {
    setUpdateInfo(null);
    (window as any).__tauriUpdate = null;
  }, []);

  // Проверяем обновления при старте (через 3 секунды)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return { checking, updateInfo, error, installing, checkForUpdates, openDownload, dismiss };
}

// Определение платформы
function detectPlatform(): "mac-arm" | "mac-intel" | "windows" | "unknown" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) {
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

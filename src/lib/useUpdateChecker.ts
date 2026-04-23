import { useState, useCallback, useEffect, useRef } from "react";

/** Состояния процесса обновления */
export type UpdateStatus =
  | "idle"        // Начальное состояние
  | "checking"    // Проверяем наличие обновлений
  | "available"   // Обновление доступно
  | "downloading" // Скачиваем обновление
  | "installing"  // Устанавливаем обновление
  | "upToDate"    // Установлена последняя версия
  | "error";      // Ошибка

/** Прогресс скачивания обновления */
export interface DownloadProgress {
  /** Скачано байт */
  downloaded: number;
  /** Общий размер в байтах (0 если неизвестен) */
  total: number;
  /** Процент скачивания (0-100) */
  percent: number;
}

/** Информация о доступном обновлении */
export interface UpdateInfo {
  /** Версия доступного обновления */
  version: string;
  /** Текущая версия приложения */
  currentVersion: string;
  /** Список изменений (release notes / changelog) */
  changelog: string;
  /** Дата публикации */
  publishedAt: string;
}

/** Возвращаемый тип хука */
export interface UseUpdateCheckerReturn {
  /** Текущий статус обновления */
  status: UpdateStatus;
  /** Информация об обновлении (если доступно) */
  updateInfo: UpdateInfo | null;
  /** Прогресс скачивания */
  progress: DownloadProgress;
  /** Текст ошибки */
  errorMessage: string | null;
  /** Запустить проверку обновлений вручную */
  checkForUpdates: () => Promise<void>;
  /** Скачать и установить обновление */
  installUpdate: () => Promise<void>;
  /** Скрыть баннер обновлений */
  dismiss: () => void;
}

// Глобальная переменная версии, подставляется Vite через define
declare const __APP_VERSION__: string;
const CURRENT_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

/** Задержка перед автоматической проверкой (мс) */
const AUTO_CHECK_DELAY = 5000;

/**
 * Хук для проверки и установки обновлений через Tauri Updater Plugin.
 *
 * Обеспечивает полный цикл: проверка -> скачивание с прогрессом -> установка -> перезапуск.
 * Автоматически проверяет обновления при монтировании (с задержкой 5 сек).
 */
export function useUpdateChecker(): UseUpdateCheckerReturn {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress>({ downloaded: 0, total: 0, percent: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ссылка на объект обновления от Tauri (сохраняем между рендерами)
  const updateRef = useRef<any>(null);

  /**
   * Проверяет наличие обновлений через Tauri Updater Plugin.
   * Если плагин недоступен (dev-режим, web) — показывает соответствующую ошибку.
   */
  const checkForUpdates = useCallback(async () => {
    setStatus("checking");
    setErrorMessage(null);
    setProgress({ downloaded: 0, total: 0, percent: 0 });

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update) {
        console.log(`[Updater] Доступна v${update.version} (текущая: ${CURRENT_VERSION})`);

        // Сохраняем объект обновления для последующей установки
        updateRef.current = update;

        setUpdateInfo({
          version: update.version,
          currentVersion: CURRENT_VERSION,
          changelog: update.body || "",
          publishedAt: update.date || "",
        });
        setStatus("available");
      } else {
        console.log(`[Updater] Установлена последняя версия ${CURRENT_VERSION}`);
        updateRef.current = null;
        setUpdateInfo(null);
        setStatus("upToDate");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Updater] Ошибка проверки:", msg);
      setErrorMessage(msg);
      setStatus("error");
    }
  }, []);

  /**
   * Скачивает и устанавливает обновление с отслеживанием прогресса.
   * После успешной установки перезапускает приложение.
   */
  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) {
      setErrorMessage("Объект обновления не найден. Проверьте обновления заново.");
      setStatus("error");
      return;
    }

    setStatus("downloading");
    setProgress({ downloaded: 0, total: 0, percent: 0 });
    setErrorMessage(null);

    try {
      let totalBytes = 0;
      let downloadedBytes = 0;

      // Скачиваем и устанавливаем с колбэком прогресса
      await update.downloadAndInstall((event: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => {
        switch (event.event) {
          case "Started": {
            // Получаем общий размер файла
            totalBytes = event.data?.contentLength ?? 0;
            console.log(`[Updater] Скачивание начато: ${totalBytes > 0 ? (totalBytes / 1024 / 1024).toFixed(1) + " МБ" : "размер неизвестен"}`);
            setProgress({ downloaded: 0, total: totalBytes, percent: 0 });
            break;
          }
          case "Progress": {
            // Обновляем прогресс скачивания
            const chunkLen = event.data?.chunkLength ?? 0;
            downloadedBytes += chunkLen;
            const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
            setProgress({ downloaded: downloadedBytes, total: totalBytes, percent });
            break;
          }
          case "Finished": {
            console.log("[Updater] Скачивание завершено, устанавливаем...");
            setProgress({ downloaded: totalBytes, total: totalBytes, percent: 100 });
            setStatus("installing");
            break;
          }
        }
      });

      console.log("[Updater] Обновление установлено, перезапуск...");

      // Перезапуск приложения
      try {
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch (relErr: unknown) {
        const msg = relErr instanceof Error ? relErr.message : String(relErr);
        console.warn("[Updater] Не удалось перезапустить автоматически:", msg);
        setErrorMessage("Обновление установлено. Перезапустите приложение вручную.");
        setStatus("error");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Updater] Ошибка установки:", msg);
      setErrorMessage(`Ошибка установки: ${msg}`);
      setStatus("error");
    }
  }, []);

  /**
   * Скрывает баннер обновлений и сбрасывает состояние.
   */
  const dismiss = useCallback(() => {
    setStatus("idle");
    setUpdateInfo(null);
    setErrorMessage(null);
    setProgress({ downloaded: 0, total: 0, percent: 0 });
    // Не сбрасываем updateRef — можно будет вернуться к обновлению
  }, []);

  // Автоматическая проверка при старте (задержка 5 сек)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, AUTO_CHECK_DELAY);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    status,
    updateInfo,
    progress,
    errorMessage,
    checkForUpdates,
    installUpdate,
    dismiss,
  };
}

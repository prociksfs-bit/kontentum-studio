import type { UpdateInfo } from "../lib/useUpdateChecker";

interface Props {
  checking: boolean;
  updateInfo: UpdateInfo | null;
  error: string | null;
  installing?: boolean;
  onCheck: () => void;
  onDownload: () => void;
  onDismiss: () => void;
}

/**
 * Баннер обновлений.
 * Поддерживает нативное обновление через Tauri Updater и скачивание из GitHub.
 */
export default function UpdateBanner({
  checking,
  updateInfo,
  error,
  installing,
  onCheck,
  onDownload,
  onDismiss,
}: Props) {
  // Процесс установки
  if (installing) {
    return (
      <div className="update-banner available">
        <span className="update-icon">⏳</span>
        <div className="update-text">
          <strong>Устанавливаем обновление...</strong>
          <span className="update-sub">Не закрывайте приложение. После установки оно перезапустится автоматически.</span>
        </div>
      </div>
    );
  }

  // Если есть обновление — показываем баннер
  if (updateInfo?.available) {
    return (
      <div className="update-banner available">
        <span className="update-icon">🚀</span>
        <div className="update-text">
          <strong>Доступна версия {updateInfo.latestVersion}</strong>
          <span className="update-sub">
            Текущая: {updateInfo.currentVersion}
          </span>
        </div>
        <button className="update-btn download" onClick={onDownload}>
          {updateInfo.downloadUrl ? "Скачать" : "Обновить сейчас"}
        </button>
        <button className="update-btn dismiss" onClick={onDismiss}>
          ✕
        </button>
      </div>
    );
  }

  // Если проверили и обновлений нет
  if (updateInfo && !updateInfo.available) {
    return (
      <div className="update-banner uptodate">
        <span className="update-icon">✅</span>
        <span>Версия {updateInfo.currentVersion} — последняя</span>
        <button className="update-btn dismiss" onClick={onDismiss}>
          ✕
        </button>
      </div>
    );
  }

  // Ошибка
  if (error) {
    return (
      <div className="update-banner error-banner">
        <span className="update-icon">⚠️</span>
        <span>{error}</span>
        <button className="update-btn" onClick={onCheck}>
          Повторить
        </button>
        <button className="update-btn dismiss" onClick={onDismiss}>
          ✕
        </button>
      </div>
    );
  }

  return null;
}

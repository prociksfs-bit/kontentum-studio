import type { UpdateInfo } from "../lib/useUpdateChecker";

interface Props {
  checking: boolean;
  updateInfo: UpdateInfo | null;
  error: string | null;
  onCheck: () => void;
  onDownload: () => void;
  onDismiss: () => void;
}

/**
 * Баннер обновлений.
 * Показывает кнопку проверки и уведомление о новой версии.
 */
export default function UpdateBanner({
  checking,
  updateInfo,
  error,
  onCheck,
  onDownload,
  onDismiss,
}: Props) {
  // Если есть обновление — показываем баннер
  if (updateInfo?.available) {
    return (
      <div className="update-banner available">
        <span className="update-icon">🚀</span>
        <div className="update-text">
          <strong>Доступна версия {updateInfo.latestVersion}</strong>
          <span className="update-sub">Текущая: {updateInfo.currentVersion}</span>
        </div>
        <button className="update-btn download" onClick={onDownload}>
          Скачать
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

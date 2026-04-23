import type { UpdateStatus, UpdateInfo, DownloadProgress } from "../lib/useUpdateChecker";

interface Props {
  /** Текущий статус обновления */
  status: UpdateStatus;
  /** Информация о доступном обновлении */
  updateInfo: UpdateInfo | null;
  /** Прогресс скачивания */
  progress: DownloadProgress;
  /** Текст ошибки */
  errorMessage: string | null;
  /** Проверить обновления */
  onCheck: () => void;
  /** Скачать и установить */
  onInstall: () => void;
  /** Скрыть баннер */
  onDismiss: () => void;
}

/**
 * Форматирует байты в читаемый вид (КБ, МБ).
 */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 Б";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/**
 * Баннер обновлений с прогресс-баром и информацией о версии.
 *
 * Состояния:
 * - idle / checking — ничего не показываем (или спиннер)
 * - available — баннер с информацией и кнопками "Обновить" / "Позже"
 * - downloading — прогресс-бар скачивания
 * - installing — сообщение об установке
 * - upToDate — краткое подтверждение
 * - error — ошибка с кнопкой повтора
 */
export default function UpdateBanner({
  status,
  updateInfo,
  progress,
  errorMessage,
  onCheck,
  onInstall,
  onDismiss,
}: Props) {
  // Не показываем баннер в состоянии idle или checking
  if (status === "idle" || status === "checking") {
    return null;
  }

  // Обновление доступно
  if (status === "available" && updateInfo) {
    return (
      <div className="update-banner available">
        <span className="update-icon">🚀</span>
        <div className="update-text">
          <strong>Доступна версия {updateInfo.version}</strong>
          <span className="update-sub">
            Текущая: {updateInfo.currentVersion}
            {updateInfo.changelog && (
              <> &mdash; {truncateChangelog(updateInfo.changelog)}</>
            )}
          </span>
        </div>
        <button className="update-btn download" onClick={onInstall}>
          Обновить и перезапустить
        </button>
        <button className="update-btn later" onClick={onDismiss}>
          Позже
        </button>
      </div>
    );
  }

  // Скачивание с прогресс-баром
  if (status === "downloading") {
    const percentText = progress.total > 0 ? `${progress.percent}%` : "...";
    const sizeText = progress.total > 0
      ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`
      : formatBytes(progress.downloaded);

    return (
      <div className="update-banner available">
        <span className="update-icon">⬇️</span>
        <div className="update-text" style={{ flex: 1 }}>
          <strong>Скачивание обновления {percentText}</strong>
          <span className="update-sub">{sizeText}</span>
          <div className="update-progress-bar">
            <div
              className="update-progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Установка
  if (status === "installing") {
    return (
      <div className="update-banner available">
        <span className="update-icon">⏳</span>
        <div className="update-text">
          <strong>Устанавливаем обновление...</strong>
          <span className="update-sub">
            Не закрывайте приложение. После установки оно перезапустится автоматически.
          </span>
        </div>
      </div>
    );
  }

  // Актуальная версия
  if (status === "upToDate") {
    return (
      <div className="update-banner uptodate">
        <span className="update-icon">✅</span>
        <span>Установлена последняя версия</span>
        <button className="update-btn dismiss" onClick={onDismiss}>
          ✕
        </button>
      </div>
    );
  }

  // Ошибка
  if (status === "error") {
    return (
      <div className="update-banner error-banner">
        <span className="update-icon">⚠️</span>
        <span>{errorMessage || "Ошибка проверки обновлений"}</span>
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

/**
 * Обрезает changelog до первой строки (максимум 80 символов).
 */
function truncateChangelog(text: string): string {
  // Берём первую непустую строку
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))[0] || "";

  if (firstLine.length > 80) {
    return firstLine.slice(0, 77) + "...";
  }
  return firstLine;
}

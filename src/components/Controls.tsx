import { useState, useRef, useCallback } from "react";
import type { StreamConfig, MediaSource } from "../App";

interface Props {
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  config: StreamConfig;
  sources: MediaSource[];
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  onToggleSource: (id: string) => void;
  onOpenSettings: () => void;
  userName?: string;
}

/**
 * Панель управления эфиром в стиле вебинарной платформы.
 */
export default function Controls({
  isLive,
  setIsLive,
  config,
  sources,
  cameraStream,
  screenStream,
  onToggleSource,
  onOpenSettings,
  userName,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStartStop = useCallback(() => {
    if (isLive) {
      // Остановить эфир
      setIsLive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    } else {
      if (!config.serverUrl || !config.token) {
        return;
      }

      // Старт эфира
      setIsLive(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
  }, [isLive, config, setIsLive]);

  const micSource = sources.find((s) => s.type === "microphone");
  const camSource = sources.find((s) => s.type === "camera");

  return (
    <>
      {/* Шапка */}
      <div className="app-header">
        <span className="hdr-logo">КОНТЕНТУМ STUDIO</span>

        <div className="hdr-right">
          {/* Таймер */}
          <div className={`timer-display ${isLive ? "live" : ""}`}>
            {formatTime(elapsed)}
          </div>

          {/* Статус подключения */}
          {isLive && (
            <div className="live-pill">
              <span className="live-dot" />
              LIVE
            </div>
          )}

          <div className="conn-status">
            <span className={`csd ${config.serverUrl ? (isLive ? "green" : "amber") : "red"}`} />
            {config.serverUrl ? (isLive ? "В эфире" : "Готов") : "Нет подключения"}
          </div>

          {/* Имя пользователя */}
          {userName && (
            <div className="hdr-user">
              <span className="u-avatar">{userName.charAt(0).toUpperCase()}</span>
              <span>{userName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Нижняя панель */}
      <div className="ctrl-bar">
        {/* Камера */}
        <button
          className={`cb ${camSource?.enabled ? "on" : "off"}`}
          onClick={() => camSource && onToggleSource(camSource.id)}
        >
          <span className="ci">📷</span>
          {camSource?.enabled ? "Камера" : "Камера"}
        </button>

        {/* Микрофон */}
        <button
          className={`cb ${micSource?.enabled ? "on" : "off"}`}
          onClick={() => micSource && onToggleSource(micSource.id)}
        >
          <span className="ci">{micSource?.enabled ? "🎤" : "🔇"}</span>
          {micSource?.enabled ? "Микрофон" : "Без звука"}
        </button>

        <div className="cb-sep" />

        {/* Кнопка START/STOP */}
        {isLive ? (
          <button className="cb rec-on" onClick={handleStartStop}>
            <span className="ci">⏺</span>
            СТОП
          </button>
        ) : (
          <button
            className="cb on"
            onClick={handleStartStop}
            style={
              config.serverUrl && config.token
                ? { background: "rgba(0, 255, 157, 0.12)", borderColor: "rgba(0, 255, 157, 0.4)", color: "var(--green)" }
                : { opacity: 0.4, cursor: "not-allowed" }
            }
          >
            <span className="ci">▶</span>
            ЭФИР
          </button>
        )}

        <div className="cb-sep" />

        {/* Настройки */}
        <button className="cb" onClick={onOpenSettings}>
          <span className="ci">⚙️</span>
          Настройки
        </button>

        {/* Завершить */}
        {isLive && (
          <>
            <div className="cb-sep" />
            <button className="cb end" onClick={handleStartStop}>
              <span className="ci">⏹</span>
              Завершить
            </button>
          </>
        )}
      </div>
    </>
  );
}

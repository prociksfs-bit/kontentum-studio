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
  onToggleLogs: () => void;
  onCheckUpdates: () => void;
  checkingUpdates: boolean;
  showLogs: boolean;
}

/**
 * Нижняя панель управления эфиром.
 */
export default function BottomBar({
  isLive,
  setIsLive,
  config,
  sources,
  cameraStream,
  screenStream,
  onToggleSource,
  onOpenSettings,
  onToggleLogs,
  onCheckUpdates,
  checkingUpdates,
  showLogs,
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
      setIsLive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
      console.log("Эфир остановлен");
    } else {
      if (!config.serverUrl || !config.token) {
        console.warn("Нельзя начать эфир: не указан сервер или токен");
        return;
      }
      setIsLive(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
      console.log(`Эфир начат | Сервер: ${config.serverUrl}`);
    }
  }, [isLive, config, setIsLive]);

  const micSource = sources.find((s) => s.type === "microphone");
  const camSource = sources.find((s) => s.type === "camera");

  return (
    <div className="ctrl-bar">
      {/* Таймер */}
      <div className={`timer-display ${isLive ? "live" : ""}`}>
        {formatTime(elapsed)}
      </div>

      <div className="cb-sep" />

      {/* Камера */}
      <button
        className={`cb ${camSource?.enabled ? "on" : "off"}`}
        onClick={() => camSource && onToggleSource(camSource.id)}
      >
        <span className="ci">📷</span>
        Камера
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
          className="cb start-btn"
          onClick={handleStartStop}
          disabled={!config.serverUrl || !config.token}
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

      {/* Логи */}
      <button
        className={`cb ${showLogs ? "on" : ""}`}
        onClick={onToggleLogs}
      >
        <span className="ci">📋</span>
        Логи
      </button>

      {/* Обновления */}
      <button
        className="cb"
        onClick={onCheckUpdates}
        disabled={checkingUpdates}
        style={checkingUpdates ? { opacity: 0.5 } : undefined}
      >
        <span className="ci">{checkingUpdates ? "⏳" : "🔄"}</span>
        {checkingUpdates ? "..." : "Обновить"}
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
  );
}

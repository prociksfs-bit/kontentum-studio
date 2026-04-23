import { useState, useRef, useCallback } from "react";
import type { StreamConfig, MediaSource } from "../App";

interface Props {
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  config: StreamConfig;
  sources: MediaSource[];
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  onOpenConnect: () => void;
  onOpenSettings: () => void;
}

export default function Controls({
  isLive,
  setIsLive,
  config,
  sources,
  cameraStream,
  screenStream,
  onOpenConnect,
  onOpenSettings,
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
      // Проверяем подключение
      if (!config.serverUrl || !config.token) {
        onOpenConnect();
        return;
      }

      // Старт эфира
      setIsLive(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
  }, [isLive, config, setIsLive, onOpenConnect]);

  const micSource = sources.find((s) => s.type === "microphone");
  const camSource = sources.find((s) => s.type === "camera");

  return (
    <div className="controls">
      <div className="controls-left">
        {/* Таймер */}
        <div className={`timer ${isLive ? "live" : ""}`}>
          {formatTime(elapsed)}
        </div>
      </div>

      <div className="controls-center">
        {/* Кнопка START/STOP */}
        <button
          className={`btn-stream ${isLive ? "stop" : "start"}`}
          onClick={handleStartStop}
        >
          {isLive ? "⏹ Завершить эфир" : "▶ Начать эфир"}
        </button>
      </div>

      <div className="controls-right">
        <button className="btn-control" onClick={onOpenConnect} title="Подключение">
          🔗
        </button>
        <button className="btn-control" onClick={onOpenSettings} title="Настройки">
          ⚙️
        </button>
      </div>
    </div>
  );
}

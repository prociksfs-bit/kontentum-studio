import { useState, useRef, useCallback } from "react";
import type { StreamConfig, MediaSource } from "../App";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

const PLATFORM_URL = "https://xn--e1ajhcbd3acj.xn--p1ai";

interface Props {
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  config: StreamConfig;
  sources: MediaSource[];
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  onToggleSource: (id: string) => void;
  onOpenSettings: () => void;
  onToggleChat: () => void;
  showChat: boolean;
  hostToken: string;
  roomId: string;
  liveKitConnecting?: boolean;
  participantCount?: number;
  onGoBack?: () => void;
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
  onToggleChat,
  showChat,
  hostToken,
  roomId,
  liveKitConnecting,
  participantCount,
  onGoBack,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [recStatus, setRecStatus] = useState("");
  const [recFile, setRecFile] = useState<string | null>(null);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStartStop = useCallback(async () => {
    if (isLive) {
      await setIsLive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    } else {
      if (!config.serverUrl || !config.token) {
        console.warn("Нельзя начать эфир: не указан сервер или токен");
        return;
      }
      await setIsLive(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
  }, [isLive, config, setIsLive]);

  // Скопировать ссылку для зрителей в буфер обмена
  const handleCopyLink = useCallback(async () => {
    if (!roomId) return;
    const viewerUrl = `https://контентум.рф/vebinar/room.html?id=${roomId}`;
    try {
      await writeText(viewerUrl);
      setLinkCopied(true);
      console.log("Ссылка скопирована:", viewerUrl);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // Fallback на navigator.clipboard
      try {
        await navigator.clipboard.writeText(viewerUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      } catch (e) {
        console.error("Не удалось скопировать ссылку:", e);
      }
    }
  }, [roomId]);

  // Запустить серверную запись (LiveKit Egress — нет нагрузки на компьютер)
  const handleStartRecording = useCallback(async () => {
    if (!hostToken || !roomId) {
      console.warn("Нет hostToken или roomId для записи");
      return;
    }
    try {
      setRecStatus("Запускаем запись...");
      const resp = await tauriFetch(`${PLATFORM_URL}/vebinar/api/start-recording`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Host-Token": hostToken },
        body: JSON.stringify({ roomId }),
      });
      const data = await resp.json();
      if (data.egressId) {
        setEgressId(data.egressId);
        setIsRecording(true);
        setRecStatus("");
        console.log("Запись начата, egressId:", data.egressId);
      } else {
        setRecStatus(`Ошибка: ${data.error || "неизвестно"}`);
      }
    } catch (e: any) {
      setRecStatus(`Ошибка записи: ${e.message}`);
      console.error("Ошибка старта записи:", e);
    }
  }, [hostToken, roomId]);

  // Остановить серверную запись
  const handleStopRecording = useCallback(async () => {
    if (!egressId || !hostToken) return;
    try {
      setRecStatus("Останавливаем...");
      const resp = await tauriFetch(`${PLATFORM_URL}/vebinar/api/stop-recording`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Host-Token": hostToken },
        body: JSON.stringify({ egressId }),
      });
      const data = await resp.json();
      setIsRecording(false);
      setEgressId(null);
      setRecStatus("");
      if (data.filename) {
        setRecFile(data.filename);
      }
      console.log("Запись остановлена:", data.filename);
    } catch (e: any) {
      setRecStatus(`Ошибка остановки: ${e.message}`);
    }
  }, [egressId, hostToken]);

  const micSource = sources.find((s) => s.type === "microphone");
  const camSource = sources.find((s) => s.type === "camera");

  return (
    <>
      {/* Баннер готовой записи */}
      {recFile && (
        <div className="rec-done-banner">
          <span>✅ Запись готова: <b>{recFile}</b></span>
          <a
            href={`${PLATFORM_URL}/vebinar/recordings/${recFile}`}
            target="_blank"
            rel="noreferrer"
            className="rec-dl-link"
          >
            ⬇ Скачать
          </a>
          <button onClick={() => setRecFile(null)}>✕</button>
        </div>
      )}

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
          disabled={!config.serverUrl || !config.token || liveKitConnecting}
        >
          <span className="ci">{liveKitConnecting ? "⏳" : "▶"}</span>
          {liveKitConnecting ? "ПОДКЛЮЧЕНИЕ..." : "ЭФИР"}
        </button>
      )}

      {/* Счётчик зрителей */}
      {isLive && participantCount !== undefined && participantCount > 0 && (
        <div className="cb" style={{ cursor: "default", opacity: 0.7 }}>
          <span className="ci">👥</span>
          {participantCount}
        </div>
      )}

      <div className="cb-sep" />

      {/* Ссылка для зрителей */}
      {roomId && (
        <button
          className={`cb ${linkCopied ? "on" : ""}`}
          onClick={handleCopyLink}
          title={`Скопировать ссылку: контентум.рф/vebinar/room.html?id=${roomId}`}
        >
          <span className="ci">{linkCopied ? "✅" : "🔗"}</span>
          {linkCopied ? "Скопировано!" : "Ссылка"}
        </button>
      )}

      {/* Запись на сервере */}
      {hostToken && roomId && (
        isRecording ? (
          <button className="cb rec-on" onClick={handleStopRecording} title="Запись идёт на сервере — без нагрузки на ваш ПК">
            <span className="ci">⏹</span>
            {recStatus || "Стоп запись"}
          </button>
        ) : (
          <button className="cb" onClick={handleStartRecording} title="Серверная запись (LiveKit Egress)">
            <span className="ci">⏺</span>
            {recStatus || "Запись"}
          </button>
        )
      )}

      <div className="cb-sep" />

      {/* Настройки */}
      <button className="cb" onClick={onOpenSettings}>
        <span className="ci">⚙️</span>
        Настройки
      </button>

      {/* Чат */}
      <button className={`cb ${showChat ? "on" : ""}`} onClick={onToggleChat}>
        <span className="ci">💬</span>
        Чат
      </button>

      {/* Кнопка возврата на welcome-экран (когда не в эфире) */}
      {!isLive && onGoBack && (
        <button className="cb" onClick={onGoBack}>
          <span className="ci">←</span>
          Назад
        </button>
      )}
    </div>
    </>
  );
}

import { useEffect, useRef } from "react";
import type { MediaSource, StreamConfig } from "../App";

interface Props {
  userName: string;
  config: StreamConfig;
  sources: MediaSource[];
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  micEnabled: boolean;
  onToggleSource: (id: string) => void;
  onStartScreenCapture: () => void;
  onStopScreenCapture: () => void;
  onOpenSettings: () => void;
  onStartLive: () => Promise<void>;
  onLogout: () => void;
  liveKitConnecting?: boolean;
  roomId?: string;
}

/**
 * Экран приветствия (Welcome Card) — отображается после авторизации, до начала эфира.
 * Neumorphic-стиль в тёмно-синей палитре.
 */
export default function WelcomeCard({
  userName,
  sources,
  cameraStream,
  screenStream,
  onToggleSource,
  onStartScreenCapture,
  onStopScreenCapture,
  onOpenSettings,
  onStartLive,
  onLogout,
  liveKitConnecting,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const camSource = sources.find((s) => s.type === "camera");
  const micSource = sources.find((s) => s.type === "microphone");

  // Автозапуск видео в превью при наличии стрима
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    } else if (videoRef.current && !cameraStream) {
      videoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  // Автоматически включаем камеру и микрофон если у нас уже есть разрешения
  useEffect(() => {
    const autoEnable = async () => {
      if (!navigator.permissions) return;
      try {
        const [camPerm, micPerm] = await Promise.all([
          navigator.permissions.query({ name: "camera" as PermissionName }),
          navigator.permissions.query({ name: "microphone" as PermissionName }),
        ]);
        if (camPerm.state === "granted" && camSource && !camSource.enabled) {
          onToggleSource(camSource.id);
        }
        if (micPerm.state === "granted" && micSource && !micSource.enabled) {
          onToggleSource(micSource.id);
        }
      } catch {
        // Браузер не поддерживает permissions API — игнорируем
      }
    };
    autoEnable();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Первое слово имени как приветствие
  const firstName = userName.split(" ")[0] || userName;

  const handleScreenPill = () => {
    if (screenStream) {
      onStopScreenCapture();
    } else {
      onStartScreenCapture();
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        {/* Логотип */}
        <div className="welcome-logo">
          <div className="welcome-logo-title">КОНТЕНТУМ</div>
          <div className="welcome-logo-sub">STUDIO</div>
        </div>

        {/* Приветствие */}
        <div className="welcome-greeting">Привет, {firstName}! 👋</div>
        <div className="welcome-subtitle">Настройте источники и начните эфир</div>

        {/* Превью камеры */}
        <div className="welcome-preview">
          {cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div className="welcome-preview-placeholder">
              <span style={{ fontSize: 36 }}>📷</span>
              <span>Включите камеру</span>
            </div>
          )}
        </div>

        {/* Пилюли источников */}
        <div className="source-pills">
          {/* Камера */}
          <button
            className={`source-pill ${camSource?.enabled ? "active" : ""}`}
            onClick={() => camSource && onToggleSource(camSource.id)}
          >
            📷<br />
            {camSource?.enabled ? "Камера" : "Камера"}
          </button>

          {/* Микрофон */}
          <button
            className={`source-pill ${micSource?.enabled ? "active" : ""}`}
            onClick={() => micSource && onToggleSource(micSource.id)}
          >
            {micSource?.enabled ? "🎤" : "🔇"}<br />
            {micSource?.enabled ? "Микрофон" : "Без звука"}
          </button>

          {/* Экран */}
          <button
            className={`source-pill ${screenStream ? "active" : ""}`}
            onClick={handleScreenPill}
          >
            🖥<br />
            {screenStream ? "Экран ✓" : "Экран"}
          </button>
        </div>

        {/* Кнопка начала эфира */}
        <button
          className="welcome-start-btn"
          onClick={onStartLive}
          disabled={liveKitConnecting}
        >
          {liveKitConnecting ? "⏳ Подключение..." : "▶ Начать эфир"}
        </button>

        {/* Футер */}
        <div className="welcome-footer">
          <button className="welcome-link" onClick={onOpenSettings}>
            ⚙ Настройки
          </button>
          <button className="welcome-link" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}

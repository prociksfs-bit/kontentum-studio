import { useEffect, useRef } from "react";
import type { MediaSource } from "../App";

interface Props {
  sources: MediaSource[];
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  setCameraStream: (s: MediaStream | null) => void;
  setScreenStream: (s: MediaStream | null) => void;
  isLive: boolean;
}

/** Проверка доступности MediaDevices API */
function hasMediaDevices(): boolean {
  return !!(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export default function Preview({
  sources,
  cameraStream,
  screenStream,
  setCameraStream,
  setScreenStream,
  isLive,
}: Props) {
  const cameraRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

  // Захват камеры
  const cameraSource = sources.find((s) => s.type === "camera" && s.enabled);
  const screenSource = sources.find((s) => s.type === "screen" && s.enabled);

  useEffect(() => {
    if (cameraSource && !cameraStream) {
      if (!hasMediaDevices()) {
        console.warn("MediaDevices API недоступен — камера не может быть захвачена");
        return;
      }
      try {
        navigator.mediaDevices
          .getUserMedia({
            video: { deviceId: cameraSource.deviceId ? { exact: cameraSource.deviceId } : undefined },
            audio: false,
          })
          .then((stream) => {
            setCameraStream(stream);
          })
          .catch((err) => console.error("Ошибка захвата камеры:", err));
      } catch (err) {
        console.error("Критическая ошибка при запросе камеры:", err);
      }
    }

    if (!cameraSource && cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  }, [cameraSource, cameraStream, setCameraStream]);

  useEffect(() => {
    if (screenSource && !screenStream) {
      if (!hasMediaDevices()) {
        console.warn("MediaDevices API недоступен — захват экрана невозможен");
        return;
      }
      try {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then((stream) => {
            setScreenStream(stream);
            // Обработка остановки захвата пользователем
            stream.getVideoTracks()[0].onended = () => setScreenStream(null);
          })
          .catch((err) => console.error("Ошибка захвата экрана:", err));
      } catch (err) {
        console.error("Критическая ошибка при запросе экрана:", err);
      }
    }

    if (!screenSource && screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
  }, [screenSource, screenStream, setScreenStream]);

  // Привязка потоков к video элементам
  useEffect(() => {
    if (cameraRef.current && cameraStream) {
      cameraRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (screenRef.current && screenStream) {
      screenRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const hasScreen = !!screenStream;
  const hasCamera = !!cameraStream;

  return (
    <div className="preview">
      {/* Индикатор LIVE */}
      {isLive && (
        <div className="live-badge">
          <span className="live-dot" />
          LIVE
        </div>
      )}

      {/* Основная область */}
      <div className={`preview-canvas ${hasScreen ? "with-screen" : ""}`}>
        {hasScreen && (
          <video
            ref={screenRef}
            className="preview-screen"
            autoPlay
            playsInline
            muted
          />
        )}

        {hasCamera && (
          <video
            ref={cameraRef}
            className={`preview-camera ${hasScreen ? "pip" : "full"}`}
            autoPlay
            playsInline
            muted
          />
        )}

        {!hasCamera && !hasScreen && (
          <div className="preview-placeholder">
            <div className="placeholder-icon">📷</div>
            <div className="placeholder-text">
              Включите камеру или захват экрана
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

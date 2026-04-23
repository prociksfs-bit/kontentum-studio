import { useEffect, useRef } from "react";
import type { MediaSource } from "../App";

interface CropSettings {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Props {
  sources: MediaSource[];
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  isLive: boolean;
  cameraCrop: CropSettings;
  screenCrop: CropSettings;
  pipShape: "rect" | "round";
}

/**
 * Область предпросмотра видео с поддержкой кроппинга и PiP.
 */
export default function Preview({
  sources,
  cameraStream,
  screenStream,
  isLive,
  cameraCrop,
  screenCrop,
  pipShape,
}: Props) {
  const cameraRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

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

  // Стиль кроппинга для камеры
  const getCropStyle = (crop: CropSettings, mode: "full" | "pip"): React.CSSProperties => {
    const hasCrop = crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0;
    if (!hasCrop) return {};

    // Используем object-position + scale для эмуляции кроппинга
    const scaleX = 100 / (100 - crop.left - crop.right);
    const scaleY = 100 / (100 - crop.top - crop.bottom);
    const scale = Math.max(scaleX, scaleY);

    const translateX = ((crop.left - crop.right) / 2) * scale;
    const translateY = ((crop.top - crop.bottom) / 2) * scale;

    return {
      transform: `scale(${scale}) translate(${-translateX}%, ${-translateY}%)`,
      transformOrigin: "center center",
    };
  };

  // Стиль кроппинга для экрана
  const getScreenCropStyle = (): React.CSSProperties => {
    const crop = screenCrop;
    const hasCrop = crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0;
    if (!hasCrop) return {};

    const scaleX = 100 / (100 - crop.left - crop.right);
    const scaleY = 100 / (100 - crop.top - crop.bottom);
    const scale = Math.max(scaleX, scaleY);

    const translateX = ((crop.left - crop.right) / 2) * scale;
    const translateY = ((crop.top - crop.bottom) / 2) * scale;

    return {
      transform: `scale(${scale}) translate(${-translateX}%, ${-translateY}%)`,
      transformOrigin: "center center",
    };
  };

  return (
    <div className="preview">
      {/* Индикатор LIVE */}
      {isLive && (
        <div className="live-pill" style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }}>
          <span className="live-dot" />
          LIVE
        </div>
      )}

      {/* Основная область */}
      <div className="preview-canvas">
        {hasScreen && (
          <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            <video
              ref={screenRef}
              className="preview-screen"
              autoPlay
              playsInline
              muted
              style={getScreenCropStyle()}
            />
          </div>
        )}

        {hasCamera && (
          <div
            className={hasScreen ? "pip-wrapper" : ""}
            style={hasScreen ? {
              position: "absolute",
              bottom: 12,
              right: 12,
              width: pipShape === "round" ? 130 : 200,
              height: pipShape === "round" ? 130 : 125,
              borderRadius: pipShape === "round" ? "50%" : 14,
              overflow: "hidden",
              border: "2px solid rgba(0, 245, 255, 0.3)",
              boxShadow: "0 0 20px rgba(0, 245, 255, 0.15)",
              zIndex: 5,
              cursor: "grab",
            } : { width: "100%", height: "100%", overflow: "hidden" }}
          >
            <video
              ref={cameraRef}
              className={`preview-camera ${hasScreen ? "pip" : "full"}`}
              autoPlay
              playsInline
              muted
              style={{
                ...getCropStyle(cameraCrop, hasScreen ? "pip" : "full"),
                width: "100%",
                height: "100%",
                objectFit: "cover",
                ...(hasScreen ? {
                  position: "static",
                  border: "none",
                  borderRadius: 0,
                  boxShadow: "none",
                } : {}),
              }}
            />
          </div>
        )}

        {!hasCamera && !hasScreen && (
          <div className="preview-placeholder">
            <div className="placeholder-icon">📡</div>
            <div className="placeholder-text">
              Подключите камеру или захватите экран
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

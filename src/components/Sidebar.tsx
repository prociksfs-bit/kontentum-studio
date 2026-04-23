import { useState, useEffect, useCallback } from "react";
import type { MediaSource } from "../App";
import { useMediaDevices } from "../lib/useMediaDevices";

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
  onToggleSource: (id: string) => void;
  onUpdateSource: (id: string, updates: Partial<MediaSource>) => void;
  onStartScreenCapture: () => void;
  onStopScreenCapture: () => void;
  cameraCrop: CropSettings;
  screenCrop: CropSettings;
  onCameraCropChange: (crop: CropSettings) => void;
  onScreenCropChange: (crop: CropSettings) => void;
  pipShape: "rect" | "round";
  onPipShapeChange: (shape: "rect" | "round") => void;
}

/**
 * Боковая панель с управлением устройствами, захватом экрана и кроппингом.
 */
export default function Sidebar({
  sources,
  cameraStream,
  screenStream,
  onToggleSource,
  onUpdateSource,
  onStartScreenCapture,
  onStopScreenCapture,
  cameraCrop,
  screenCrop,
  onCameraCropChange,
  onScreenCropChange,
  pipShape,
  onPipShapeChange,
}: Props) {
  const { cameras, microphones, refreshDevices } = useMediaDevices();
  const [devicesLoaded, setDevicesLoaded] = useState(false);

  const cameraSource = sources.find((s) => s.type === "camera");
  const micSource = sources.find((s) => s.type === "microphone");

  // Загрузить устройства при монтировании
  useEffect(() => {
    refreshDevices().then(() => setDevicesLoaded(true));
  }, [refreshDevices]);

  // Обработчик выбора камеры
  const handleCameraSelect = useCallback(
    (deviceId: string) => {
      if (cameraSource) {
        onUpdateSource(cameraSource.id, { deviceId, label: cameras.find((c) => c.deviceId === deviceId)?.label || "Камера" });
      }
    },
    [cameraSource, cameras, onUpdateSource],
  );

  // Обработчик выбора микрофона
  const handleMicSelect = useCallback(
    (deviceId: string) => {
      if (micSource) {
        onUpdateSource(micSource.id, { deviceId, label: microphones.find((m) => m.deviceId === deviceId)?.label || "Микрофон" });
      }
    },
    [micSource, microphones, onUpdateSource],
  );

  return (
    <aside className="sidebar">
      {/* Камера */}
      <div className="sidebar-section">
        <h3>Камера</h3>
        <div className="device-group">
          <div className="device-group-header">
            <span className="device-group-title">
              📷 Видео
            </span>
            <button
              className={`device-toggle ${cameraSource?.enabled ? "on" : "off"}`}
              onClick={() => cameraSource && onToggleSource(cameraSource.id)}
            >
              {cameraSource?.enabled ? "ON" : "OFF"}
            </button>
          </div>

          {cameras.length > 0 ? (
            <select
              className="device-select"
              value={cameraSource?.deviceId || ""}
              onChange={(e) => handleCameraSelect(e.target.value)}
            >
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: 11, color: "var(--muted)", padding: "6px 0" }}>
              {devicesLoaded ? "Камеры не найдены" : "Загрузка устройств..."}
            </div>
          )}

          {/* Форма камеры PiP */}
          {cameraSource?.enabled && screenStream && (
            <div className="pip-shape-row">
              <button
                className={`pip-shape-btn ${pipShape === "rect" ? "active" : ""}`}
                onClick={() => onPipShapeChange("rect")}
              >
                Прямоугольная
              </button>
              <button
                className={`pip-shape-btn ${pipShape === "round" ? "active" : ""}`}
                onClick={() => onPipShapeChange("round")}
              >
                Круглая
              </button>
            </div>
          )}

          {/* Кроппинг камеры */}
          {cameraSource?.enabled && cameraStream && (
            <div className="crop-section">
              <div className="crop-title">Обрезка камеры</div>
              {(["top", "bottom", "left", "right"] as const).map((side) => (
                <div className="crop-row" key={side}>
                  <span className="crop-label">
                    {side === "top" ? "Верх" : side === "bottom" ? "Низ" : side === "left" ? "Лево" : "Право"}
                  </span>
                  <input
                    type="range"
                    className="crop-slider"
                    min={0}
                    max={40}
                    value={cameraCrop[side]}
                    onChange={(e) => onCameraCropChange({ ...cameraCrop, [side]: Number(e.target.value) })}
                  />
                  <span className="crop-value">{cameraCrop[side]}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Микрофон */}
      <div className="sidebar-section">
        <h3>Микрофон</h3>
        <div className="device-group">
          <div className="device-group-header">
            <span className="device-group-title">
              🎤 Аудио
            </span>
            <button
              className={`device-toggle ${micSource?.enabled ? "on" : "off"}`}
              onClick={() => micSource && onToggleSource(micSource.id)}
            >
              {micSource?.enabled ? "ON" : "OFF"}
            </button>
          </div>

          {microphones.length > 0 ? (
            <select
              className="device-select"
              value={micSource?.deviceId || ""}
              onChange={(e) => handleMicSelect(e.target.value)}
            >
              {microphones.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: 11, color: "var(--muted)", padding: "6px 0" }}>
              {devicesLoaded ? "Микрофоны не найдены" : "Загрузка устройств..."}
            </div>
          )}
        </div>
      </div>

      {/* Захват экрана */}
      <div className="sidebar-section">
        <h3>Захват экрана</h3>
        <div className="screen-capture-section">
          {!screenStream ? (
            <>
              <button
                className="screen-mode-btn"
                onClick={onStartScreenCapture}
                style={{ width: "100%", marginBottom: 0 }}
              >
                🖥 Выбрать экран или окно
              </button>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
                Система предложит выбрать весь экран или конкретное окно
              </div>
            </>
          ) : (
            <>
              <div className="screen-status">
                🖥 Захват активен
                <button className="screen-stop-btn" onClick={onStopScreenCapture}>
                  Остановить
                </button>
              </div>

              {/* Кроппинг экрана */}
              <div className="crop-section">
                <div className="crop-title">Обрезка экрана</div>
                {(["top", "bottom", "left", "right"] as const).map((side) => (
                  <div className="crop-row" key={side}>
                    <span className="crop-label">
                      {side === "top" ? "Верх" : side === "bottom" ? "Низ" : side === "left" ? "Лево" : "Право"}
                    </span>
                    <input
                      type="range"
                      className="crop-slider"
                      min={0}
                      max={40}
                      value={screenCrop[side]}
                      onChange={(e) => onScreenCropChange({ ...screenCrop, [side]: Number(e.target.value) })}
                    />
                    <span className="crop-value">{screenCrop[side]}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

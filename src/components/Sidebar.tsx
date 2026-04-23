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
  onStartScreenCapture: (surface?: "monitor" | "window") => void;
  onStopScreenCapture: () => void;
  cameraCrop: CropSettings;
  screenCrop: CropSettings;
  onCameraCropChange: (crop: CropSettings) => void;
  onScreenCropChange: (crop: CropSettings) => void;
  pipShape: "rect" | "round";
  onPipShapeChange: (shape: "rect" | "round") => void;
}

/** Максимальное значение обрезки */
const CROP_MAX = 50;

/**
 * Секция обрезки с ползунками и числовыми полями ввода.
 */
function CropSection({
  title,
  crop,
  onCropChange,
}: {
  title: string;
  crop: CropSettings;
  onCropChange: (crop: CropSettings) => void;
}) {
  const sides = ["top", "bottom", "left", "right"] as const;
  const labels: Record<string, string> = {
    top: "Верх",
    bottom: "Низ",
    left: "Лево",
    right: "Право",
  };

  /** Обработчик изменения числового поля */
  const handleInputChange = useCallback(
    (side: keyof CropSettings, rawValue: string) => {
      const parsed = parseInt(rawValue, 10);
      const value = isNaN(parsed) ? 0 : Math.max(0, Math.min(CROP_MAX, parsed));
      onCropChange({ ...crop, [side]: value });
    },
    [crop, onCropChange],
  );

  /** Сброс всех значений */
  const handleReset = useCallback(() => {
    onCropChange({ top: 0, bottom: 0, left: 0, right: 0 });
  }, [onCropChange]);

  const hasCrop = crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0;

  return (
    <div className="crop-section">
      <div className="crop-title-row">
        <div className="crop-title">{title}</div>
        {hasCrop && (
          <button
            className="crop-reset-btn"
            onClick={handleReset}
            title="Сбросить обрезку"
          >
            Сброс
          </button>
        )}
      </div>
      {sides.map((side) => (
        <div className="crop-row" key={side}>
          <span className="crop-label">{labels[side]}</span>
          <input
            type="range"
            className="crop-slider"
            min={0}
            max={CROP_MAX}
            value={crop[side]}
            onChange={(e) => onCropChange({ ...crop, [side]: Number(e.target.value) })}
          />
          <input
            type="number"
            className="crop-number-input"
            min={0}
            max={CROP_MAX}
            value={crop[side]}
            onChange={(e) => handleInputChange(side, e.target.value)}
          />
          <span className="crop-value-unit">%</span>
        </div>
      ))}
    </div>
  );
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
  const [showScreenMenu, setShowScreenMenu] = useState(false);

  const cameraSource = sources.find((s) => s.type === "camera");
  const micSource = sources.find((s) => s.type === "microphone");

  useEffect(() => {
    refreshDevices().then(() => setDevicesLoaded(true));
  }, [refreshDevices]);

  // Закрываем меню при клике вне него
  useEffect(() => {
    if (!showScreenMenu) return;
    const handler = () => setShowScreenMenu(false);
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, [showScreenMenu]);

  const handleCameraSelect = useCallback(
    (deviceId: string) => {
      if (cameraSource) {
        onUpdateSource(cameraSource.id, { deviceId, label: cameras.find((c) => c.deviceId === deviceId)?.label || "Камера" });
      }
    },
    [cameraSource, cameras, onUpdateSource],
  );

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
            <span className="device-group-title">📷 Видео</span>
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
              {devicesLoaded ? "Камеры не найдены" : "Загрузка..."}
            </div>
          )}

          {/* Форма PiP */}
          {cameraSource?.enabled && screenStream && (
            <div className="pip-shape-row">
              <button
                className={`pip-shape-btn ${pipShape === "rect" ? "active" : ""}`}
                onClick={() => onPipShapeChange("rect")}
              >Прямоугольная</button>
              <button
                className={`pip-shape-btn ${pipShape === "round" ? "active" : ""}`}
                onClick={() => onPipShapeChange("round")}
              >Круглая</button>
            </div>
          )}

          {/* Кроппинг камеры */}
          {cameraSource?.enabled && cameraStream && (
            <CropSection
              title="Обрезка камеры"
              crop={cameraCrop}
              onCropChange={onCameraCropChange}
            />
          )}
        </div>
      </div>

      {/* Микрофон */}
      <div className="sidebar-section">
        <h3>Микрофон</h3>
        <div className="device-group">
          <div className="device-group-header">
            <span className="device-group-title">🎤 Аудио</span>
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
              {devicesLoaded ? "Микрофоны не найдены" : "Загрузка..."}
            </div>
          )}
        </div>
      </div>

      {/* Захват экрана */}
      <div className="sidebar-section">
        <h3>Захват экрана</h3>
        <div className="screen-capture-section">
          {!screenStream ? (
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {/* Основная кнопка — весь экран */}
                <button
                  className="screen-mode-btn"
                  style={{ flex: 1 }}
                  onClick={() => onStartScreenCapture("monitor")}
                >
                  🖥 Весь экран
                </button>
                {/* Кнопка открытия меню */}
                <button
                  className="screen-mode-btn"
                  style={{ padding: "0 12px", fontSize: 16 }}
                  onClick={(e) => { e.stopPropagation(); setShowScreenMenu((v) => !v); }}
                  title="Выбрать источник"
                >
                  ▾
                </button>
              </div>

              {/* Выпадающее меню */}
              {showScreenMenu && (
                <div className="screen-menu">
                  <button
                    className="screen-menu-item"
                    onClick={() => { onStartScreenCapture("monitor"); setShowScreenMenu(false); }}
                  >
                    🖥 Весь экран
                  </button>
                  <button
                    className="screen-menu-item"
                    onClick={() => { onStartScreenCapture("window"); setShowScreenMenu(false); }}
                  >
                    🪟 Окно приложения
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="screen-status">
                🖥 Захват активен
                <button className="screen-stop-btn" onClick={onStopScreenCapture}>
                  Остановить
                </button>
              </div>

              {/* Кроппинг экрана */}
              <CropSection
                title="Обрезка экрана"
                crop={screenCrop}
                onCropChange={onScreenCropChange}
              />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

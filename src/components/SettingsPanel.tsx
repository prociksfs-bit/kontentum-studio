import { useState, useEffect } from "react";
import type { StreamConfig, EncoderType } from "../App";

interface Props {
  config: StreamConfig;
  onChange: (config: StreamConfig) => void;
  onClose: () => void;
}

/** Описания кодировщиков */
const ENCODER_INFO: Record<EncoderType, { label: string; desc: string; platform: string }> = {
  auto: {
    label: "Авто",
    desc: "Автоматический выбор лучшего кодировщика для вашей системы",
    platform: "все",
  },
  videotoolbox: {
    label: "VideoToolbox (Apple)",
    desc: "Аппаратное кодирование Apple. Минимальная нагрузка на CPU",
    platform: "macOS",
  },
  nvenc: {
    label: "NVENC (NVIDIA)",
    desc: "Аппаратное кодирование на GPU NVIDIA. Лучшее качество при низкой нагрузке",
    platform: "Windows",
  },
  qsv: {
    label: "Quick Sync (Intel)",
    desc: "Аппаратное кодирование Intel. Хорошо для встроенной графики",
    platform: "Windows",
  },
  cpu: {
    label: "CPU (программный)",
    desc: "Программное кодирование VP8. Работает везде, но высокая нагрузка на процессор",
    platform: "все",
  },
};

/**
 * Определяет рекомендуемый кодировщик на основе платформы.
 * Приоритет: VideoToolbox (macOS) → NVENC (Windows NVIDIA) → QSV (Windows Intel) → CPU
 */
function detectBestEncoder(): { recommended: EncoderType; available: EncoderType[] } {
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || "";
  const isMac = /mac/i.test(platform) || /mac/i.test(ua);
  const isWindows = /win/i.test(platform) || /win/i.test(ua);

  // Всегда доступны
  const available: EncoderType[] = ["auto", "cpu"];

  if (isMac) {
    available.splice(1, 0, "videotoolbox"); // После auto, перед cpu
    return { recommended: "videotoolbox", available };
  }

  if (isWindows) {
    // На Windows доступны оба аппаратных варианта — пользователь выбирает
    available.splice(1, 0, "nvenc", "qsv");
    return { recommended: "nvenc", available };
  }

  // Linux и другие — только CPU
  return { recommended: "cpu", available };
}

/**
 * Возвращает видеокодек для LiveKit на основе выбранного кодировщика.
 * H.264 → задействует аппаратное ускорение (VideoToolbox / NVENC / QSV)
 * VP8 → программное кодирование (CPU)
 */
export function getVideoCodecForEncoder(encoder: EncoderType): "h264" | "vp8" {
  if (encoder === "cpu") return "vp8";
  if (encoder === "auto") {
    const { recommended } = detectBestEncoder();
    return recommended === "cpu" ? "vp8" : "h264";
  }
  // videotoolbox, nvenc, qsv — все используют H.264
  return "h264";
}

/**
 * Панель настроек эфира с выбором кодировщика.
 */
export default function SettingsPanel({ config, onChange, onClose }: Props) {
  const [detection] = useState(() => detectBestEncoder());

  // При первом открытии — если encoder = auto, показать что рекомендуется
  const [showEncoderHint, setShowEncoderHint] = useState(config.encoder === "auto");

  const currentEncoder = config.encoder;
  const codecInfo = getVideoCodecForEncoder(currentEncoder);
  const encoderMeta = ENCODER_INFO[currentEncoder];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Настройки эфира</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* --- Секция: Видео --- */}
          <div className="settings-section">
            <div className="settings-section-title">Видео</div>

            {/* Разрешение */}
            <div className="field">
              <label>Разрешение</label>
              <select
                value={config.resolution}
                onChange={(e) =>
                  onChange({ ...config, resolution: e.target.value as "720p" | "1080p" })
                }
              >
                <option value="720p">1280×720 (HD)</option>
                <option value="1080p">1920×1080 (Full HD)</option>
              </select>
            </div>

            {/* FPS */}
            <div className="field">
              <label>Кадров в секунду</label>
              <select
                value={config.fps}
                onChange={(e) => onChange({ ...config, fps: Number(e.target.value) })}
              >
                <option value={24}>24 FPS</option>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>

            {/* Битрейт */}
            <div className="field">
              <label>Битрейт видео</label>
              <input
                type="range"
                min={1000}
                max={8000}
                step={500}
                value={config.bitrate}
                onChange={(e) => onChange({ ...config, bitrate: Number(e.target.value) })}
              />
              <span className="field-hint">{config.bitrate} kbps</span>
            </div>
          </div>

          {/* --- Секция: Кодировщик --- */}
          <div className="settings-section">
            <div className="settings-section-title">Кодировщик</div>

            <div className="field">
              <label>Тип кодировщика</label>
              <select
                value={currentEncoder}
                onChange={(e) => {
                  onChange({ ...config, encoder: e.target.value as EncoderType });
                  setShowEncoderHint(false);
                }}
              >
                {detection.available.map((enc) => (
                  <option key={enc} value={enc}>
                    {ENCODER_INFO[enc].label}
                    {enc === detection.recommended ? " ★" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Описание выбранного кодировщика */}
            <div className="encoder-info">
              <div className="encoder-info-row">
                <span className="encoder-info-label">Описание:</span>
                <span>{encoderMeta.desc}</span>
              </div>
              <div className="encoder-info-row">
                <span className="encoder-info-label">Видеокодек:</span>
                <span className="encoder-codec-badge">{codecInfo.toUpperCase()}</span>
                <span className="encoder-info-note">
                  {codecInfo === "h264"
                    ? "— аппаратное ускорение, низкая нагрузка"
                    : "— программное кодирование, высокая нагрузка"}
                </span>
              </div>
              {showEncoderHint && (
                <div className="encoder-recommendation">
                  💡 Рекомендуется: <strong>{ENCODER_INFO[detection.recommended].label}</strong>
                </div>
              )}
            </div>
          </div>

          {/* --- Секция: Подключение --- */}
          <div className="settings-section">
            <div className="settings-section-title">Подключение</div>

            {/* URL сервера */}
            <div className="field">
              <label>URL сервера</label>
              <input
                type="text"
                value={config.serverUrl}
                onChange={(e) => onChange({ ...config, serverUrl: e.target.value })}
                placeholder="wss://your-server.com"
              />
            </div>

            {/* Токен */}
            <div className="field">
              <label>Токен доступа</label>
              <input
                type="password"
                value={config.token}
                onChange={(e) => onChange({ ...config, token: e.target.value })}
                placeholder="eyJ..."
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

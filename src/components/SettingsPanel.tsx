import { useState, useEffect } from "react";
import type { StreamConfig, EncoderType, EncoderDetectionResult, SystemInfo } from "../App";
import type { ConnectionStats } from "../lib/useConnectionQuality";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  config: StreamConfig;
  onChange: (config: StreamConfig) => void;
  onClose: () => void;
  /** Результат детекции кодировщиков из Rust (может быть null при первом рендере) */
  encoderDetection?: EncoderDetectionResult | null;
  /** Информация о системе */
  systemInfo?: SystemInfo | null;
  /** Сейчас в эфире — показывать статистику */
  isLive?: boolean;
  /** Текущие метрики соединения */
  connectionStats?: ConnectionStats;
}

/** Описания кодировщиков (фоллбэк, если Rust не ответил) */
const ENCODER_INFO: Record<
  EncoderType,
  { label: string; desc: string; platform: string; estimatedCpu: number }
> = {
  auto: {
    label: "Авто",
    desc: "Автоматический выбор лучшего кодировщика для вашей системы",
    platform: "все",
    estimatedCpu: 0,
  },
  videotoolbox: {
    label: "VideoToolbox (Apple)",
    desc: "Аппаратное кодирование Apple. Минимальная нагрузка на CPU",
    platform: "macOS",
    estimatedCpu: 5,
  },
  nvenc: {
    label: "NVENC (NVIDIA)",
    desc: "Аппаратное кодирование на GPU NVIDIA. Лучшее качество при низкой нагрузке",
    platform: "Windows",
    estimatedCpu: 5,
  },
  qsv: {
    label: "Quick Sync (Intel)",
    desc: "Аппаратное кодирование Intel. Хорошо для встроенной графики",
    platform: "Windows",
    estimatedCpu: 8,
  },
  amf: {
    label: "AMF (AMD)",
    desc: "Аппаратное кодирование AMD. Хорошее качество на видеокартах Radeon",
    platform: "Windows",
    estimatedCpu: 7,
  },
  cpu: {
    label: "CPU (программный)",
    desc: "Программное кодирование VP8. Работает везде, но высокая нагрузка на процессор",
    platform: "все",
    estimatedCpu: 65,
  },
};

/** Пресеты настроек стрима */
const PRESETS: Record<string, { label: string; resolution: "720p" | "1080p"; fps: number; bitrate: number; desc: string }> = {
  quality: {
    label: "Качество",
    resolution: "1080p",
    fps: 60,
    bitrate: 6000,
    desc: "Максимальное качество: 1080p60, 6000 kbps",
  },
  balanced: {
    label: "Баланс",
    resolution: "1080p",
    fps: 30,
    bitrate: 4000,
    desc: "Оптимальный баланс: 1080p30, 4000 kbps",
  },
  performance: {
    label: "Экономный",
    resolution: "720p",
    fps: 30,
    bitrate: 2500,
    desc: "Минимальная нагрузка: 720p30, 2500 kbps",
  },
};

/**
 * Определяет рекомендуемый кодировщик на основе платформы (фоллбэк без Rust).
 */
function detectBestEncoderFallback(): { recommended: EncoderType; available: EncoderType[] } {
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || "";
  const isMac = /mac/i.test(platform) || /mac/i.test(ua);
  const isWindows = /win/i.test(platform) || /win/i.test(ua);

  const available: EncoderType[] = ["auto", "cpu"];

  if (isMac) {
    available.splice(1, 0, "videotoolbox");
    return { recommended: "videotoolbox", available };
  }

  if (isWindows) {
    available.splice(1, 0, "nvenc", "qsv", "amf");
    return { recommended: "nvenc", available };
  }

  return { recommended: "cpu", available };
}

/**
 * Возвращает видеокодек для LiveKit на основе выбранного кодировщика.
 * H.264 задействует аппаратное ускорение (VideoToolbox / NVENC / QSV / AMF).
 * VP8 — программное кодирование (CPU).
 */
export function getVideoCodecForEncoder(encoder: EncoderType): "h264" | "vp8" {
  if (encoder === "cpu") return "vp8";
  if (encoder === "auto") {
    const { recommended } = detectBestEncoderFallback();
    return recommended === "cpu" ? "vp8" : "h264";
  }
  // videotoolbox, nvenc, qsv, amf — все используют H.264
  return "h264";
}

/**
 * Панель настроек эфира с детекцией аппаратных кодировщиков,
 * пресетами качества и статистикой в реальном времени.
 */
export default function SettingsPanel({
  config,
  onChange,
  onClose,
  encoderDetection,
  systemInfo,
  isLive,
  connectionStats,
}: Props) {
  // Фоллбэк детекция если Rust не ответил
  const [fallbackDetection] = useState(() => detectBestEncoderFallback());

  // Подгружаем детекцию из Rust если ещё не передана
  const [localDetection, setLocalDetection] = useState<EncoderDetectionResult | null>(
    encoderDetection || null
  );

  useEffect(() => {
    if (encoderDetection) {
      setLocalDetection(encoderDetection);
      return;
    }
    // Пробуем загрузить из Rust если не передали через пропсы
    (async () => {
      try {
        const result = await invoke<EncoderDetectionResult>("detect_encoders");
        setLocalDetection(result);
      } catch {
        // Работаем без Rust — используем фоллбэк
      }
    })();
  }, [encoderDetection]);

  // Определяем доступные кодировщики и рекомендуемый
  const availableEncoders: EncoderType[] = localDetection
    ? (["auto", ...localDetection.encoders.filter((e) => e.available).map((e) => e.name)] as EncoderType[])
    : fallbackDetection.available;

  const allEncoders: EncoderType[] = localDetection
    ? (["auto", ...localDetection.encoders.map((e) => e.name)] as EncoderType[])
    : ["auto", "videotoolbox", "nvenc", "qsv", "amf", "cpu"];

  const recommended: EncoderType = (localDetection?.recommended || fallbackDetection.recommended) as EncoderType;

  const currentEncoder = config.encoder;
  const codecInfo = getVideoCodecForEncoder(currentEncoder);
  const encoderMeta = ENCODER_INFO[currentEncoder];

  // Оценка CPU: берём из Rust детекции или из локального маппинга
  const getEstimatedCpu = (enc: EncoderType): number => {
    if (enc === "auto") {
      return getEstimatedCpu(recommended);
    }
    if (localDetection) {
      const info = localDetection.encoders.find((e) => e.name === enc);
      if (info) return info.estimated_cpu_usage;
    }
    return ENCODER_INFO[enc]?.estimatedCpu ?? 50;
  };

  /** Проверить доступность кодировщика */
  const isEncoderAvailable = (enc: EncoderType): boolean => {
    if (enc === "auto") return true;
    return availableEncoders.includes(enc);
  };

  /** Применить пресет */
  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    onChange({
      ...config,
      resolution: preset.resolution,
      fps: preset.fps,
      bitrate: preset.bitrate,
    });
  };

  /** Определить текущий пресет (если совпадает) */
  const currentPreset = (): string | null => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (
        config.resolution === preset.resolution &&
        config.fps === preset.fps &&
        config.bitrate === preset.bitrate
      ) {
        return key;
      }
    }
    return null;
  };

  const cpuEstimate = getEstimatedCpu(currentEncoder);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Настройки эфира</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* --- Секция: Пресеты --- */}
          <div className="settings-section">
            <div className="settings-section-title">Пресеты</div>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  className={`btn-preset ${currentPreset() === key ? "active" : ""}`}
                  onClick={() => applyPreset(key)}
                  title={preset.desc}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: currentPreset() === key ? "2px solid var(--accent, #6366f1)" : "1px solid var(--border, #333)",
                    borderRadius: 8,
                    background: currentPreset() === key ? "var(--accent-bg, rgba(99,102,241,0.15))" : "var(--surface, #1a1a2e)",
                    color: "var(--text, #fff)",
                    cursor: "pointer",
                    textAlign: "center" as const,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{preset.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                    {preset.resolution === "1080p" ? "1080p" : "720p"}{preset.fps}fps / {preset.bitrate / 1000}M
                  </div>
                </button>
              ))}
            </div>
          </div>

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
                <option value="720p">1280x720 (HD)</option>
                <option value="1080p">1920x1080 (Full HD)</option>
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

            {/* Информация о системе */}
            {systemInfo && (
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
                {systemInfo.os} {systemInfo.arch} | {systemInfo.cpu_cores} ядер
                {systemInfo.gpu_name ? ` | GPU: ${systemInfo.gpu_name}` : ""}
              </div>
            )}

            <div className="field">
              <label>Тип кодировщика</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {allEncoders.map((enc) => {
                  const available = isEncoderAvailable(enc);
                  const isRecommended = enc === recommended;
                  const isSelected = enc === currentEncoder;
                  const meta = ENCODER_INFO[enc];
                  if (!meta) return null;

                  return (
                    <button
                      key={enc}
                      onClick={() => {
                        if (available) {
                          onChange({ ...config, encoder: enc });
                        }
                      }}
                      disabled={!available}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        border: isSelected
                          ? "2px solid var(--accent, #6366f1)"
                          : "1px solid var(--border, #333)",
                        borderRadius: 8,
                        background: isSelected
                          ? "var(--accent-bg, rgba(99,102,241,0.15))"
                          : "var(--surface, #1a1a2e)",
                        color: available ? "var(--text, #fff)" : "var(--text-muted, #555)",
                        cursor: available ? "pointer" : "not-allowed",
                        opacity: available ? 1 : 0.5,
                        textAlign: "left" as const,
                        fontSize: 13,
                      }}
                    >
                      {/* Индикатор доступности */}
                      <span style={{ fontSize: 16 }}>
                        {available ? "✅" : "⬜"}
                      </span>

                      {/* Название */}
                      <span style={{ flex: 1 }}>
                        {meta.label}
                        {isRecommended && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "var(--accent, #6366f1)",
                              color: "#fff",
                              fontWeight: 600,
                            }}
                          >
                            Рекомендуется
                          </span>
                        )}
                      </span>

                      {/* Оценка CPU */}
                      {enc !== "auto" && (
                        <span style={{ fontSize: 11, opacity: 0.6 }}>
                          ~{getEstimatedCpu(enc)}% CPU
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
              {/* Оценка нагрузки CPU */}
              <div className="encoder-info-row">
                <span className="encoder-info-label">Нагрузка CPU:</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: "var(--border, #333)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${cpuEstimate}%`,
                        height: "100%",
                        borderRadius: 3,
                        background:
                          cpuEstimate < 20
                            ? "#22c55e"
                            : cpuEstimate < 50
                              ? "#f59e0b"
                              : "#ef4444",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>~{cpuEstimate}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- Секция: Статистика в реальном времени (только в эфире) --- */}
          {isLive && connectionStats && connectionStats.lastUpdated > 0 && (
            <div className="settings-section">
              <div className="settings-section-title">Статистика эфира</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div className="stat-card">
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Битрейт</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{connectionStats.bitrate} kbps</div>
                </div>
                <div className="stat-card">
                  <div style={{ fontSize: 11, opacity: 0.6 }}>FPS</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{connectionStats.fps}</div>
                </div>
                <div className="stat-card">
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Задержка</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{connectionStats.latency} мс</div>
                </div>
                <div className="stat-card">
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Потери пакетов</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: connectionStats.packetLoss > 5 ? "#ef4444" : connectionStats.packetLoss > 1 ? "#f59e0b" : "#22c55e",
                    }}
                  >
                    {connectionStats.packetLoss}%
                  </div>
                </div>
              </div>
            </div>
          )}

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

import type { StreamConfig } from "../App";

interface Props {
  config: StreamConfig;
  onChange: (config: StreamConfig) => void;
  onClose: () => void;
}

/**
 * Панель настроек эфира в стиле вебинарной платформы.
 */
export default function SettingsPanel({ config, onChange, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Настройки эфира</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
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

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

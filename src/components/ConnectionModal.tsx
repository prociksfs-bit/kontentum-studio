import { useState } from "react";
import type { StreamConfig } from "../App";

interface Props {
  config: StreamConfig;
  onConnect: (config: StreamConfig) => void;
  onClose: () => void;
}

export default function ConnectionModal({ config, onConnect, onClose }: Props) {
  const [serverUrl, setServerUrl] = useState(config.serverUrl || "");
  const [token, setToken] = useState(config.token || "");
  const [roomName, setRoomName] = useState(config.roomName || "");
  const [error, setError] = useState("");

  const handleConnect = () => {
    if (!serverUrl.trim()) {
      setError("Укажите URL сервера");
      return;
    }
    if (!token.trim()) {
      setError("Укажите токен");
      return;
    }

    onConnect({
      ...config,
      serverUrl: serverUrl.trim(),
      token: token.trim(),
      roomName: roomName.trim(),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔗 Подключение к платформе</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>URL сервера LiveKit</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="wss://your-server.com"
            />
          </div>

          <div className="field">
            <label>Токен доступа</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJ..."
            />
            <span className="field-hint">
              Получите токен на вебинарной платформе КОНТЕНТУМ
            </span>
          </div>

          <div className="field">
            <label>Название комнаты (опционально)</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="my-webinar"
            />
          </div>

          {error && <div className="field-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn-primary" onClick={handleConnect}>
            Подключиться
          </button>
        </div>
      </div>
    </div>
  );
}

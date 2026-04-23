import type { MediaSource, Scene } from "../App";

interface Props {
  sources: MediaSource[];
  scenes: Scene[];
  activeSceneId: string;
  onSelectScene: (id: string) => void;
  onToggleSource: (id: string) => void;
  onAddSource: (source: MediaSource) => void;
}

export default function Sidebar({
  sources,
  scenes,
  activeSceneId,
  onSelectScene,
  onToggleSource,
  onAddSource,
}: Props) {
  const handleAddCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      if (cameras.length > 0) {
        const cam = cameras[0];
        onAddSource({
          id: `cam-${Date.now()}`,
          type: "camera",
          label: cam.label || "Камера",
          enabled: true,
          deviceId: cam.deviceId,
        });
      }
    } catch (err) {
      console.error("Ошибка получения устройств:", err);
    }
  };

  const handleAddScreen = () => {
    onAddSource({
      id: `screen-${Date.now()}`,
      type: "screen",
      label: "Захват экрана",
      enabled: true,
    });
  };

  return (
    <aside className="sidebar">
      {/* Логотип */}
      <div className="sidebar-logo">
        <span className="logo-icon">🤖</span>
        <span className="logo-text">КОНТЕНТУМ</span>
      </div>

      {/* Сцены */}
      <div className="sidebar-section">
        <h3>Сцены</h3>
        <div className="scene-list">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              className={`scene-item ${scene.id === activeSceneId ? "active" : ""}`}
              onClick={() => onSelectScene(scene.id)}
            >
              🎬 {scene.name}
            </button>
          ))}
        </div>
      </div>

      {/* Источники */}
      <div className="sidebar-section">
        <h3>Источники</h3>
        <div className="source-list">
          {sources.map((source) => (
            <div key={source.id} className="source-item">
              <button
                className={`source-toggle ${source.enabled ? "on" : "off"}`}
                onClick={() => onToggleSource(source.id)}
              >
                {source.type === "camera" && "📷"}
                {source.type === "microphone" && "🎤"}
                {source.type === "screen" && "🖥️"}
              </button>
              <span className="source-label">{source.label}</span>
              <span className={`source-status ${source.enabled ? "on" : "off"}`}>
                {source.enabled ? "ON" : "OFF"}
              </span>
            </div>
          ))}
        </div>

        <div className="source-actions">
          <button className="btn-add" onClick={handleAddCamera}>
            + Камера
          </button>
          <button className="btn-add" onClick={handleAddScreen}>
            + Экран
          </button>
        </div>
      </div>

      {/* Оверлеи (будущее) */}
      <div className="sidebar-section">
        <h3>Оверлеи</h3>
        <div className="overlay-placeholder">
          <span>🏷️ Логотип</span>
          <span>📝 Текст</span>
          <span>⏱️ Таймер</span>
        </div>
      </div>
    </aside>
  );
}

import { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Preview from "./components/Preview";
import Controls from "./components/Controls";
import ConnectionModal from "./components/ConnectionModal";
import SettingsPanel from "./components/SettingsPanel";

/** Конфигурация стрима */
export interface StreamConfig {
  serverUrl: string;
  token: string;
  roomName: string;
  resolution: "720p" | "1080p";
  fps: number;
  bitrate: number;
}

/** Источник медиа */
export interface MediaSource {
  id: string;
  type: "camera" | "screen" | "microphone";
  label: string;
  enabled: boolean;
  deviceId?: string;
}

/** Сцена */
export interface Scene {
  id: string;
  name: string;
  sources: string[];
}

export type AppView = "main" | "settings" | "connect";

export default function App() {
  const [view, setView] = useState<AppView>("main");
  const [isLive, setIsLive] = useState(false);
  const [config, setConfig] = useState<StreamConfig>({
    serverUrl: "",
    token: "",
    roomName: "",
    resolution: "1080p",
    fps: 30,
    bitrate: 4000,
  });

  const [sources, setSources] = useState<MediaSource[]>([
    { id: "cam-1", type: "camera", label: "Веб-камера", enabled: false },
    { id: "mic-1", type: "microphone", label: "Микрофон", enabled: false },
  ]);

  const [scenes, setScenes] = useState<Scene[]>([
    { id: "scene-1", name: "Камера + Экран", sources: ["cam-1", "mic-1"] },
    { id: "scene-2", name: "Только экран", sources: ["mic-1"] },
  ]);

  const [activeSceneId, setActiveSceneId] = useState("scene-1");

  // Стрим (камера/экран)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const handleConnect = useCallback((cfg: StreamConfig) => {
    setConfig(cfg);
    setView("main");
  }, []);

  const handleToggleSource = useCallback((sourceId: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, enabled: !s.enabled } : s)),
    );
  }, []);

  const handleAddSource = useCallback((source: MediaSource) => {
    setSources((prev) => [...prev, source]);
  }, []);

  return (
    <div className="app">
      {view === "connect" && (
        <ConnectionModal
          config={config}
          onConnect={handleConnect}
          onClose={() => setView("main")}
        />
      )}

      {view === "settings" && (
        <SettingsPanel
          config={config}
          onChange={setConfig}
          onClose={() => setView("main")}
        />
      )}

      <div className="app-layout">
        <Sidebar
          sources={sources}
          scenes={scenes}
          activeSceneId={activeSceneId}
          onSelectScene={setActiveSceneId}
          onToggleSource={handleToggleSource}
          onAddSource={handleAddSource}
        />

        <div className="app-center">
          <Preview
            sources={sources}
            cameraStream={cameraStream}
            screenStream={screenStream}
            setCameraStream={setCameraStream}
            setScreenStream={setScreenStream}
            isLive={isLive}
          />

          <Controls
            isLive={isLive}
            setIsLive={setIsLive}
            config={config}
            sources={sources}
            cameraStream={cameraStream}
            screenStream={screenStream}
            onOpenConnect={() => setView("connect")}
            onOpenSettings={() => setView("settings")}
          />
        </div>
      </div>
    </div>
  );
}

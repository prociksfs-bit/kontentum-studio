import { useState, useCallback } from "react";
import AuthScreen from "./components/AuthScreen";
import type { AuthResult, UserInfo } from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import Preview from "./components/Preview";
import Controls from "./components/Controls";
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

/** Настройки обрезки */
interface CropSettings {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type AppView = "main" | "settings";

/** Проверка доступности MediaDevices API */
function hasMediaDevices(): boolean {
  return !!(navigator && navigator.mediaDevices);
}

export default function App() {
  // Авторизация
  const [user, setUser] = useState<UserInfo | null>(null);
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

  // Стримы
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Кроппинг
  const [cameraCrop, setCameraCrop] = useState<CropSettings>({ top: 0, bottom: 0, left: 0, right: 0 });
  const [screenCrop, setScreenCrop] = useState<CropSettings>({ top: 0, bottom: 0, left: 0, right: 0 });

  // Форма PiP
  const [pipShape, setPipShape] = useState<"rect" | "round">("rect");

  // Авторизация
  const handleAuth = useCallback((result: AuthResult) => {
    setUser(result.user);
    setConfig((prev) => ({
      ...prev,
      serverUrl: result.serverUrl,
      token: result.token,
    }));
  }, []);

  // Переключение источника (камера/микрофон)
  const handleToggleSource = useCallback((sourceId: string) => {
    setSources((prev) => {
      const source = prev.find((s) => s.id === sourceId);
      if (!source) return prev;

      const newEnabled = !source.enabled;

      // Если включаем камеру — запустить поток
      if (source.type === "camera" && newEnabled && !cameraStream && hasMediaDevices()) {
        navigator.mediaDevices
          .getUserMedia({
            video: source.deviceId ? { deviceId: { exact: source.deviceId } } : true,
            audio: false,
          })
          .then((stream) => setCameraStream(stream))
          .catch((err) => console.error("Ошибка захвата камеры:", err));
      }

      // Если выключаем камеру — остановить поток
      if (source.type === "camera" && !newEnabled && cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        setCameraStream(null);
      }

      return prev.map((s) => (s.id === sourceId ? { ...s, enabled: newEnabled } : s));
    });
  }, [cameraStream]);

  // Обновление источника (выбор устройства)
  const handleUpdateSource = useCallback((sourceId: string, updates: Partial<MediaSource>) => {
    setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, ...updates } : s)));

    // Если меняется устройство камеры — перезапустить поток
    const source = sources.find((s) => s.id === sourceId);
    if (source?.type === "camera" && source.enabled && updates.deviceId && hasMediaDevices()) {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      navigator.mediaDevices
        .getUserMedia({
          video: { deviceId: { exact: updates.deviceId } },
          audio: false,
        })
        .then((stream) => setCameraStream(stream))
        .catch((err) => console.error("Ошибка переключения камеры:", err));
    }
  }, [sources, cameraStream]);

  // Захват экрана
  const handleStartScreenCapture = useCallback(() => {
    if (!hasMediaDevices()) return;

    navigator.mediaDevices
      .getDisplayMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        setScreenStream(stream);
        // Обработка остановки захвата пользователем
        stream.getVideoTracks()[0].onended = () => setScreenStream(null);
      })
      .catch((err) => console.error("Ошибка захвата экрана:", err));
  }, []);

  const handleStopScreenCapture = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
  }, [screenStream]);

  // Если не авторизован — показать экран входа
  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <div className="app">
      {/* Фоновые орбы */}
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />

      {/* Модалки */}
      {view === "settings" && (
        <SettingsPanel
          config={config}
          onChange={setConfig}
          onClose={() => setView("main")}
        />
      )}

      {/* Основной layout */}
      <Controls
        isLive={isLive}
        setIsLive={setIsLive}
        config={config}
        sources={sources}
        cameraStream={cameraStream}
        screenStream={screenStream}
        onToggleSource={handleToggleSource}
        onOpenSettings={() => setView("settings")}
        userName={user.name}
      />

      <div className="app-layout">
        <Sidebar
          sources={sources}
          cameraStream={cameraStream}
          screenStream={screenStream}
          onToggleSource={handleToggleSource}
          onUpdateSource={handleUpdateSource}
          onStartScreenCapture={handleStartScreenCapture}
          onStopScreenCapture={handleStopScreenCapture}
          cameraCrop={cameraCrop}
          screenCrop={screenCrop}
          onCameraCropChange={setCameraCrop}
          onScreenCropChange={setScreenCrop}
          pipShape={pipShape}
          onPipShapeChange={setPipShape}
        />

        <div className="app-center">
          <Preview
            sources={sources}
            cameraStream={cameraStream}
            screenStream={screenStream}
            isLive={isLive}
            cameraCrop={cameraCrop}
            screenCrop={screenCrop}
            pipShape={pipShape}
          />
        </div>
      </div>
    </div>
  );
}

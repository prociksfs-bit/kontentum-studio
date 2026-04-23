import { useState, useCallback } from "react";
import AuthScreen from "./components/AuthScreen";
import type { AuthResult, UserInfo } from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import Preview from "./components/Preview";
import Controls from "./components/Controls";
import SettingsPanel from "./components/SettingsPanel";
import LogPanel from "./components/LogPanel";
import UpdateBanner from "./components/UpdateBanner";
import { useAppLogger } from "./lib/useAppLogger";
import { useUpdateChecker } from "./lib/useUpdateChecker";

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
  // Логгер
  const { logs, clearLogs, exportLogs } = useAppLogger();
  const [showLogs, setShowLogs] = useState(false);

  // Обновления
  const { checking, updateInfo, error: updateError, checkForUpdates, openDownload, dismiss } = useUpdateChecker();

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
    console.log(`Авторизация: ${result.user.name} | Сервер: ${result.serverUrl ? "подключён" : "не указан"}`);
  }, []);

  // Переключение источника (камера/микрофон)
  const handleToggleSource = useCallback((sourceId: string) => {
    setSources((prev) => {
      const source = prev.find((s) => s.id === sourceId);
      if (!source) return prev;

      const newEnabled = !source.enabled;

      // Если включаем камеру — запустить поток
      if (source.type === "camera" && newEnabled && !cameraStream && hasMediaDevices()) {
        console.log("Запуск камеры...");
        navigator.mediaDevices
          .getUserMedia({
            video: source.deviceId ? { deviceId: { exact: source.deviceId } } : true,
            audio: false,
          })
          .then((stream) => {
            setCameraStream(stream);
            console.log("Камера подключена:", stream.getVideoTracks()[0]?.label || "unknown");
          })
          .catch((err) => console.error("Ошибка захвата камеры:", err.message));
      }

      // Если выключаем камеру — остановить поток
      if (source.type === "camera" && !newEnabled && cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        setCameraStream(null);
        console.log("Камера отключена");
      }

      // Если включаем микрофон
      if (source.type === "microphone" && newEnabled && hasMediaDevices()) {
        console.log("Микрофон включён");
      }
      if (source.type === "microphone" && !newEnabled) {
        console.log("Микрофон выключен");
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
      console.log("Переключение камеры на:", updates.label || updates.deviceId);
      navigator.mediaDevices
        .getUserMedia({
          video: { deviceId: { exact: updates.deviceId } },
          audio: false,
        })
        .then((stream) => {
          setCameraStream(stream);
          console.log("Камера переключена:", stream.getVideoTracks()[0]?.label);
        })
        .catch((err) => console.error("Ошибка переключения камеры:", err.message));
    }
  }, [sources, cameraStream]);

  // Захват экрана
  const handleStartScreenCapture = useCallback(() => {
    if (!hasMediaDevices()) {
      console.error("MediaDevices API недоступен");
      return;
    }

    console.log("Запуск захвата экрана...");
    navigator.mediaDevices
      .getDisplayMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        setScreenStream(stream);
        const track = stream.getVideoTracks()[0];
        console.log("Захват экрана начат:", track?.label || "экран");
        // Обработка остановки захвата пользователем
        track.onended = () => {
          setScreenStream(null);
          console.log("Захват экрана остановлен пользователем");
        };
      })
      .catch((err) => console.error("Ошибка захвата экрана:", err.message));
  }, []);

  const handleStopScreenCapture = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      console.log("Захват экрана остановлен");
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

      {/* Баннер обновлений */}
      <UpdateBanner
        checking={checking}
        updateInfo={updateInfo}
        error={updateError}
        onCheck={checkForUpdates}
        onDownload={openDownload}
        onDismiss={dismiss}
      />

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
        onToggleLogs={() => setShowLogs((v) => !v)}
        onCheckUpdates={checkForUpdates}
        checkingUpdates={checking}
        showLogs={showLogs}
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

          {/* Панель логов */}
          <LogPanel
            logs={logs}
            visible={showLogs}
            onClose={() => setShowLogs(false)}
            onClear={clearLogs}
            onExport={exportLogs}
          />
        </div>
      </div>
    </div>
  );
}

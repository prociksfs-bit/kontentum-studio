import { useState, useCallback, useEffect } from "react";
import AuthScreen from "./components/AuthScreen";
import type { AuthResult, UserInfo } from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import Preview from "./components/Preview";
import HeaderBar from "./components/HeaderBar";
import BottomBar from "./components/BottomBar";
import SettingsPanel from "./components/SettingsPanel";
import LogPanel from "./components/LogPanel";
import UpdateBanner from "./components/UpdateBanner";
import ChatPanel from "./components/ChatPanel";
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
export interface CropSettings {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type AppView = "main" | "settings";

/** Проверка доступности MediaDevices API */
function hasMediaDevices(): boolean {
  return !!(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

export default function App() {
  // Логгер
  const { logs, clearLogs, exportLogs } = useAppLogger();
  const [showLogs, setShowLogs] = useState(true); // Логи видимы по умолчанию

  // Обновления
  const { checking, updateInfo, error: updateError, checkForUpdates, openDownload, dismiss } = useUpdateChecker();

  // Авторизация
  const [user, setUser] = useState<UserInfo | null>(null);
  const [view, setView] = useState<AppView>("main");
  const [isLive, setIsLive] = useState(false);

  // Ошибка медиа
  const [mediaError, setMediaError] = useState<string | null>(null);

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

  // Чат
  const [showChat, setShowChat] = useState(false);

  // Тема (dark по умолчанию, сохраняется в localStorage)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return (localStorage.getItem("kontentum-theme") as "dark" | "light") || "dark";
    } catch {
      return "dark";
    }
  });

  // Применяем тему при изменении
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("kontentum-theme", theme);
    } catch {
      // localStorage недоступен
    }
  }, [theme]);

  // Переключение темы
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Лог при старте
  useState(() => {
    console.log(`КОНТЕНТУМ Studio v${APP_VERSION} запущен`);
    console.log(`Платформа: ${navigator.platform}`);
    console.log(`MediaDevices API: ${hasMediaDevices() ? "доступен" : "НЕДОСТУПЕН"}`);
  });

  // Авторизация
  const handleAuth = useCallback((result: AuthResult) => {
    setUser(result.user);
    setConfig((prev) => ({
      ...prev,
      serverUrl: result.serverUrl,
      token: result.token,
      roomName: result.roomId || prev.roomName,
    }));
    console.log(`Авторизация: ${result.user.name} | Сервер: ${result.serverUrl ? "подключён" : "не указан"} | Комната: ${result.roomId || "не создана"}`);
  }, []);

  // Переключение источника (камера/микрофон)
  const handleToggleSource = useCallback(async (sourceId: string) => {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return;

    const newEnabled = !source.enabled;
    setMediaError(null);

    // Если включаем камеру — запустить поток
    if (source.type === "camera" && newEnabled && !cameraStream) {
      if (!hasMediaDevices()) {
        const msg = "MediaDevices API недоступен. Камера не может быть подключена.";
        console.error(msg);
        setMediaError(msg);
        return;
      }

      try {
        console.log("Запуск камеры...");
        const constraints: MediaStreamConstraints = {
          video: source.deviceId ? { deviceId: { exact: source.deviceId } } : true,
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setCameraStream(stream);
        console.log("Камера подключена:", stream.getVideoTracks()[0]?.label || "unknown");
      } catch (err: any) {
        const msg = `Ошибка камеры: ${err.message || err.name || "Нет разрешения"}`;
        console.error(msg);
        setMediaError(msg);
        return;
      }
    }

    // Если выключаем камеру — остановить поток
    if (source.type === "camera" && !newEnabled && cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      console.log("Камера отключена");
    }

    // Если включаем микрофон
    if (source.type === "microphone" && newEnabled) {
      if (!hasMediaDevices()) {
        const msg = "MediaDevices API недоступен. Микрофон не может быть подключён.";
        console.error(msg);
        setMediaError(msg);
        return;
      }
      console.log("Микрофон включён");
    }

    if (source.type === "microphone" && !newEnabled) {
      console.log("Микрофон выключен");
    }

    setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, enabled: newEnabled } : s)));
  }, [sources, cameraStream]);

  // Обновление источника (выбор устройства)
  const handleUpdateSource = useCallback(async (sourceId: string, updates: Partial<MediaSource>) => {
    setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, ...updates } : s)));

    // Если меняется устройство камеры — перезапустить поток
    const source = sources.find((s) => s.id === sourceId);
    if (source?.type === "camera" && source.enabled && updates.deviceId && hasMediaDevices()) {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      try {
        console.log("Переключение камеры на:", updates.label || updates.deviceId);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: updates.deviceId } },
          audio: false,
        });
        setCameraStream(stream);
        console.log("Камера переключена:", stream.getVideoTracks()[0]?.label);
      } catch (err: any) {
        console.error("Ошибка переключения камеры:", err.message);
        setMediaError(`Ошибка переключения камеры: ${err.message}`);
      }
    }
  }, [sources, cameraStream]);

  // Определение платформы macOS
  const isMacOS = /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent);

  // Захват экрана с обработкой ограничений WKWebView на macOS
  const handleStartScreenCapture = useCallback(async () => {
    // Проверяем наличие getDisplayMedia API
    const hasDisplayMedia = !!(
      navigator?.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function"
    );

    if (!hasDisplayMedia) {
      // На macOS WKWebView может не поддерживать getDisplayMedia
      if (isMacOS) {
        const msg =
          "Захват экрана недоступен в WKWebView на macOS. " +
          "Убедитесь, что приложению дано разрешение «Запись экрана» " +
          "в Системных настройках → Конфиденциальность и безопасность → Запись экрана. " +
          "После выдачи разрешения перезапустите приложение.";
        console.error(msg);
        setMediaError(msg);
      } else {
        const msg = "getDisplayMedia API недоступен. Захват экрана невозможен.";
        console.error(msg);
        setMediaError(msg);
      }
      return;
    }

    try {
      console.log("Запуск захвата экрана...");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      setScreenStream(stream);
      const track = stream.getVideoTracks()[0];
      console.log("Захват экрана начат:", track?.label || "экран");
      // Обработка остановки захвата пользователем
      track.onended = () => {
        setScreenStream(null);
        console.log("Захват экрана остановлен пользователем");
      };
    } catch (err: any) {
      let msg = `Ошибка захвата экрана: ${err.message || "Отменено пользователем"}`;
      if (isMacOS) {
        msg +=
          " | macOS: проверьте разрешение «Запись экрана» в Системных настройках → Конфиденциальность и безопасность.";
      }
      console.error(msg);
      setMediaError(msg);
    }
  }, [isMacOS]);

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

      {/* Шапка */}
      <HeaderBar
        isLive={isLive}
        config={config}
        userName={user.name}
        version={APP_VERSION}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Основной layout */}
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
          {/* Ошибка медиа */}
          {mediaError && (
            <div className="media-error-banner">
              <span>⚠️ {mediaError}</span>
              <button onClick={() => setMediaError(null)}>✕</button>
            </div>
          )}

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

        {/* Панель чата */}
        <ChatPanel
          visible={showChat}
          onClose={() => setShowChat(false)}
          userName={user.name}
        />
      </div>

      {/* Нижняя панель управления */}
      <BottomBar
        isLive={isLive}
        setIsLive={setIsLive}
        config={config}
        sources={sources}
        cameraStream={cameraStream}
        screenStream={screenStream}
        onToggleSource={handleToggleSource}
        onOpenSettings={() => setView("settings")}
        onToggleLogs={() => setShowLogs((v) => !v)}
        onToggleChat={() => setShowChat((v) => !v)}
        onCheckUpdates={checkForUpdates}
        checkingUpdates={checking}
        showLogs={showLogs}
        showChat={showChat}
      />
    </div>
  );
}

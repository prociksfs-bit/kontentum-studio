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
import WelcomeCard from "./components/WelcomeCard";
import { useAppLogger } from "./lib/useAppLogger";
import { useUpdateChecker } from "./lib/useUpdateChecker";
import { useLiveKit } from "./lib/useLiveKit";
import { useConnectionQuality } from "./lib/useConnectionQuality";
import { invoke } from "@tauri-apps/api/core";

/** Тип кодировщика */
export type EncoderType = "auto" | "videotoolbox" | "nvenc" | "qsv" | "amf" | "cpu";

/** Информация о кодировщике (из Rust бэкенда) */
export interface EncoderInfo {
  name: string;
  encoder_type: "hw" | "sw";
  platform: string;
  label: string;
  available: boolean;
  estimated_cpu_usage: number;
}

/** Результат детекции кодировщиков */
export interface EncoderDetectionResult {
  encoders: EncoderInfo[];
  recommended: string;
}

/** Информация о системе */
export interface SystemInfo {
  os: string;
  arch: string;
  cpu_cores: number;
  gpu_name: string | null;
}

/** Конфигурация стрима */
export interface StreamConfig {
  serverUrl: string;
  token: string;
  roomName: string;
  resolution: "720p" | "1080p";
  fps: number;
  bitrate: number;
  encoder: EncoderType;
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
  const [showLogs, setShowLogs] = useState(true);

  // Обновления
  const { status: updateStatus, updateInfo, progress: updateProgress, errorMessage: updateError, checkForUpdates, installUpdate, dismiss } = useUpdateChecker();

  // LiveKit
  const liveKit = useLiveKit();

  // Мониторинг качества соединения
  const { stats: connectionStats, qualityLabel, qualityColor } = useConnectionQuality(liveKit.getRoom());

  // Детекция аппаратных кодировщиков
  const [encoderDetection, setEncoderDetection] = useState<EncoderDetectionResult | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // Запрашиваем информацию о кодировщиках и системе при старте
  useEffect(() => {
    (async () => {
      try {
        const [encoders, sysInfo] = await Promise.all([
          invoke<EncoderDetectionResult>("detect_encoders"),
          invoke<SystemInfo>("get_system_info"),
        ]);
        setEncoderDetection(encoders);
        setSystemInfo(sysInfo);
        console.log(`Система: ${sysInfo.os} ${sysInfo.arch}, ядер CPU: ${sysInfo.cpu_cores}, GPU: ${sysInfo.gpu_name || "не определён"}`);
        console.log(`Рекомендуемый кодировщик: ${encoders.recommended}`);
        console.log(`Доступные кодировщики: ${encoders.encoders.filter((e) => e.available).map((e) => e.name).join(", ")}`);
      } catch (err) {
        console.warn("Не удалось определить кодировщики (вне Tauri?):", err);
      }
    })();
  }, []);

  // Авторизация
  const [user, setUser] = useState<UserInfo | null>(null);
  const [hostToken, setHostToken] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [view, setView] = useState<AppView>("main");
  const [isLive, setIsLive] = useState(false);

  // Состояние приложения: welcome-экран или live-режим
  const [appState, setAppState] = useState<"welcome" | "live">("welcome");

  // Ошибка медиа
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [config, setConfig] = useState<StreamConfig>({
    serverUrl: "",
    token: "",
    roomName: "",
    resolution: "1080p",
    fps: 30,
    bitrate: 4000,
    encoder: "auto",
  });

  const [sources, setSources] = useState<MediaSource[]>([
    { id: "cam-1", type: "camera", label: "Веб-камера", enabled: false },
    { id: "mic-1", type: "microphone", label: "Микрофон", enabled: false },
  ]);

  // Стримы
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Микрофон стрим (отдельно)
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

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
    console.log(`UserAgent: ${navigator.userAgent}`);
    console.log(`MediaDevices API: ${hasMediaDevices() ? "доступен ✅" : "НЕДОСТУПЕН ❌"}`);
    console.log(`Secure context: ${window.isSecureContext ? "да ✅" : "нет ❌"}`);
    console.log(`Protocol: ${window.location.protocol}`);
    if (!window.isSecureContext) {
      console.warn("Приложение НЕ в secure context — MediaDevices API будет недоступен! Нужен useHttpsScheme: true в tauri.conf.json");
    }
  });

  // Выход из системы
  const handleLogout = useCallback(() => {
    try { localStorage.removeItem("kontentum-session"); } catch {}
    setUser(null);
    setHostToken("");
    setRoomId("");
    setConfig((prev) => ({ ...prev, serverUrl: "", token: "", roomName: "" }));
    setAppState("welcome");
  }, []);

  // Авторизация
  const handleAuth = useCallback((result: AuthResult) => {
    setUser(result.user);
    setHostToken(result.hostToken || "");
    setRoomId(result.roomId || "");
    setConfig((prev) => ({
      ...prev,
      serverUrl: result.serverUrl,
      token: result.token,
      roomName: result.roomId || prev.roomName,
    }));
    console.log(`Авторизация: ${result.user.name} | Сервер: ${result.serverUrl ? "подключён" : "не указан"}`);
    if (result.roomId) {
      console.log(`Комната: ${result.roomId}`);
    }
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
        const msg = window.isSecureContext
          ? "MediaDevices API недоступен. Проверьте разрешения камеры в настройках системы."
          : "MediaDevices API недоступен: приложение не в secure context. Это критическая ошибка сборки.";
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
        const msg = window.isSecureContext
          ? "MediaDevices API недоступен. Проверьте разрешения микрофона в настройках системы."
          : "MediaDevices API недоступен: приложение не в secure context.";
        console.error(msg);
        setMediaError(msg);
        return;
      }

      try {
        console.log("Запуск микрофона...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: source.deviceId ? { deviceId: { exact: source.deviceId } } : true,
          video: false,
        });
        setMicStream(stream);
        console.log("Микрофон подключён:", stream.getAudioTracks()[0]?.label || "unknown");
      } catch (err: any) {
        const msg = `Ошибка микрофона: ${err.message || err.name || "Нет разрешения"}`;
        console.error(msg);
        setMediaError(msg);
        return;
      }
    }

    // Если выключаем микрофон
    if (source.type === "microphone" && !newEnabled && micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      setMicStream(null);
      console.log("Микрофон отключён");
    }

    setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, enabled: newEnabled } : s)));
  }, [sources, cameraStream, micStream]);

  // Обновление источника (выбор устройства)
  const handleUpdateSource = useCallback(async (sourceId: string, updates: Partial<MediaSource>) => {
    setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, ...updates } : s)));

    const source = sources.find((s) => s.id === sourceId);

    // Если меняется устройство камеры — перезапустить поток
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

    // Если меняется устройство микрофона
    if (source?.type === "microphone" && source.enabled && updates.deviceId && hasMediaDevices()) {
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
      }
      try {
        console.log("Переключение микрофона на:", updates.label || updates.deviceId);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: updates.deviceId } },
          video: false,
        });
        setMicStream(stream);
        console.log("Микрофон переключён:", stream.getAudioTracks()[0]?.label);
      } catch (err: any) {
        console.error("Ошибка переключения микрофона:", err.message);
        setMediaError(`Ошибка переключения микрофона: ${err.message}`);
      }
    }
  }, [sources, cameraStream, micStream]);

  // Определение платформы macOS
  const isMacOS = /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent);

  // Захват экрана
  const handleStartScreenCapture = useCallback(async (surface?: "monitor" | "window") => {
    const hasDisplayMedia = !!(
      navigator?.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function"
    );

    if (!hasDisplayMedia) {
      if (isMacOS) {
        const msg =
          "Захват экрана недоступен. Дайте разрешение «Запись экрана» в " +
          "Системных настройках → Конфиденциальность → Запись экрана, затем перезапустите приложение.";
        console.error(msg);
        setMediaError(msg);
      } else {
        console.error("getDisplayMedia API недоступен");
        setMediaError("Захват экрана недоступен в этом окружении.");
      }
      return;
    }

    try {
      const constraints: DisplayMediaStreamOptions = {
        video: surface ? ({ displaySurface: surface } as MediaTrackConstraints) : true,
        audio: true,
      };
      console.log("Захват экрана:", surface || "системный выбор");
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      setScreenStream(stream);
      const track = stream.getVideoTracks()[0];
      console.log("Захват экрана начат:", track?.label || "экран");
      track.onended = () => {
        setScreenStream(null);
        console.log("Захват экрана остановлен пользователем");
      };
    } catch (err: any) {
      let msg = `Ошибка захвата экрана: ${err.message || "Отменено пользователем"}`;
      if (isMacOS) {
        msg += " | macOS: проверьте разрешение «Запись экрана» в Системных настройках.";
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

  // Управление эфиром с LiveKit
  const handleSetLive = useCallback(async (live: boolean) => {
    if (live) {
      if (!config.serverUrl || !config.token) {
        console.warn("Нельзя начать эфир: не указан сервер или токен");
        return;
      }

      console.log("Подключение к LiveKit...");

      // Собираем стрим с камерой и аудио для LiveKit
      let combinedStream: MediaStream | null = null;
      if (cameraStream || micStream) {
        combinedStream = new MediaStream();
        if (cameraStream) {
          cameraStream.getVideoTracks().forEach((t) => combinedStream!.addTrack(t));
        }
        if (micStream) {
          micStream.getAudioTracks().forEach((t) => combinedStream!.addTrack(t));
        }
      }

      await liveKit.connect(config.serverUrl, config.token, combinedStream, screenStream, config);
      setIsLive(true);
      setAppState("live");
      console.log("Эфир начат ✅");
    } else {
      console.log("Остановка эфира...");
      await liveKit.disconnect();
      setIsLive(false);
      setAppState("welcome");
      console.log("Эфир остановлен");
    }
  }, [config, cameraStream, screenStream, micStream, liveKit]);

  // Если не авторизован — показать экран входа
  if (!user) {
    return <AuthScreen onAuth={handleAuth} onLogout={handleLogout} />;
  }

  // Welcome-экран (после авторизации, до эфира)
  if (user && appState === "welcome") {
    return (
      <>
        {/* Модалка настроек доступна и на welcome-экране */}
        {view === "settings" && (
          <SettingsPanel
            config={config}
            onChange={setConfig}
            onClose={() => setView("main")}
            encoderDetection={encoderDetection}
            systemInfo={systemInfo}
            isLive={isLive}
            connectionStats={connectionStats}
          />
        )}
        <WelcomeCard
          userName={user.name}
          config={config}
          sources={sources}
          cameraStream={cameraStream}
          screenStream={screenStream}
          micEnabled={sources.find((s) => s.type === "microphone")?.enabled || false}
          onToggleSource={handleToggleSource}
          onStartScreenCapture={handleStartScreenCapture}
          onStopScreenCapture={handleStopScreenCapture}
          onOpenSettings={() => setView("settings")}
          onStartLive={() => handleSetLive(true)}
          onLogout={handleLogout}
          liveKitConnecting={liveKit.connecting}
          roomId={roomId}
        />
      </>
    );
  }

  return (
    <div className="app">
      {/* Фоновые орбы */}
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />

      {/* Баннер обновлений */}
      <UpdateBanner
        status={updateStatus}
        updateInfo={updateInfo}
        progress={updateProgress}
        errorMessage={updateError}
        onCheck={checkForUpdates}
        onInstall={installUpdate}
        onDismiss={dismiss}
      />

      {/* Модалки */}
      {view === "settings" && (
        <SettingsPanel
          config={config}
          onChange={setConfig}
          onClose={() => setView("main")}
          encoderDetection={encoderDetection}
          systemInfo={systemInfo}
          isLive={isLive}
          connectionStats={connectionStats}
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
        participantCount={liveKit.participantCount}
        connectionStats={connectionStats}
        qualityLabel={qualityLabel()}
        qualityColor={qualityColor()}
      />

      {/* Основной layout (live-режим: без боковой панели) */}
      <div className="app-layout">
        {/* Sidebar скрыт в live-режиме */}
        {appState !== "live" && (
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
        )}

        <div className="app-center">
          {/* Ошибка медиа */}
          {mediaError && (
            <div className="media-error-banner">
              <span>⚠️ {mediaError}</span>
              <button onClick={() => setMediaError(null)}>✕</button>
            </div>
          )}

          {/* Ошибка LiveKit */}
          {liveKit.error && (
            <div className="media-error-banner">
              <span>⚠️ LiveKit: {liveKit.error}</span>
              <button onClick={() => {}}>✕</button>
            </div>
          )}

          <Preview
            sources={sources}
            cameraStream={cameraStream}
            screenStream={screenStream}
            isLive={isLive}
            cameraCrop={cameraCrop}
            screenCrop={screenCrop}
            onCameraCropChange={setCameraCrop}
            onScreenCropChange={setScreenCrop}
            pipShape={pipShape}
          />

          {/* Панель логов — скрыта в live-режиме */}
          {appState !== "live" && (
            <LogPanel
              logs={logs}
              visible={showLogs}
              onClose={() => setShowLogs(false)}
              onClear={clearLogs}
              onExport={exportLogs}
            />
          )}
        </div>

        {/* Панель чата */}
        <ChatPanel
          visible={showChat}
          onClose={() => setShowChat(false)}
          userName={user.name}
          room={liveKit.getRoom()}
        />
      </div>

      {/* Нижняя панель управления */}
      <BottomBar
        isLive={isLive}
        setIsLive={handleSetLive}
        config={config}
        sources={sources}
        cameraStream={cameraStream}
        screenStream={screenStream}
        onToggleSource={handleToggleSource}
        onOpenSettings={() => setView("settings")}
        onToggleChat={() => setShowChat((v) => !v)}
        showChat={showChat}
        hostToken={hostToken}
        roomId={roomId}
        liveKitConnecting={liveKit.connecting}
        participantCount={liveKit.participantCount}
        onGoBack={() => setAppState("welcome")}
      />
    </div>
  );
}

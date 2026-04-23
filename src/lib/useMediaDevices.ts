import { useState, useEffect, useCallback } from "react";

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: "videoinput" | "audioinput" | "audiooutput";
}

/**
 * Хук для работы с медиа-устройствами.
 * Перечисляет камеры, микрофоны и мониторит уровень громкости.
 */
export function useMediaDevices() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Получить список устройств без запроса разрешений
  const enumerateOnly = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        console.warn("enumerateDevices API недоступен");
        return;
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      const filtered = list
        .filter((d) => d.kind !== "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `${d.kind === "videoinput" ? "Камера" : "Микрофон"} ${d.deviceId.slice(0, 4)}`,
          kind: d.kind as DeviceInfo["kind"],
        }));
      setDevices(filtered);
      console.log(`Найдено устройств: ${filtered.length} (${filtered.filter(d => d.kind === 'videoinput').length} камер, ${filtered.filter(d => d.kind === 'audioinput').length} микрофонов)`);
    } catch (err: any) {
      console.error("Ошибка перечисления устройств:", err.message);
    }
  }, []);

  // Запросить разрешения и обновить метки
  const requestPermissions = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn("getUserMedia API недоступен");
        return false;
      }
      console.log("Запрос разрешений на камеру и микрофон...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissionGranted(true);

      // После получения разрешений - обновить список с метками
      await enumerateOnly();
      console.log("Разрешения получены");
      return true;
    } catch (err: any) {
      console.warn("Не удалось получить разрешения:", err.message);
      // Пробуем хотя бы перечислить без меток
      await enumerateOnly();
      return false;
    }
  }, [enumerateOnly]);

  // Обновить (полное обновление с запросом разрешений)
  const refreshDevices = useCallback(async () => {
    if (permissionGranted) {
      await enumerateOnly();
    } else {
      await requestPermissions();
    }
  }, [permissionGranted, enumerateOnly, requestPermissions]);

  // При монтировании - только перечислить, НЕ запрашивать разрешения
  useEffect(() => {
    enumerateOnly();

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", enumerateOnly);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", enumerateOnly);
      };
    }
  }, [enumerateOnly]);

  // Мониторинг уровня громкости
  const monitorAudio = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let animId: number;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg / 128);
        animId = requestAnimationFrame(tick);
      };
      tick();

      return () => {
        cancelAnimationFrame(animId);
        ctx.close();
      };
    } catch (err: any) {
      console.error("Ошибка мониторинга аудио:", err.message);
      return () => {};
    }
  }, []);

  const cameras = devices.filter((d) => d.kind === "videoinput");
  const microphones = devices.filter((d) => d.kind === "audioinput");

  return { devices, cameras, microphones, audioLevel, monitorAudio, refreshDevices, requestPermissions };
}

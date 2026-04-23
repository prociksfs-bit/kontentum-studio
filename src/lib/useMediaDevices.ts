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

  // Получить список устройств
  const refreshDevices = useCallback(async () => {
    try {
      // Запросить доступ для получения меток
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());

      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        list
          .filter((d) => d.kind !== "audiooutput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `${d.kind} ${d.deviceId.slice(0, 8)}`,
            kind: d.kind as DeviceInfo["kind"],
          })),
      );
    } catch (err) {
      console.error("Ошибка доступа к устройствам:", err);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
    };
  }, [refreshDevices]);

  // Мониторинг уровня громкости
  const monitorAudio = useCallback((stream: MediaStream) => {
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
      setAudioLevel(avg / 128); // 0..1
      animId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animId);
      ctx.close();
    };
  }, []);

  const cameras = devices.filter((d) => d.kind === "videoinput");
  const microphones = devices.filter((d) => d.kind === "audioinput");

  return { devices, cameras, microphones, audioLevel, monitorAudio, refreshDevices };
}

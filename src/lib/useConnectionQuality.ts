import { useState, useEffect, useCallback, useRef } from "react";
import { Room, RoomEvent, ConnectionQuality } from "livekit-client";

/** Метрики качества соединения */
export interface ConnectionStats {
  /** Текущий исходящий битрейт видео (kbps) */
  bitrate: number;
  /** Потеря пакетов (%) */
  packetLoss: number;
  /** Задержка (мс) */
  latency: number;
  /** Реальный FPS отправки */
  fps: number;
  /** Качество соединения LiveKit (excellent/good/poor/lost/unknown) */
  quality: string;
  /** Время последнего обновления */
  lastUpdated: number;
}

const DEFAULT_STATS: ConnectionStats = {
  bitrate: 0,
  packetLoss: 0,
  latency: 0,
  fps: 0,
  quality: "unknown",
  lastUpdated: 0,
};

/**
 * Хук для мониторинга качества соединения LiveKit.
 * Опрашивает статистику каждые 2 секунды пока комната подключена.
 *
 * Args:
 *   room: инстанс Room из LiveKit (или null если не подключён)
 *
 * Returns:
 *   stats: текущие метрики соединения
 *   qualityLabel: человекочитаемая строка качества
 *   qualityColor: CSS-цвет для индикатора
 */
export function useConnectionQuality(room: Room | null) {
  const [stats, setStats] = useState<ConnectionStats>(DEFAULT_STATS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBytesSentRef = useRef<number>(0);
  const prevTimestampRef = useRef<number>(0);

  // Слушаем событие изменения качества от LiveKit
  useEffect(() => {
    if (!room) {
      setStats(DEFAULT_STATS);
      return;
    }

    const handleQualityChanged = (quality: ConnectionQuality) => {
      const qualityMap: Record<ConnectionQuality, string> = {
        [ConnectionQuality.Excellent]: "excellent",
        [ConnectionQuality.Good]: "good",
        [ConnectionQuality.Poor]: "poor",
        [ConnectionQuality.Lost]: "lost",
        [ConnectionQuality.Unknown]: "unknown",
      };
      setStats((prev) => ({
        ...prev,
        quality: qualityMap[quality] || "unknown",
        lastUpdated: Date.now(),
      }));
    };

    room.on(RoomEvent.ConnectionQualityChanged, handleQualityChanged);

    return () => {
      room.off(RoomEvent.ConnectionQualityChanged, handleQualityChanged);
    };
  }, [room]);

  // Периодический опрос WebRTC статистики
  useEffect(() => {
    if (!room) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      prevBytesSentRef.current = 0;
      prevTimestampRef.current = 0;
      return;
    }

    const pollStats = async () => {
      try {
        const localParticipant = room.localParticipant;
        if (!localParticipant) return;

        // Собираем статистику со всех опубликованных видеотреков
        const trackPublications = Array.from(localParticipant.videoTrackPublications.values());
        if (trackPublications.length === 0) return;

        let totalBytesSent = 0;
        let totalPacketsLost = 0;
        let totalPacketsSent = 0;
        let currentFps = 0;
        let currentLatency = 0;
        let latencyCount = 0;

        for (const pub of trackPublications) {
          const track = pub.track;
          if (!track || !track.sender) continue;

          const senderStats = await track.sender.getStats();
          if (!senderStats) continue;

          senderStats.forEach((report) => {
            if (report.type === "outbound-rtp" && report.kind === "video") {
              totalBytesSent += report.bytesSent || 0;
              totalPacketsSent += report.packetsSent || 0;
              if (report.framesPerSecond) {
                currentFps = Math.max(currentFps, report.framesPerSecond);
              }
            }
            if (report.type === "remote-inbound-rtp" && report.kind === "video") {
              totalPacketsLost += report.packetsLost || 0;
              if (report.roundTripTime) {
                currentLatency += report.roundTripTime * 1000; // В миллисекунды
                latencyCount++;
              }
            }
          });
        }

        // Рассчитываем битрейт
        const now = Date.now();
        let bitrate = 0;
        if (prevTimestampRef.current > 0 && prevBytesSentRef.current > 0) {
          const timeDiff = (now - prevTimestampRef.current) / 1000;
          if (timeDiff > 0) {
            const bytesDiff = totalBytesSent - prevBytesSentRef.current;
            bitrate = Math.round((bytesDiff * 8) / timeDiff / 1000); // kbps
          }
        }
        prevBytesSentRef.current = totalBytesSent;
        prevTimestampRef.current = now;

        // Потеря пакетов в процентах
        const packetLoss =
          totalPacketsSent > 0
            ? Math.round((totalPacketsLost / (totalPacketsSent + totalPacketsLost)) * 1000) / 10
            : 0;

        // Средняя задержка
        const avgLatency = latencyCount > 0 ? Math.round(currentLatency / latencyCount) : 0;

        setStats({
          bitrate: Math.max(0, bitrate),
          packetLoss: Math.max(0, packetLoss),
          latency: avgLatency,
          fps: Math.round(currentFps),
          quality: stats.quality || "unknown",
          lastUpdated: now,
        });
      } catch (err) {
        console.warn("Ошибка опроса статистики WebRTC:", err);
      }
    };

    // Опрашиваем каждые 2 секунды
    intervalRef.current = setInterval(pollStats, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [room]);

  /** Человекочитаемое описание качества */
  const qualityLabel = useCallback((): string => {
    switch (stats.quality) {
      case "excellent":
        return "Отличное";
      case "good":
        return "Хорошее";
      case "poor":
        return "Плохое";
      case "lost":
        return "Потеряно";
      default:
        return "—";
    }
  }, [stats.quality]);

  /** CSS-цвет для индикатора качества */
  const qualityColor = useCallback((): string => {
    switch (stats.quality) {
      case "excellent":
        return "#22c55e";
      case "good":
        return "#84cc16";
      case "poor":
        return "#f59e0b";
      case "lost":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  }, [stats.quality]);

  return { stats, qualityLabel, qualityColor };
}

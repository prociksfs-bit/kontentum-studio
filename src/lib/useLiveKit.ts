import { useState, useCallback, useRef } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  LocalAudioTrack,
  VideoPresets,
  VideoPreset,
} from "livekit-client";
import type { EncoderType, StreamConfig } from "../App";
import { getVideoCodecForEncoder } from "../components/SettingsPanel";

export interface LiveKitState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  participantCount: number;
}

/** Параметры разрешения по конфигу */
function getResolution(resolution: "720p" | "1080p") {
  return resolution === "1080p"
    ? VideoPresets.h1080.resolution
    : VideoPresets.h720.resolution;
}

/**
 * Генерирует слои симулкаста для адаптивного качества.
 * Высокий слой = исходное разрешение, средний = 50%, низкий = 25%.
 *
 * Args:
 *   config: конфигурация стрима (разрешение, fps, битрейт)
 */
function getSimulcastLayers(config: StreamConfig): VideoPreset[] {
  const { bitrate, fps } = config;

  return [
    // Низкий слой — 25% разрешения, 30% битрейта
    new VideoPreset(
      config.resolution === "1080p" ? 480 : 320,
      config.resolution === "1080p" ? 270 : 180,
      Math.round(bitrate * 0.3) * 1000,
      Math.min(fps, 15),
    ),
    // Средний слой — 50% разрешения, 60% битрейта
    new VideoPreset(
      config.resolution === "1080p" ? 960 : 640,
      config.resolution === "1080p" ? 540 : 360,
      Math.round(bitrate * 0.6) * 1000,
      Math.min(fps, 30),
    ),
  ];
}

/**
 * Хук для подключения к LiveKit серверу.
 * Публикует локальные треки (камера, микрофон, экран).
 * Поддерживает выбор кодировщика (H.264 для аппаратного, VP8 для программного).
 * Возвращает ссылку на Room для мониторинга качества соединения.
 */
export function useLiveKit() {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<LiveKitState>({
    connected: false,
    connecting: false,
    error: null,
    participantCount: 0,
  });

  /**
   * Подключиться к комнате с настройками из StreamConfig.
   *
   * Args:
   *   url: WebSocket URL LiveKit сервера
   *   token: JWT токен доступа
   *   cameraStream: поток камеры (или null)
   *   screenStream: поток экрана (или null)
   *   config: полная конфигурация стрима (разрешение, fps, битрейт, кодировщик)
   */
  const connect = useCallback(
    async (
      url: string,
      token: string,
      cameraStream: MediaStream | null,
      screenStream: MediaStream | null,
      config: StreamConfig,
    ) => {
      setState((prev) => ({ ...prev, connecting: true, error: null }));

      try {
        const encoder = config.encoder || "auto";
        // Определяем видеокодек на основе выбранного кодировщика
        const videoCodec = getVideoCodecForEncoder(encoder);
        const resolution = getResolution(config.resolution);
        const simulcastLayers = getSimulcastLayers(config);

        console.log(
          `LiveKit: кодировщик=${encoder}, видеокодек=${videoCodec}, ` +
          `разрешение=${config.resolution}, fps=${config.fps}, битрейт=${config.bitrate}kbps`
        );

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution,
          },
        });

        // Слушаем события участников
        room.on(RoomEvent.ParticipantConnected, () => {
          setState((prev) => ({
            ...prev,
            participantCount: room.remoteParticipants.size + 1,
          }));
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          setState((prev) => ({
            ...prev,
            participantCount: room.remoteParticipants.size + 1,
          }));
        });

        room.on(RoomEvent.Disconnected, () => {
          setState({
            connected: false,
            connecting: false,
            error: null,
            participantCount: 0,
          });
        });

        // Подключаемся
        await room.connect(url, token);
        roomRef.current = room;

        // Публикуем камеру с выбранным кодеком и настройками качества
        if (cameraStream) {
          const videoTrack = cameraStream.getVideoTracks()[0];
          const audioTrack = cameraStream.getAudioTracks()[0];

          if (videoTrack) {
            const localVideo = new LocalVideoTrack(videoTrack);
            await room.localParticipant.publishTrack(localVideo, {
              source: Track.Source.Camera,
              videoCodec,
              videoEncoding: {
                maxBitrate: config.bitrate * 1000,
                maxFramerate: config.fps,
              },
              simulcast: true,
              videoSimulcastLayers: simulcastLayers, // Низкий + средний слой (высокий = основной)
            });
            console.log(
              `Камера опубликована (${videoCodec}, ${config.bitrate}kbps, ${config.fps}fps, simulcast)`
            );
          }

          if (audioTrack) {
            const localAudio = new LocalAudioTrack(audioTrack);
            await room.localParticipant.publishTrack(localAudio, {
              source: Track.Source.Microphone,
            });
          }
        }

        // Публикуем экран с выбранным кодеком
        if (screenStream) {
          const screenTrack = screenStream.getVideoTracks()[0];
          if (screenTrack) {
            const localScreen = new LocalVideoTrack(screenTrack);
            await room.localParticipant.publishTrack(localScreen, {
              source: Track.Source.ScreenShare,
              videoCodec,
              videoEncoding: {
                maxBitrate: config.bitrate * 1000,
                maxFramerate: config.fps,
              },
              // Для экрана симулкаст обычно не нужен — контент статичный
            });
            console.log(
              `Экран опубликован (${videoCodec}, ${config.bitrate}kbps, ${config.fps}fps)`
            );
          }

          const screenAudio = screenStream.getAudioTracks()[0];
          if (screenAudio) {
            const localScreenAudio = new LocalAudioTrack(screenAudio);
            await room.localParticipant.publishTrack(localScreenAudio, {
              source: Track.Source.ScreenShareAudio,
            });
          }
        }

        setState({
          connected: true,
          connecting: false,
          error: null,
          participantCount: room.remoteParticipants.size + 1,
        });
      } catch (err: any) {
        console.error("LiveKit ошибка подключения:", err.message);
        setState({
          connected: false,
          connecting: false,
          error: err.message || "Ошибка подключения",
          participantCount: 0,
        });
      }
    },
    [],
  );

  // Отключиться
  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setState({
      connected: false,
      connecting: false,
      error: null,
      participantCount: 0,
    });
  }, []);

  /** Ссылка на текущую комнату LiveKit (для мониторинга качества) */
  const getRoom = useCallback((): Room | null => {
    return roomRef.current;
  }, []);

  return { ...state, connect, disconnect, getRoom };
}

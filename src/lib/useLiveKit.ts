import { useState, useCallback, useRef } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  LocalAudioTrack,
  VideoPresets,
} from "livekit-client";
import type { EncoderType } from "../App";
import { getVideoCodecForEncoder } from "../components/SettingsPanel";

export interface LiveKitState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  participantCount: number;
}

/**
 * Хук для подключения к LiveKit серверу.
 * Публикует локальные треки (камера, микрофон, экран).
 * Поддерживает выбор кодировщика (H.264 для аппаратного, VP8 для программного).
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
   * Подключиться к комнате с выбранным кодировщиком.
   *
   * Args:
   *   url: WebSocket URL LiveKit сервера
   *   token: JWT токен доступа
   *   cameraStream: поток камеры (или null)
   *   screenStream: поток экрана (или null)
   *   encoder: тип кодировщика (auto/videotoolbox/nvenc/qsv/cpu)
   */
  const connect = useCallback(
    async (
      url: string,
      token: string,
      cameraStream: MediaStream | null,
      screenStream: MediaStream | null,
      encoder: EncoderType = "auto",
    ) => {
      setState((prev) => ({ ...prev, connecting: true, error: null }));

      try {
        // Определяем видеокодек на основе выбранного кодировщика
        const videoCodec = getVideoCodecForEncoder(encoder);
        console.log(`LiveKit: кодировщик=${encoder}, видеокодек=${videoCodec}`);

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: VideoPresets.h1080.resolution,
          },
        });

        // Слушаем события
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

        // Публикуем камеру с выбранным кодеком
        if (cameraStream) {
          const videoTrack = cameraStream.getVideoTracks()[0];
          const audioTrack = cameraStream.getAudioTracks()[0];

          if (videoTrack) {
            const localVideo = new LocalVideoTrack(videoTrack);
            await room.localParticipant.publishTrack(localVideo, {
              source: Track.Source.Camera,
              videoCodec,
            });
            console.log(`Камера опубликована (${videoCodec})`);
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
            });
            console.log(`Экран опубликован (${videoCodec})`);
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

  return { ...state, connect, disconnect };
}

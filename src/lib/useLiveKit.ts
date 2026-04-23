import { useState, useCallback, useRef } from "react";
import {
  Room,
  RoomEvent,
  LocalTrack,
  Track,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalTracks,
  VideoPresets,
} from "livekit-client";

export interface LiveKitState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  participantCount: number;
}

/**
 * Хук для подключения к LiveKit серверу.
 * Публикует локальные треки (камера, микрофон, экран).
 */
export function useLiveKit() {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<LiveKitState>({
    connected: false,
    connecting: false,
    error: null,
    participantCount: 0,
  });

  // Подключиться к комнате
  const connect = useCallback(
    async (
      url: string,
      token: string,
      cameraStream: MediaStream | null,
      screenStream: MediaStream | null,
    ) => {
      setState((prev) => ({ ...prev, connecting: true, error: null }));

      try {
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

        // Публикуем камеру
        if (cameraStream) {
          const videoTrack = cameraStream.getVideoTracks()[0];
          const audioTrack = cameraStream.getAudioTracks()[0];

          if (videoTrack) {
            const localVideo = new LocalVideoTrack(videoTrack);
            await room.localParticipant.publishTrack(localVideo, {
              source: Track.Source.Camera,
            });
          }

          if (audioTrack) {
            const localAudio = new LocalAudioTrack(audioTrack);
            await room.localParticipant.publishTrack(localAudio, {
              source: Track.Source.Microphone,
            });
          }
        }

        // Публикуем экран
        if (screenStream) {
          const screenTrack = screenStream.getVideoTracks()[0];
          if (screenTrack) {
            const localScreen = new LocalVideoTrack(screenTrack);
            await room.localParticipant.publishTrack(localScreen, {
              source: Track.Source.ScreenShare,
            });
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

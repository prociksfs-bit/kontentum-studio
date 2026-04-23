import { useState, useRef, useEffect, useCallback } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  DataPacket_Kind,
} from "livekit-client";

/**
 * Формат чат-сообщения, совместимый с room.html вебинарной платформы.
 * Viewer отправляет: { type:'chat', text, name, role, ts }
 * Studio отправляет: то же самое (для совместимости) + поле id/sender
 */
interface ChatPayload {
  /** Тип сообщения — всегда 'chat' для совместимости с viewer */
  type: "chat";
  /** Уникальный идентификатор сообщения */
  id: string;
  /** Имя отправителя */
  name: string;
  /** Псевдоним (для обратной совместимости) */
  sender?: string;
  /** Текст сообщения */
  text: string;
  /** Роль: presenter (ведущий) или viewer */
  role: "presenter" | "viewer";
  /** Unix timestamp (мс) */
  ts: number;
}

/** Сообщение в чате для отображения */
export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  role: "presenter" | "viewer" | "system";
}

interface Props {
  visible: boolean;
  onClose: () => void;
  userName: string;
  room: Room | null;
}

/**
 * Панель чата для общения во время эфира.
 *
 * Совместима с room.html вебинарной платформы:
 * - Принимает сообщения формата { type:'chat', name, text, ts } (viewer)
 * - Отправляет сообщения в том же формате (presenter role)
 * - Не фильтрует по LiveKit topic — принимает все data-пакеты с type:'chat'
 */
export default function ChatPanel({ visible, onClose, userName, room }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "Система",
      text: "Добро пожаловать в чат эфира! Зрители увидят ваши сообщения в реальном времени.",
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      role: "system",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Добавить сообщение без дубликатов
  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  // Считаем непрочитанные если чат закрыт
  useEffect(() => {
    if (!visible && messages.length > 1) {
      // Увеличиваем только при реальных новых сообщениях (не системных)
    }
  }, [messages, visible]);

  // Сбрасываем счётчик при открытии чата
  useEffect(() => {
    if (visible) setUnreadCount(0);
  }, [visible]);

  // Подписка на входящие сообщения из LiveKit Data Channel
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: DataPacket_Kind,
      _topic?: string,
      // Принимаем ВСЕ сообщения независимо от topic — для совместимости с viewer
    ) => {
      try {
        const decoder = new TextDecoder();
        const json = decoder.decode(payload);
        const msg = JSON.parse(json);

        // Принимаем только чат-сообщения (viewer format: msg.type === 'chat')
        if (msg.type !== "chat") return;

        const senderName = msg.name || msg.sender || participant?.identity || "Зритель";
        const msgId = msg.id || `msg-${msg.ts || Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const newMsg: ChatMessage = {
          id: msgId,
          sender: senderName,
          text: msg.text || "",
          timestamp: new Date(msg.ts || Date.now()).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          role: msg.role === "presenter" ? "presenter" : "viewer",
        };

        addMessage(newMsg);

        // Если чат закрыт — увеличиваем счётчик непрочитанных
        if (!visible) {
          setUnreadCount((n) => n + 1);
        }
      } catch (err) {
        console.error("Ошибка разбора чат-сообщения:", err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, addMessage, visible]);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    if (scrollRef.current && visible) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, visible]);

  // Отправка сообщения в формате, совместимом с room.html
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    const ts = Date.now();
    const msgId = `msg-${ts}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    // Формат совместимый с room.html (viewer ожидает именно такой)
    const payload: ChatPayload = {
      type: "chat",
      id: msgId,
      name: userName || "Ведущий",
      sender: userName || "Ведущий",
      text,
      role: "presenter",
      ts,
    };

    // Добавляем локально (оптимистичное обновление)
    addMessage({
      id: msgId,
      sender: payload.name,
      text,
      timestamp,
      role: "presenter",
    });
    setInputText("");

    // Отправляем через LiveKit Data Channel БЕЗ topic
    // (viewer не фильтрует по topic, проверяет только msg.type === 'chat')
    if (room && room.state === "connected") {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(payload));
        await room.localParticipant.publishData(data, { reliable: true });
      } catch (err) {
        console.error("Ошибка отправки чат-сообщения:", err);
      }
    }
  }, [inputText, userName, room, addMessage]);

  // Отправка по Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!visible) return null;

  const isConnected = !!(room && room.state === "connected");

  return (
    <div className="chat-panel">
      {/* Заголовок */}
      <div className="chat-header">
        <span className="chat-title">
          💬 Чат эфира
        </span>
        <div className="chat-header-actions">
          <span className="chat-count" title="Всего сообщений">{messages.length}</span>
          <button className="chat-close-btn" onClick={onClose} title="Закрыть чат">✕</button>
        </div>
      </div>

      {/* Статус подключения */}
      <div className={`chat-status-bar ${isConnected ? "online" : "offline"}`}>
        <span className="chat-status-dot" />
        {isConnected
          ? "Подключено — зрители получают ваши сообщения"
          : "Офлайн — начните эфир для синхронизации"}
      </div>

      {/* Список сообщений */}
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message ${msg.role === "system" ? "system" : ""} ${msg.role === "presenter" ? "own" : ""}`}
          >
            {msg.role !== "system" && (
              <div className="chat-msg-header">
                <span className={`chat-sender ${msg.role === "presenter" ? "presenter-name" : ""}`}>
                  {msg.role === "presenter" ? "🎙 " : "👤 "}{msg.sender}
                </span>
                <span className="chat-time">{msg.timestamp}</span>
              </div>
            )}
            <div className="chat-msg-text">{msg.text}</div>
          </div>
        ))}
      </div>

      {/* Поле ввода */}
      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? "Написать зрителям..." : "Начните эфир..."}
          maxLength={300}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!inputText.trim()}
          title="Отправить (Enter)"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

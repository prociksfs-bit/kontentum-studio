import { useState, useRef, useEffect, useCallback } from "react";

/** Сообщение в чате */
export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  userName: string;
}

/**
 * Панель чата для общения во время эфира.
 * Пока использует локальное состояние (mock).
 * В будущем — подключение к LiveKit Data Channel.
 */
export default function ChatPanel({ visible, onClose, userName }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "Система",
      text: "Добро пожаловать в чат эфира!",
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Отправка сообщения
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: userName || "Ведущий",
      text,
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
  }, [inputText, userName]);

  // Отправка по Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (!visible) return null;

  return (
    <div className="chat-panel">
      {/* Заголовок */}
      <div className="chat-header">
        <span className="chat-title">Чат эфира</span>
        <div className="chat-header-actions">
          <span className="chat-count">{messages.length}</span>
          <button className="chat-close-btn" onClick={onClose} title="Закрыть чат">
            ✕
          </button>
        </div>
      </div>

      {/* Сообщения */}
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message ${msg.sender === "Система" ? "system" : ""} ${msg.sender === userName ? "own" : ""}`}
          >
            <div className="chat-msg-header">
              <span className="chat-sender">{msg.sender}</span>
              <span className="chat-time">{msg.timestamp}</span>
            </div>
            <div className="chat-msg-text">{msg.text}</div>
          </div>
        ))}
      </div>

      {/* Ввод сообщения */}
      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение..."
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!inputText.trim()}
          title="Отправить"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

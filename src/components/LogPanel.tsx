import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "../lib/useAppLogger";

interface Props {
  logs: LogEntry[];
  visible: boolean;
  onClose: () => void;
  onClear: () => void;
  onExport: () => string;
}

const LEVEL_COLORS: Record<LogEntry["level"], string> = {
  info: "var(--cyan)",
  warn: "var(--amber)",
  error: "var(--red)",
  debug: "var(--muted)",
};

const LEVEL_LABELS: Record<LogEntry["level"], string> = {
  info: "INF",
  warn: "WRN",
  error: "ERR",
  debug: "DBG",
};

/**
 * Панель логов приложения.
 * Показывается внизу экрана, можно скопировать/экспортировать.
 */
export default function LogPanel({ logs, visible, onClose, onClear, onExport }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<LogEntry["level"] | "all">("all");
  const [copied, setCopied] = useState(false);

  // Автоскролл к новым сообщениям
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (!visible) return null;

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.level === filter);

  const handleCopy = async () => {
    const text = onExport();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  return (
    <div className="log-panel">
      {/* Заголовок */}
      <div className="log-header">
        <span className="log-title">Логи приложения</span>

        {/* Фильтры */}
        <div className="log-filters">
          {(["all", "info", "warn", "error", "debug"] as const).map((f) => (
            <button
              key={f}
              className={`log-filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
              style={f !== "all" ? { color: LEVEL_COLORS[f] } : undefined}
            >
              {f === "all" ? "Все" : LEVEL_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="log-actions">
          <span className="log-count">{filteredLogs.length}</span>
          <button className="log-action-btn" onClick={handleCopy} title="Скопировать все логи">
            {copied ? "✓ Скопировано" : "📋 Копировать"}
          </button>
          <button className="log-action-btn" onClick={onClear} title="Очистить логи">
            🗑 Очистить
          </button>
          <button className="log-close-btn" onClick={onClose} title="Закрыть">
            ✕
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="log-content" ref={scrollRef} onScroll={handleScroll}>
        {filteredLogs.length === 0 ? (
          <div className="log-empty">Нет записей</div>
        ) : (
          filteredLogs.map((entry) => (
            <div key={entry.id} className={`log-entry log-${entry.level}`}>
              <span className="log-time">{entry.timestamp}</span>
              <span
                className="log-level"
                style={{ color: LEVEL_COLORS[entry.level] }}
              >
                {LEVEL_LABELS[entry.level]}
              </span>
              <span className="log-msg">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

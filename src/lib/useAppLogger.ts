import { useState, useCallback, useEffect, useRef } from "react";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

/**
 * Хук для перехвата console.log/warn/error и хранения логов в UI.
 * Позволяет отображать окно логов внутри приложения.
 */
export function useAppLogger(maxEntries = 500) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const idRef = useRef(0);
  const installedRef = useRef(false);

  // Добавить запись в лог
  const addLog = useCallback((level: LogEntry["level"], ...args: unknown[]) => {
    const message = args
      .map((a) => {
        if (typeof a === "string") return a;
        try {
          return JSON.stringify(a, null, 2);
        } catch {
          return String(a);
        }
      })
      .join(" ");

    const entry: LogEntry = {
      id: idRef.current++,
      timestamp: new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      }),
      level,
      message,
    };

    setLogs((prev) => {
      const next = [...prev, entry];
      // Обрезаем старые записи
      return next.length > maxEntries ? next.slice(-maxEntries) : next;
    });
  }, [maxEntries]);

  // Перехват console методов
  useEffect(() => {
    if (installedRef.current) return;
    installedRef.current = true;

    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    const origDebug = console.debug;

    console.log = (...args: unknown[]) => {
      origLog(...args);
      addLog("info", ...args);
    };

    console.warn = (...args: unknown[]) => {
      origWarn(...args);
      addLog("warn", ...args);
    };

    console.error = (...args: unknown[]) => {
      origError(...args);
      addLog("error", ...args);
    };

    console.debug = (...args: unknown[]) => {
      origDebug(...args);
      addLog("debug", ...args);
    };

    // Глобальный обработчик ошибок
    const handleError = (event: ErrorEvent) => {
      addLog("error", `[Uncaught] ${event.message} at ${event.filename}:${event.lineno}`);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      addLog("error", `[Unhandled Promise] ${event.reason}`);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // Стартовое сообщение
    addLog("info", "КОНТЕНТУМ Studio запущен");

    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
      console.debug = origDebug;
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      installedRef.current = false;
    };
  }, [addLog]);

  // Очистить логи
  const clearLogs = useCallback(() => setLogs([]), []);

  // Экспорт логов как текст
  const exportLogs = useCallback(() => {
    return logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join("\n");
  }, [logs]);

  return { logs, clearLogs, exportLogs, addLog };
}

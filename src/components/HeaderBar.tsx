import type { StreamConfig } from "../App";
import type { ConnectionStats } from "../lib/useConnectionQuality";

interface Props {
  isLive: boolean;
  config: StreamConfig;
  userName?: string;
  version: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  participantCount?: number;
  /** Метрики качества соединения (показываются когда в эфире) */
  connectionStats?: ConnectionStats;
  /** Текстовый лейбл качества */
  qualityLabel?: string;
  /** CSS-цвет индикатора качества */
  qualityColor?: string;
}

/**
 * Верхняя панель приложения — логотип, статус, качество соединения, имя пользователя, тема.
 */
export default function HeaderBar({
  isLive,
  config,
  userName,
  version,
  theme,
  onToggleTheme,
  participantCount,
  connectionStats,
  qualityLabel,
  qualityColor,
}: Props) {
  return (
    <div className="app-header">
      <span className="hdr-logo">КОНТЕНТУМ STUDIO</span>
      <span className="hdr-version">v{version}</span>

      <div className="hdr-right">
        {/* Статус подключения */}
        {isLive && (
          <div className="live-pill">
            <span className="live-dot" />
            LIVE
            {participantCount !== undefined && participantCount > 0 && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>👥 {participantCount}</span>
            )}
          </div>
        )}

        {/* Индикатор качества соединения — показывается только в эфире */}
        {isLive && connectionStats && connectionStats.lastUpdated > 0 && (
          <div
            className="connection-quality-indicator"
            title={`Качество: ${qualityLabel}\nБитрейт: ${connectionStats.bitrate} kbps\nПотеря пакетов: ${connectionStats.packetLoss}%\nЗадержка: ${connectionStats.latency} мс\nFPS: ${connectionStats.fps}`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginRight: 8 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: qualityColor || "#6b7280",
                display: "inline-block",
              }}
            />
            <span style={{ opacity: 0.8 }}>
              {connectionStats.bitrate > 0 ? `${connectionStats.bitrate} kbps` : "..."}
            </span>
            {connectionStats.fps > 0 && (
              <span style={{ opacity: 0.6 }}>{connectionStats.fps} fps</span>
            )}
            {connectionStats.latency > 0 && (
              <span style={{ opacity: 0.6 }}>{connectionStats.latency} мс</span>
            )}
            {connectionStats.packetLoss > 1 && (
              <span style={{ color: "#f59e0b", opacity: 0.9 }}>
                {connectionStats.packetLoss}% loss
              </span>
            )}
          </div>
        )}

        <div className="conn-status">
          <span className={`csd ${config.serverUrl ? (isLive ? "green" : "amber") : "red"}`} />
          {config.serverUrl ? (isLive ? "В эфире" : "Готов") : "Нет подключения"}
        </div>

        {/* Переключатель темы */}
        <button
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        {/* Имя пользователя */}
        {userName && (
          <div className="hdr-user">
            <span className="u-avatar">{userName.charAt(0).toUpperCase()}</span>
            <span>{userName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

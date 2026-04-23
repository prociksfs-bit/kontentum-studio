import type { StreamConfig } from "../App";

interface Props {
  isLive: boolean;
  config: StreamConfig;
  userName?: string;
  version: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  participantCount?: number;
}

/**
 * Верхняя панель приложения — логотип, статус, имя пользователя, переключатель темы.
 */
export default function HeaderBar({ isLive, config, userName, version, theme, onToggleTheme, participantCount }: Props) {
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

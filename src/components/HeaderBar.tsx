import type { StreamConfig } from "../App";

interface Props {
  isLive: boolean;
  config: StreamConfig;
  userName?: string;
  version: string;
}

/**
 * Верхняя панель приложения — логотип, статус, имя пользователя.
 */
export default function HeaderBar({ isLive, config, userName, version }: Props) {
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
          </div>
        )}

        <div className="conn-status">
          <span className={`csd ${config.serverUrl ? (isLive ? "green" : "amber") : "red"}`} />
          {config.serverUrl ? (isLive ? "В эфире" : "Готов") : "Нет подключения"}
        </div>

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

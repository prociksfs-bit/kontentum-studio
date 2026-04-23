import { useState } from "react";

export interface UserInfo {
  id: number;
  name: string;
  username?: string;
}

export interface AuthResult {
  user: UserInfo;
  serverUrl: string;
  token: string;
}

interface Props {
  onAuth: (result: AuthResult) => void;
}

/**
 * Экран авторизации через MAX.
 * Поддерживает OAuth через MAX и ручной ввод данных подключения.
 */
export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<"choice" | "manual">("choice");
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Авторизация через MAX (OAuth)
  const handleMaxLogin = async () => {
    setLoading(true);
    setError("");

    try {
      // Открываем OAuth страницу MAX в системном браузере
      // После авторизации MAX перенаправит на callback URL
      // и мы получим токен доступа
      const { open } = await import("@tauri-apps/plugin-shell");
      await open("https://xn--e1afkbacih0dza.xn--p1acf/vebinar/auth/max");

      // Пока OAuth не настроен - показываем ручной режим
      setMode("manual");
      setError("OAuth MAX в разработке. Введите данные подключения вручную.");
    } catch (err) {
      // Fallback - переключаемся на ручной режим
      setMode("manual");
    } finally {
      setLoading(false);
    }
  };

  // Ручное подключение
  const handleManualConnect = () => {
    if (!serverUrl.trim()) {
      setError("Укажите URL сервера");
      return;
    }
    if (!token.trim()) {
      setError("Укажите токен доступа");
      return;
    }

    const name = displayName.trim() || "Ведущий";

    onAuth({
      user: {
        id: Date.now(),
        name,
        username: name.toLowerCase().replace(/\s+/g, "_"),
      },
      serverUrl: serverUrl.trim(),
      token: token.trim(),
    });
  };

  return (
    <div className="auth-screen">
      {/* Фоновые орбы */}
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />

      <div className="auth-card">
        {/* Логотип */}
        <div className="auth-logo">
          <div className="auth-logo-text">КОНТЕНТУМ</div>
          <div className="auth-logo-sub">STUDIO</div>
        </div>

        {mode === "choice" && (
          <>
            <div className="auth-title">Добро пожаловать</div>
            <div className="auth-subtitle">
              Войдите чтобы начать эфир
            </div>

            {/* Кнопка входа через MAX */}
            <button
              className="auth-btn-max"
              onClick={handleMaxLogin}
              disabled={loading}
            >
              {loading ? "Подключение..." : "Войти через MAX"}
            </button>

            <div className="auth-divider">ИЛИ</div>

            {/* Ручной ввод */}
            <button
              className="auth-btn-max"
              onClick={() => setMode("manual")}
              style={{
                background: "rgba(0, 15, 45, 0.6)",
                boxShadow: "none",
                border: "1px solid rgba(0, 245, 255, 0.2)",
              }}
            >
              Ввести данные вручную
            </button>
          </>
        )}

        {mode === "manual" && (
          <>
            <div className="auth-title">Подключение к платформе</div>
            <div className="auth-subtitle">
              Введите данные вашего LiveKit сервера
            </div>

            <div className="auth-field">
              <label>Ваше имя</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Как вас зовут?"
                autoFocus
              />
            </div>

            <div className="auth-field">
              <label>URL сервера</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="wss://your-server.com"
              />
            </div>

            <div className="auth-field">
              <label>Токен доступа</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="eyJ..."
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button
              className="auth-btn-max"
              onClick={handleManualConnect}
              style={{ marginTop: 8 }}
            >
              Подключиться
            </button>

            <button
              className="auth-btn-max"
              onClick={() => { setMode("choice"); setError(""); }}
              style={{
                background: "transparent",
                boxShadow: "none",
                border: "1px solid rgba(0, 245, 255, 0.15)",
                fontSize: 13,
              }}
            >
              Назад
            </button>
          </>
        )}
      </div>
    </div>
  );
}

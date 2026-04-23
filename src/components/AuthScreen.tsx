import { useState, useEffect, useRef } from "react";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export interface UserInfo {
  id: number;
  name: string;
  username?: string;
}

export interface AuthResult {
  user: UserInfo;
  serverUrl: string;
  token: string;
  hostToken: string;
  roomId: string;
}

interface Props {
  onAuth: (result: AuthResult) => void;
}

// URL платформы КОНТЕНТУМ (punycode — WKWebView не резолвит кириллические домены напрямую)
const PLATFORM_URL = "https://xn--e1ajhcbd3acj.xn--p1ai";

/**
 * Экран авторизации через MAX.
 * Поддерживает OAuth через MAX и ручной ввод данных подключения.
 *
 * MAX OAuth flow:
 * 1. POST /vebinar/api/max-auth-init → { code, deepLink }
 * 2. Открываем deepLink в браузере (https://max.ru/id..._bot?start=wbr_{code})
 * 3. Поллинг GET /vebinar/api/max-auth-poll?code={code} каждые 2 сек
 * 4. Когда { ready: true, hostToken, displayName } → создаём комнату + получаем LiveKit токен
 */
export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<"choice" | "polling" | "manual">("choice");
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pollStatus, setPollStatus] = useState("Ожидаем подтверждение в MAX...");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const authCode = useRef<string | null>(null);

  // Очищаем поллинг при размонтировании
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  // Остановить поллинг
  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  // Авторизация через MAX (OAuth)
  const handleMaxLogin = async () => {
    setLoading(true);
    setError("");

    try {
      // Шаг 1: инициализируем сессию авторизации на сервере
      const initResp = await tauriFetch(`${PLATFORM_URL}/vebinar/api/max-auth-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!initResp.ok) {
        throw new Error(`Ошибка сервера: ${initResp.status}`);
      }

      const { code, deepLink } = await initResp.json();
      authCode.current = code;

      // Шаг 2: открываем deepLink в системном браузере
      // (https://max.ru/id..._bot?start=wbr_{code})
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(deepLink);

      // Шаг 3: переходим в режим ожидания и начинаем поллинг
      setMode("polling");
      setPollStatus("Откройте MAX и подтвердите вход...");

      pollTimer.current = setInterval(async () => {
        try {
          const pollResp = await tauriFetch(
            `${PLATFORM_URL}/vebinar/api/max-auth-poll?code=${authCode.current}`
          );

          if (!pollResp.ok) {
            stopPolling();
            setMode("choice");
            setError("Сессия истекла. Попробуйте ещё раз.");
            return;
          }

          const data = await pollResp.json();

          if (!data.ready) {
            setPollStatus("Ожидаем подтверждение в MAX...");
            return;
          }

          // Авторизован!
          stopPolling();
          setPollStatus("Авторизован! Создаём комнату...");

          const { hostToken, displayName: userName, user } = data;

          // Шаг 4: создаём комнату вебинара
          const roomResp = await tauriFetch(`${PLATFORM_URL}/vebinar/api/create-room`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Host-Token": hostToken,
            },
            body: JSON.stringify({ name: "Вебинар" }),
          });

          if (!roomResp.ok) {
            throw new Error("Не удалось создать комнату");
          }

          const { roomId } = await roomResp.json();

          // Шаг 5: получаем LiveKit токен ведущего
          const tokenResp = await tauriFetch(`${PLATFORM_URL}/vebinar/api/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: roomId, name: userName, role: "presenter" }),
          });

          if (!tokenResp.ok) {
            throw new Error("Не удалось получить токен LiveKit");
          }

          const { token: lkToken, wsUrl } = await tokenResp.json();

          // Готово — передаём результат в App
          onAuth({
            user: {
              id: user?.id ?? Date.now(),
              name: userName,
              username: user?.username,
            },
            serverUrl: wsUrl,
            token: lkToken,
            hostToken,
            roomId,
          });
        } catch (e: any) {
          stopPolling();
          setMode("choice");
          setError(`Ошибка авторизации: ${e.message}`);
        }
      }, 2000);
    } catch (err: any) {
      setMode("choice");
      setError(`Не удалось подключиться к платформе: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Отмена поллинга
  const handleCancelPolling = () => {
    stopPolling();
    authCode.current = null;
    setMode("choice");
    setError("");
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
      hostToken: "",
      roomId: "",
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

            {error && <div className="auth-error">{error}</div>}

            <div className="auth-divider">ИЛИ</div>

            {/* Ручной ввод */}
            <button
              className="auth-btn-max"
              onClick={() => { setMode("manual"); setError(""); }}
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

        {mode === "polling" && (
          <>
            <div className="auth-title">Ожидание MAX</div>
            <div className="auth-subtitle">
              В браузере открылся MAX — подтвердите вход в боте
            </div>

            <div className="auth-polling">
              <div className="polling-dot" />
              <span>{pollStatus}</span>
            </div>

            <button
              className="auth-btn-max"
              onClick={handleCancelPolling}
              style={{
                background: "transparent",
                boxShadow: "none",
                border: "1px solid rgba(0, 245, 255, 0.15)",
                fontSize: 13,
                marginTop: 16,
              }}
            >
              Отмена
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

import { useState, useEffect, useRef } from "react";

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
 * Безопасное извлечение сообщения из ошибки любого типа.
 * tauriFetch может бросать не-Error объекты (строки, объекты без .message).
 */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    // Tauri HTTP plugin может вернуть { message: string } или { error: string }
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return "Неизвестная ошибка";
}

/**
 * HTTP fetch с поддержкой Tauri plugin-http и fallback на нативный fetch.
 * Tauri plugin-http может не работать если плагин не зарегистрирован.
 */
async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    // Пробуем Tauri HTTP plugin (обходит CORS)
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    const resp = await tauriFetch(url, options as any);
    return resp as unknown as Response;
  } catch (e) {
    console.warn("Tauri HTTP plugin недоступен, используем нативный fetch:", getErrorMessage(e));
    // Fallback на нативный fetch
    return await fetch(url, options);
  }
}

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
      console.log("Авторизация MAX: инициализация...");

      // Шаг 1: инициализируем сессию авторизации на сервере
      const initResp = await safeFetch(`${PLATFORM_URL}/vebinar/api/max-auth-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!initResp.ok) {
        const statusText = initResp.statusText || `код ${initResp.status}`;
        throw new Error(`Сервер вернул ошибку: ${statusText} (${initResp.status})`);
      }

      let data: any;
      try {
        data = await initResp.json();
      } catch {
        throw new Error("Сервер вернул невалидный ответ (не JSON)");
      }

      console.log("MAX auth init:", JSON.stringify(data));

      if (!data.code || !data.deepLink) {
        throw new Error("Сервер не вернул код авторизации");
      }

      authCode.current = data.code;

      // Шаг 2: открываем deepLink в системном браузере
      console.log("Открываем MAX:", data.deepLink);
      try {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(data.deepLink);
      } catch {
        // Fallback — открываем через window.open
        window.open(data.deepLink, "_blank");
      }

      // Шаг 3: переходим в режим ожидания и начинаем поллинг
      setMode("polling");
      setLoading(false);
      setPollStatus("Откройте MAX и подтвердите вход...");

      let pollCount = 0;
      const MAX_POLLS = 90; // 3 минуты (90 * 2 сек)

      pollTimer.current = setInterval(async () => {
        pollCount++;

        if (pollCount > MAX_POLLS) {
          stopPolling();
          setMode("choice");
          setError("Время ожидания истекло (3 мин). Попробуйте ещё раз.");
          return;
        }

        try {
          const pollResp = await safeFetch(
            `${PLATFORM_URL}/vebinar/api/max-auth-poll?code=${authCode.current}`
          );

          if (!pollResp.ok) {
            stopPolling();
            setMode("choice");
            setError(`Ошибка поллинга: ${pollResp.status}. Попробуйте ещё раз.`);
            return;
          }

          let pollData: any;
          try {
            pollData = await pollResp.json();
          } catch {
            return; // Невалидный JSON — пропускаем итерацию
          }

          if (!pollData.ready) {
            setPollStatus(`Ожидаем подтверждение в MAX... (${pollCount * 2} сек)`);
            return;
          }

          // Авторизован!
          stopPolling();
          setPollStatus("Авторизован! Создаём комнату...");
          console.log("MAX auth подтверждена:", JSON.stringify(pollData));

          const { hostToken, displayName: userName, user } = pollData;

          // Шаг 4: создаём комнату вебинара
          const roomResp = await safeFetch(`${PLATFORM_URL}/vebinar/api/create-room`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Host-Token": hostToken,
            },
            body: JSON.stringify({ name: "Вебинар" }),
          });

          if (!roomResp.ok) {
            const errorText = await roomResp.text().catch(() => "");
            throw new Error(`Не удалось создать комнату: ${roomResp.status} ${errorText}`);
          }

          const roomData = await roomResp.json();
          const { roomId } = roomData;
          console.log("Комната создана:", roomId);

          // Шаг 5: получаем LiveKit токен ведущего
          const tokenResp = await safeFetch(`${PLATFORM_URL}/vebinar/api/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: roomId, name: userName, role: "presenter" }),
          });

          if (!tokenResp.ok) {
            const errorText = await tokenResp.text().catch(() => "");
            throw new Error(`Не удалось получить токен: ${tokenResp.status} ${errorText}`);
          }

          const tokenData = await tokenResp.json();
          const { token: lkToken, wsUrl } = tokenData;
          console.log("LiveKit токен получен, wsUrl:", wsUrl);

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
        } catch (e: unknown) {
          stopPolling();
          setMode("choice");
          setError(`Ошибка авторизации: ${getErrorMessage(e)}`);
          console.error("MAX auth error:", getErrorMessage(e));
        }
      }, 2000);
    } catch (err: unknown) {
      setMode("choice");
      const msg = getErrorMessage(err);
      setError(`Не удалось подключиться к платформе: ${msg}`);
      console.error("MAX auth init error:", msg);
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

// src/components/LoginForm.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function LoginForm() {
  const [username, setUsername] = useState("polylab"); // предзаполняем для удобства
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Сохраняем состояние входа
        localStorage.setItem("polylab_auth", JSON.stringify({
          loggedIn: true,
          user: data.user,
          timestamp: Date.now(),
        }));
        navigate("/"); // редирект после входа
      } else {
        setError(data.detail || "Неверный логин или пароль");
      }
    } catch (err) {
      setError("Ошибка подключения к серверу");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h2 style={styles.title}>🔐 Цифровые помощники</h2>
        
        <div style={styles.field}>
          <label>Логин</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            disabled={loading}
            autoComplete="Логин"
          />
        </div>

        <div style={styles.field}>
          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            disabled={loading}
            autoComplete="Текущий пароль"
          />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#F8FAFC",
    fontFamily: "system-ui, sans-serif",
  },
  form: {
    background: "#fff",
    padding: "28px 32px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    width: "100%",
    maxWidth: "360px",
  },
  title: {
    margin: "0 0 24px 0",
    fontSize: "20px",
    fontWeight: 600,
    color: "#0F172A",
    textAlign: "center",
  },
  field: {
    marginBottom: "16px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #CBD5E1",
    borderRadius: "6px",
    boxSizing: "border-box",
    marginTop: "4px",
  },
  error: {
    color: "#DC2626",
    fontSize: "13px",
    marginBottom: "12px",
    textAlign: "center",
  },
  button: {
    width: "100%",
    padding: "11px",
    background: "#008B92",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  hint: {
    marginTop: "16px",
    textAlign: "center",
    color: "#64748B",
  },
};
// src/layouts/MainLayout.tsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import UserBadge from "../components/UserBage";

export default function MainLayout() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const handleGoHome = () => navigate("/");
  
  // 🔹 Показываем топбар только НЕ на главной странице
  const showTopbar = location.pathname !== "/";

  return (
    <div style={styles.layout}>
      {/* ─── ТОПБАР С ЛОГО (условный рендер) ─── */}
      {showTopbar && (
        <header style={styles.topbar}>
          <div style={styles.topbarInner}>
            <button onClick={handleGoHome} style={styles.logoBtn} type="button">
              <span style={styles.logoIcon}>◆</span>
              <span style={styles.logoText}>Главная</span>
            </button>
          </div>
        </header>
      )}

      {/* ─── ОСНОВНОЙ КОНТЕНТ ─── */}
      <main style={{
        ...styles.main,
        paddingTop: showTopbar ? "64px" : "32px", // 🔹 Меньше отступ на главной
      }}>
        <div style={styles.contentWrapper}>
          <Outlet />
        </div>
      </main>

      {/* ─── ПЛАШКА ПОЛЬЗОВАТЕЛЯ (FIXED) ─── */}
      <UserBadge onLogout={logout} />
    </div>
  );
}

// ==================== DESIGN TOKENS ====================
const C = {
  primary: "#008B92",
  primaryDark: "#006B6B",
  primaryBg: "#E6F7F8",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#475569",
  textLight: "#64748B",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
};

const T = {
  font: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
  size: {
    xs: "12px",
    sm: "14px",
    base: "15px",
    lg: "18px",
    xl: "24px",
    "2xl": "36px",
  },
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
};

const S = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "32px",
  "4xl": "40px",
};

// ==================== СТИЛИ ====================
const styles: Record<string, React.CSSProperties> = {
  layout: {
    minHeight: "100vh",
    background: C.bg,
    fontFamily: T.font,
    color: C.text,
    WebkitFontSmoothing: "antialiased",
    display: "flex",
    flexDirection: "column",
  },

  topbar: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "64px",
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    zIndex: 100,
    backdropFilter: "blur(8px)",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },

  topbarInner: {
    maxWidth: "1200px",
    margin: "0 auto",
    height: "100%",
    padding: `0 ${S["3xl"]}`,
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
  },

  logoBtn: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: `${S.sm} ${S.md}`,
    borderRadius: "8px",
    transition: "background 150ms ease",
  },

  logoIcon: {
    fontSize: "22px",
    color: C.primary,
    fontWeight: T.weight.bold,
  },

  logoText: {
    fontSize: T.size.base,
    fontWeight: T.weight.semibold,
    color: C.text,
    letterSpacing: "-0.01em",
  },

  main: {
    flex: 1,
    width: "100%",
    boxSizing: "border-box",
  },

  contentWrapper: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: `${S["4xl"]} ${S["3xl"]} ${S["4xl"]}`,
    boxSizing: "border-box",
    minHeight: "calc(100vh - 64px)",
  },
};
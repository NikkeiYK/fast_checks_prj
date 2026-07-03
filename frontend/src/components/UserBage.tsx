// src/components/UserBadge.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type Props = {
  onLogout: () => void;
};

export default function UserBadge({ onLogout }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const initial = user.display_name?.charAt(0).toUpperCase() || "U";

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <div
      style={{
        ...styles.badge,
        ...(isHovered && styles.badgeHovered),
        ...(isAdmin && styles.badgeAdmin),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Аватар */}
      <div
        style={{
          ...styles.avatar,
          ...(isAdmin ? styles.avatarAdmin : styles.avatarUser),
        }}
      >
        {isAdmin ? "👑" : initial}
      </div>

      {/* Инфо-блок */}
      <div style={styles.infoBlock}>
        <div style={styles.roleTitle}>
          {isAdmin ? "Администратор" : "Пользователь"}
        </div>
        {isAdmin && (
          <div style={styles.roleSubtitle}>
            Полный доступ
          </div>
        )}
      </div>

      {/* Кнопка выхода */}
      <button
        type="button"
        onClick={handleLogout}
        style={{
          ...styles.logoutBtn,
          opacity: isHovered ? 1 : 0,
          width: isHovered ? "auto" : "0px",
          padding: isHovered ? `10px 16px` : "10px 0",
          marginLeft: isHovered ? "12px" : "0px",
        }}
        title="Выйти из системы"
      >
        <span style={styles.logoutIcon}>⎋</span>
        <span style={styles.logoutText}>Выйти</span>
      </button>
    </div>
  );
}

const C = {
  primary: "#008B92",
  primaryDark: "#006B6B",
  primaryLight: "#00A8AF",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#475569",
  textLight: "#64748B",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  gold: "#F59E0B",
  goldDark: "#D97706",
};

const styles: Record<string, React.CSSProperties> = {
  // ─── ПИЛЮЛЯ ───────────────────────────────────
  badge: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "12px 18px",
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(15, 23, 42, 0.08)",
    zIndex: 1000,
    cursor: "default",
    transition: "all 320ms cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },

  badgeHovered: {
    boxShadow: "0 8px 30px rgba(220, 38, 38, 0.20)",
    borderColor: C.danger,
  },

  badgeAdmin: {
    background: "linear-gradient(135deg, #FFFFFF 0%, #F0FDFA 100%)",
    border: "1px solid rgba(0, 139, 146, 0.20)",
    boxShadow: "0 4px 24px rgba(0, 139, 146, 0.15), 0 0 0 1px rgba(0, 139, 146, 0.05)",
  },

  // ─── АВАТАР ───────────────────────────────────
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: 700,
    flexShrink: 0,
    transition: "all 200ms ease",
  },

  avatarAdmin: {
    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryLight} 100%)`,
    color: "#fff",
    boxShadow: "0 4px 12px rgba(0, 139, 146, 0.35)",
    fontSize: "20px",
  },

  avatarUser: {
    background: `linear-gradient(135deg, #64748B 0%, #94A3B8 100%)`,
    color: "#fff",
    boxShadow: "0 2px 8px rgba(71, 85, 105, 0.20)",
  },

  // ─── ИНФО-БЛОК ────────────────────────────────
  infoBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },

  roleTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: C.text,
    letterSpacing: "-0.2px",
    lineHeight: 1.2,
  },

  roleSubtitle: {
    fontSize: "11px",
    fontWeight: 500,
    color: C.primary,
    opacity: 0.8,
    letterSpacing: "0.3px",
    textTransform: "uppercase" as const,
  },

  // ─── КНОПКА ВЫХОДА ────────────────────────────
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: C.dangerBg,
    border: `1px solid ${C.danger}`,
    borderRadius: "12px",
    color: C.danger,
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 320ms cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
  },

  logoutIcon: {
    fontSize: "14px",
  },

  logoutText: {
    fontSize: "13px",
  },
};
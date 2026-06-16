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
  const roleLabel = isAdmin ? "Админ" : "Пользователь";

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <div
      style={{
        ...styles.badge,
        ...(isHovered && styles.badgeHovered),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Аватар */}
      <div
        style={{
          ...styles.avatar,
          background: isAdmin ? C.primary : C.textMuted,
        }}
      >
        {initial}
      </div>

      {/* Роль (всегда видна) */}
      <div style={styles.roleBlock}>
        <div style={styles.roleName}>{user.display_name || "User"}</div>
        <div style={styles.roleLabel}>
          {isAdmin ? "👑" : "🔍"} {roleLabel}
        </div>
      </div>

      {/* Кнопка выхода (появляется при hover) */}
      <button
        type="button"
        onClick={handleLogout}
        style={{
          ...styles.logoutBtn,
          opacity: isHovered ? 1 : 0,
          width: isHovered ? "auto" : "0px",
          padding: isHovered ? `8px 14px` : "8px 0",
          marginLeft: isHovered ? "12px" : "0px",
        }}
        title="Выйти из системы"
      >
        <span style={styles.logoutIcon}>🚪</span>
        <span style={styles.logoutText}>Выйти</span>
      </button>
    </div>
  );
}

const C = {
  primary: "#008B92",
  primaryDark: "#006B6B",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#475569",
  textLight: "#64748B",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
};

const styles: Record<string, React.CSSProperties> = {
  // ─── ПИЛЮЛЯ ───────────────────────────────────
  badge: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 16px",
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "999px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)",
    zIndex: 1000,
    cursor: "default",
    transition: "all 320ms cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },

  badgeHovered: {
    boxShadow: "0 12px 32px rgba(220, 38, 38, 0.15), 0 4px 12px rgba(15, 23, 42, 0.08)",
    borderColor: C.danger,
  },

  // ─── АВАТАР ───────────────────────────────────
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "15px",
    fontWeight: 700,
    flexShrink: 0,
    transition: "background 200ms ease",
  },

  roleBlock: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.2,
  },

  roleName: {
    fontSize: "13px",
    fontWeight: 600,
    color: C.text,
  },

  roleLabel: {
    fontSize: "11px",
    color: C.textLight,
    marginTop: "2px",
  },

  // ─── КНОПКА ВЫХОДА ────────────────────────────
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: C.dangerBg,
    border: `1px solid ${C.danger}`,
    borderRadius: "999px",
    color: C.danger,
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 320ms cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
  },

  logoutIcon: {
    fontSize: "13px",
  },

  logoutText: {
    fontSize: "13px",
  },
};
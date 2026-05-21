import { Link, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";

type MenuItem = { label: string; path: string };
type MenuGroup = { title: string; items: MenuItem[] };

const menuTree: MenuGroup[] = [
  {
    title: "ОТиПБ",
    items: [
      { label: "Быстрые проверки", path: "/otipb/audit" }
    ]
  }, 
  {
    title: "ЦИРМ",
    items: [
      { label: "Бронирование климатической камеры", path: "/lab/booking" }
    ]
  }
];

export default function MainLayout() {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "ОТиПБ": true,
  });
  const location = useLocation();

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const getModulePrefix = (path: string): string => {
    const parts = path.split('/').filter(Boolean);
    return parts.length >= 2 ? `/${parts[0]}` : path;
  };

  const isMenuItemActive = (itemPath: string, currentPath: string): boolean => {
    const prefix = getModulePrefix(itemPath);
    if (prefix === '/') return currentPath === itemPath;
    return currentPath === itemPath || currentPath.startsWith(`${prefix}/`);
  };

  return (
    <div style={styles.layout}>
      
      {/* ═══════════════════════════════════════════
          САЙДБАР: fixed, всегда виден, не скроллится
          ═══════════════════════════════════════════ */}
      <aside style={styles.sidebar}>
        
        {/* Логотип */}
        <div style={styles.logo}>
          <span style={styles.logoText}>Цифровые помощники</span>
        </div>

        {/* Навигация — без внутреннего скролла */}
        <nav style={styles.nav}>
          {menuTree.map((group) => {
            const isOpen = openGroups[group.title];
            return (
              <div key={group.title} style={styles.group}>
                <button
                  onClick={() => toggleGroup(group.title)}
                  style={styles.groupBtn}
                  type="button"
                >
                  <span style={styles.groupName}>{group.title}</span>
                  <span style={styles.groupArrow}>
                    {isOpen ? "▴" : "▾"}
                  </span>
                </button>

                {isOpen && (
                  <ul style={styles.menuList}>
                    {group.items.map((item) => {
                      const isActive = isMenuItemActive(item.path, location.pathname);
                      return (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            style={{
                              ...styles.menuItem,
                              ...(isActive && styles.menuItemActive),
                            }}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Футер сайдбара */}
        <div style={styles.sidebarFooter}>
          <span style={styles.version}>v1.0.0</span>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          КОНТЕНТ: сдвинут вправо, скроллится естественно
          ═══════════════════════════════════════════ */}
      <main style={styles.main}>
        <Outlet />
      </main>
      
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
  xs: "4px", sm: "8px", md: "12px", lg: "16px",
  xl: "20px", "2xl": "24px", "3xl": "32px", "4xl": "40px",
};

// ==================== СТИЛИ ====================
const styles: Record<string, React.CSSProperties> = {
  
  // ─── ГЛАВНЫЙ КОНТЕЙНЕР ─────────────────────────
  layout: {
    display: "flex",
    minHeight: "100vh",
    background: C.bg,
    fontFamily: T.font,
    color: C.text,
    WebkitFontSmoothing: "antialiased",
    // ✅ Убрали overflow: hidden — пусть браузер управляет скроллом
  },

  // ─── САЙДБАР (FIXED) ───────────────────────────
  sidebar: {
    position: "fixed",     // ✅ Фиксирован относительно окна
    left: 0,
    top: 0,
    width: "320px",
    height: "100vh",       // ✅ На всю высоту окна
    background: C.surface,
    borderRight: `1px solid ${C.border}`,
    display: "flex",
    flexDirection: "column",
    zIndex: 10,            // ✅ Поверх контента
    // ✅ НЕТ overflow: auto — скролл только на странице
  },

  logo: {
    display: "flex",
    alignItems: "center",
    padding: `${S.lg} ${S["2xl"]}`,
    borderBottom: `1px solid ${C.border}`,
    height: "64px",
    boxSizing: "border-box",
  },

  logoText: {
    fontSize: T.size.lg,
    fontWeight: T.weight.semibold,
    color: C.text,
    letterSpacing: "-0.02em",
  },

  nav: {
    flex: 1,
    padding: `${S.md} 0`,
    // ✅ Убрали overflowY: auto — меню не скроллится отдельно
  },

  group: { marginBottom: S.xs },

  groupBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: `${S.sm} ${S["2xl"]}`,
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },

  groupName: {
    fontSize: T.size.xs,
    fontWeight: T.weight.semibold,
    color: C.textLight,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  groupArrow: {
    fontSize: "14px",
    color: C.textLight,
    width: "24px",
    textAlign: "center",
    lineHeight: 1,
  },

  menuList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },

  menuItem: {
    display: "block",
    padding: `${S.sm} ${S["2xl"]}`,
    fontSize: T.size.sm,
    fontWeight: T.weight.medium,
    color: C.textMuted,
    textDecoration: "none",
    transition: "background 120ms ease, color 120ms ease",
    borderLeft: "3px solid transparent",
    paddingLeft: `calc(${S["2xl"]} - 3px)`,
  },

  menuItemActive: {
    background: C.primaryBg,
    color: C.primaryDark,
    borderLeftColor: C.primary,
    fontWeight: T.weight.semibold,
  },

  sidebarFooter: {
    padding: `${S.md} ${S["2xl"]}`,
    borderTop: `1px solid ${C.border}`,
    background: C.bg,
    height: "48px",
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
  },

  version: {
    fontSize: T.size.xs,
    color: C.textLight,
  },

  // ─── ОСНОВНОЙ КОНТЕНТ ──────────────────────────
  main: {
    flex: 1,
    marginLeft: "320px",   // ✅ Сдвиг на ширину сайдбара
    padding: `${S["4xl"]} ${S["3xl"]}`,
    // ✅ НЕТ overflow: auto — скролл управляется браузером естественно
    minWidth: 0,
  },
};
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

  // Автоматически вычисляет "корень" раздела: /otipb/audit → /otipb, /lab/booking → /lab
  const getModulePrefix = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  return parts.length >= 2 ? `/${parts[0]}` : path;
  };

  // Проверяет активность пункта меню
  const isMenuItemActive = (itemPath: string, currentPath: string): boolean => {
  const prefix = getModulePrefix(itemPath);
  // Если префикс корневой "/", требуем точного совпадения (чтобы не светилось всё)
  if (prefix === '/') return currentPath === itemPath;

  return currentPath === itemPath || currentPath.startsWith(`${prefix}/`);
  };

  return (
    <div style={styles.layout}>
      {/* Боковое меню — всегда видимо */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>Polylab</div>
        
        <nav style={styles.nav}>
          {menuTree.map((group) => {
            const isOpen = openGroups[group.title];
            
            return (
              <div key={group.title} style={styles.groupBlock}>
                <button
                  onClick={() => toggleGroup(group.title)}
                  style={styles.groupHeader}
                >
                  <span style={styles.groupTitle}>{group.title}</span>
                  <span style={styles.groupToggle}>{isOpen ? "−" : "+"}</span>
                </button>

                {isOpen && (
                  <ul style={styles.itemsList}>
                    {group.items.map((item) => {
                      const isActive = isMenuItemActive(item.path, location.pathname);
                      return (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            style={{
                              ...styles.itemLink,
                              background: isActive ? "#008B92" : "transparent",
                              color: isActive ? "#fff" : "#334155",
                              borderLeft: isActive ? "3px solid #006B6B" : "3px solid transparent",
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
      </aside>
          
      {/* Основной контент */}
      <main style={styles.main}>
        {/* <header style={styles.header}>
          <h1 style={styles.pageTitle}>
            {title}
          </h1>
        </header> */}
        
        <div style={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    background: "#F8FAFC",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  sidebar: {
    width: "260px",
    height: "100vh",
    background: "#fff",
    borderRight: "1px solid #E2E8F0",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    flexShrink: 0,
  },
  logo: {
    padding: "16px 20px",
    fontSize: "16px",
    fontWeight: 600,
    color: "#008B92",
    borderBottom: "1px solid #E2E8F0",
  },
  nav: {
    flex: 1,
    padding: "8px 0",
    overflowY: "auto",
  },
  groupBlock: { marginBottom: "4px" },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "10px 20px",
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  groupTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  groupToggle: {
    fontSize: "14px",
    color: "#94A3B8",
    width: "20px",
    textAlign: "center",
  },
  itemsList: {
    listStyle: "none",
    margin: "0",
    padding: "4px 0",
  },
  itemLink: {
    display: "block",
    padding: "8px 20px",
    fontSize: "13px",
    fontWeight: 500,
    textDecoration: "none",
    transition: "background 0.1s, color 0.1s, border-color 0.1s",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
  },
  header: {
    padding: "14px 24px",
    background: "#fff",
    borderBottom: "1px solid #E2E8F0",
    display: "flex",
    alignItems: "center",
  },
  pageTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 600,
    color: "#0F172A",
  },
  content: {
    flex: 1,
    padding: "20px 24px",
    overflow: "auto",
  },
};
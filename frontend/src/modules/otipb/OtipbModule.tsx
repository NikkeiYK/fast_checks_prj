// src/modules/OtipbLayout.tsx
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth"; // импортируем хук авторизации

//  Расширяем тип вкладки для удобства фильтрации
interface TabConfig {
  label: string;
  path: string;
  icon?: string;
  roles?: ("admin" | "auditor")[]; //  если не указано — доступно всем
}

const tabs: TabConfig[] = [
  {
    label: "Главная",
    path: "/otipb/main",
    roles: ["admin"], //  только для админов
  },
  { 
    label: "Быстрые проверки", 
    path: "/otipb/audit", 
    icon: "📝",
    // доступно всем по умолчанию
  },
  { 
    label: "Списки для проверок", 
    path: "/otipb/no-checked-list", 
    icon: "📋",
    // доступно всем по умолчанию
  }
];

export default function OtipbLayout() {
  const { user } = useAuth(); //  получаем данные о пользователе

  //  Фильтруем вкладки: если у вкладки есть roles — показываем только если роль совпадает
  const visibleTabs = tabs.filter(tab => 
    !tab.roles || tab.roles.includes(user?.role as "admin" | "auditor")
  );

  return (
    <div style={container}>
      <div style={tabsBar}>
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={({ isActive }) => ({
              ...tabStyle,
              borderBottom: isActive ? "2px solid #008B92" : "2px solid transparent",
              color: isActive ? "#008B92" : "#5A6B7C",
            })}
          >
            {tab.icon && <span style={tabIcon}>{tab.icon}</span>}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
      <div style={tabContent}>
        <Outlet />
      </div>
    </div>
  );
}

const container: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
};

const tabsBar: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  background: "#FFFFFF",
  padding: "0 24px",
  borderBottom: "1px solid #E2E8F0",
  marginBottom: "24px",
};

const tabStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "10px 16px",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 500,
  transition: "all 0.2s",
  cursor: "pointer",
};

const tabIcon: React.CSSProperties = { fontSize: "16px" };

const tabContent: React.CSSProperties = { flex: 1 };
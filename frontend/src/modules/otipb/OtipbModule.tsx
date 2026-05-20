import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { label: "Быстрые проверки", path: "/otipb/audit", icon: "📝" },
  { label: "История проверок", path: "/otipb/history", icon: "📋" }
];

export default function OtipbLayout() {
  return (
    <div style={container}>
      <div style={tabsBar}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={({ isActive }) => ({
              ...tabStyle,
              borderBottom: isActive ? "2px solid #008B92" : "2px solid transparent",
              color: isActive ? "#008B92" : "#5A6B7C",
            })}
          >
            <span style={tabIcon}>{tab.icon}</span>
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
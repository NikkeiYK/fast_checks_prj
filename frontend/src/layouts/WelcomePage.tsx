// src/pages/WelcomePage.tsx
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type ServiceCard = {
  icon: string;
  title: string;
  description: string;
  path: string;
  adminOnly?: boolean;
};

const services: ServiceCard[] = [
  {
    icon: "🛡️",
    title: "ОТиПБ",
    description: "Быстрые проверки, отчёты и мониторинг безопасности.",
    path: "/otipb/audit",
  },
  {
    icon: "🔬",
    title: "ЦИРМ",
    description: "Бронирование оборудования и управление лабораторными ресурсами.",
    path: "/lab/booking",
  },
  {
    icon: "",
    title: "НТР", 
    description: "Мониторинг стандартов",
    path: "/monitoring"
  }
];

export default function WelcomePage() {
  const { isAdmin } = useAuth();

  const visibleServices = services.filter((s) => !s.adminOnly || isAdmin);

  return (
    <div style={styles.container}>
      {/* 🔹 Заголовок и описание возвращены */}
      <header style={styles.header}>
        <h1 style={styles.mainTitle}>Цифровые помощники</h1>
        <p style={styles.subtitle}>
          Платформа НИОКР для исследований, анализа данных и автоматизации процессов. 
          Выберите сервис для начала работы.
        </p>
      </header>

      <section style={styles.servicesGrid}>
        {visibleServices.map((service) => (
          <Link
            key={service.path}
            to={service.path}
            style={styles.serviceCardLink}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.transform = "translateY(-4px)";
              el.style.boxShadow = "0 12px 24px rgba(0, 139, 146, 0.12)";
              el.style.borderColor = "#008B92";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.04)";
              el.style.borderColor = "#E2E8F0";
            }}
          >
            <span style={styles.serviceIcon}>{service.icon}</span>
            <h3 style={styles.serviceTitle}>{service.title}</h3>
            <p style={styles.serviceDesc}>{service.description}</p>
            <span style={styles.serviceArrow}>→</span>
          </Link>
        ))}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
  },
  header: {
    marginBottom: "48px",
  },
  mainTitle: {
    fontSize: "clamp(32px, 5vw, 48px)",
    fontWeight: 700,
    color: "#0F172A",
    margin: "0 0 16px 0",
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    color: "#475569",
    fontSize: "18px",
    fontWeight: 400,
    lineHeight: 1.6,
    margin: 0,
    maxWidth: "580px",
  },
  servicesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },
  serviceCardLink: {
    display: "block",
    background: "#FFFFFF",
    padding: "28px 24px",
    borderRadius: "12px",
    border: "1px solid #E2E8F0",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
    transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
    cursor: "pointer",
    textDecoration: "none",
    color: "inherit",
    position: "relative",
  },
  serviceIcon: {
    fontSize: "32px",
    marginBottom: "14px",
    display: "block",
  },
  serviceTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#0F172A",
    margin: "0 0 8px 0",
  },
  serviceDesc: {
    fontSize: "14px",
    color: "#64748B",
    margin: 0,
    lineHeight: 1.5,
  },
  serviceArrow: {
    position: "absolute",
    right: "20px",
    top: "24px",
    fontSize: "20px",
    color: "#008B92",
    opacity: 0.6,
  },
};
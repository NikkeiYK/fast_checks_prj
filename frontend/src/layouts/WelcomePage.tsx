// WelcomePage.tsx
import { useState } from "react";

export default function WelcomePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Простая анимация появления
  useState(() => {
    requestAnimationFrame(() => setIsLoaded(true));
  });

  return (
    <div style={{
      ...styles.container,
      opacity: isLoaded ? 1 : 0,
      transform: isLoaded ? "translateY(0)" : "translateY(8px)",
      transition: "opacity 300ms ease, transform 300ms ease",
    }}>
      {/* Заголовок */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.mainTitle}>
            Цифровые помощники НИОКР
          </h1>
          <p style={styles.subtitle}>
            Выберите сервис в левом меню для начала работы.
            Инструменты для исследований, анализа данных и автоматизации процессов.
          </p>
        </div>
      </header>

      {/* Карточки сервисов (опционально) */}
      <section style={styles.servicesGrid}>
        <div style={styles.serviceCard}>
          <span style={styles.serviceIcon}>🛡️</span>
          <h3 style={styles.serviceTitle}>ОТиПБ</h3>
          <p style={styles.serviceDesc}>
            Быстрые проверки, отчёты и мониторинг безопасности.
          </p>
        </div>
        <div style={styles.serviceCard}>
          <span style={styles.serviceIcon}>🔬</span>
          <h3 style={styles.serviceTitle}>ЦИРМ</h3>
          <p style={styles.serviceDesc}>
            Бронирование оборудования и управление лабораторными ресурсами.
          </p>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#F8FAFC",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    padding: "32px",
    boxSizing: "border-box",
  },
  
  header: {
    marginBottom: "40px",
  },
  
  headerContent: {
    maxWidth: "720px",
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
    marginBottom: "auto",
  },
  
  serviceCard: {
    background: "#FFFFFF",
    padding: "24px",
    borderRadius: "12px",
    border: "1px solid #E2E8F0",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
    transition: "box-shadow 200ms ease, border-color 200ms ease",
    cursor: "default",
  },
  
  serviceIcon: {
    fontSize: "28px",
    marginBottom: "12px",
    display: "block",
  },
  
  serviceTitle: {
    fontSize: "16px",
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
  
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    paddingTop: "32px",
    marginTop: "auto",
  },
  
  version: {
    fontWeight: 500,
    fontSize: "13px",
    color: "#94A3B8",
  },
  
  separator: {
    color: "#CBD5E1",
    fontSize: "13px",
  },
  
  copyright: {
    fontSize: "13px",
    color: "#94A3B8",
  },
};
export default function WelcomePage() {
  return (
    <div style={styles.container}>
      {/* Фоновые декоративные элементы */}
      <div style={styles.backgroundDecor} />
      
      <div style={styles.content}>
        {/* Крупный заголовок */}
        <h1 style={styles.mainTitle}>
          <span style={styles.titleAccent}>POLYLAB</span>
          <br />
          <span style={styles.titleSecondary}>PLATFORM</span>
        </h1>
        
        <p style={styles.subtitle}>
          Система управления аудитами и отчётностью
        </p>

        

        {/* Футер с информацией */}
        <div style={styles.footer}>
          <span style={styles.version}>v1.0.0</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #008B92 100%)",
    position: "relative",
    overflow: "hidden",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "24px",
  },
  backgroundDecor: {
    position: "absolute",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.1)",
    filter: "blur(80px)",
    top: "-200px",
    right: "-200px",
    zIndex: 0,
    animation: "float 8s ease-in-out infinite",
  } as React.CSSProperties,
  content: {
    position: "relative",
    zIndex: 1,
    textAlign: "center",
    maxWidth: "900px",
    width: "100%",
  },
  mainTitle: {
    fontSize: "clamp(48px, 12vw, 96px)",
    fontWeight: 800,
    color: "#fff",
    margin: "0 0 16px 0",
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    textShadow: "0 4px 30px rgba(0, 0, 0, 0.2)",
    animation: "fadeInUp 0.6s ease-out",
  },
  titleAccent: {
    background: "linear-gradient(90deg, #fff, #e0f7fa)",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },
  titleSecondary: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: "0.9em",
  },
  subtitle: {
    fontSize: "clamp(16px, 2.5vw, 20px)",
    color: "rgba(255, 255, 255, 0.85)",
    margin: "0 0 48px 0",
    fontWeight: 400,
    animation: "fadeInUp 0.6s ease-out 0.1s both",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
    marginBottom: "40px",
    animation: "fadeInUp 0.6s ease-out 0.2s both",
  },
  cardLink: {
    textDecoration: "none",
    display: "block",
  },
  card: {
    background: "rgba(255, 255, 255, 0.95)",
    borderRadius: "20px",
    padding: "28px 24px",
    textAlign: "left",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  } as React.CSSProperties,
  cardIcon: {
    fontSize: "32px",
    marginBottom: "12px",
  },
  cardTitle: {
    margin: "0 0 8px 0",
    fontSize: "20px",
    fontWeight: 600,
    color: "#0F172A",
  },
  cardDesc: {
    margin: "0 0 16px 0",
    fontSize: "14px",
    color: "#64748B",
    lineHeight: 1.5,
  },
  cardArrow: {
    position: "absolute",
    right: "24px",
    bottom: "28px",
    fontSize: "20px",
    color: "#008B92",
    transition: "transform 0.2s ease",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: "13px",
    animation: "fadeInUp 0.6s ease-out 0.3s both",
  },
  divider: {
    opacity: 0.5,
  },
  version: {
    fontWeight: 500,
  },
  copyright: {
    fontWeight: 400,
  },
};

// Добавляем ключевые анимации через style-тег (можно вынести в CSS-файл)
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes float {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-20px, 20px); }
  }
`;
document.head.appendChild(styleSheet);
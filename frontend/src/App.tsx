import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import AuditForm from "./pages/AuditForm";
import History from "./pages/History";
import AuditorDashboard from "./pages/AuditorDashboard";

function App() {
  return (
    <BrowserRouter>
      <nav
        style={{ background: "#333", padding: "15px", marginBottom: "20px" }}>
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            gap: "20px",
            alignItems: "center",
          }}>
          <Link
            to="/"
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: "bold",
            }}>
            📝 Новая проверка
          </Link>
          <Link
            to="/history"
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: "bold",
            }}>
            📋 История
          </Link>
          <Link
            to="/dashboard"
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: "bold",
            }}>
            👨‍💼 Кабинет аудитора
          </Link>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<AuditForm />} />
        <Route path="/history" element={<History />} />
        <Route path="/dashboard" element={<AuditorDashboard />} />
        <Route path="/dashboard/:name" element={<AuditorDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

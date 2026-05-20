/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../../../config";
import { useParams, useNavigate } from "react-router-dom";

export default function AuditorDashboard() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any[]>([]);
  const [myName, setMyName] = useState(name || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name) return;
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(API.dashboard(name));
        if (isMounted) setReport(res.data);
      } catch (err) {
        console.error("Ошибка загрузки дашборда:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [name]);

  const handleLogin = () => {
    if (myName.trim()) {
      navigate(`/dashboard/${encodeURIComponent(myName)}`);
    }
  };

  if (!name) {
    return (
      <div style={dashboardContainer}>
        <h2>👨‍💼 Кабинет аудитора</h2>
        <p style={hintText}>
          Введите ваше ФИО для просмотра статистики проверок
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <input
            placeholder="Иванов И.И."
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            style={inputStyle}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <button onClick={handleLogin} style={loginBtnStyle}>
            Войти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={dashboardContainer}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between" as const,
          alignItems: "center",
          marginBottom: 20,
        }}>
        <h2>📊 Статистика: {decodeURIComponent(name)}</h2>
        <button onClick={() => navigate(-1)} style={backBtnStyle}>
          ← Назад
        </button>
      </div>

      {loading ? (
        <p style={loadingText}>🔄 Загрузка данных...</p>
      ) : report.length === 0 ? (
        <p style={emptyText}>📭 Нет данных о проверках для этого аудитора</p>
      ) : (
        report.map((emp: any) => (
          <div key={emp.name} style={empCard}>
            <div style={empHeader}>
              <h3 style={{ margin: 0 }}>{emp.name}</h3>
              <small style={{ color: "#666" }}>{emp.dept}</small>
            </div>
            <div style={quartersGrid}>
              {Object.entries(emp.quarters).map(([q, data]: [string, any]) => (
                <div key={q} style={quarterCard}>
                  <div style={quarterHeader}>
                    <span style={{ fontWeight: "bold" }}>{q}</span>
                    <span
                      style={{
                        fontSize: 12,
                        color:
                          data.status === "Сдан"
                            ? "#28a745"
                            : data.status === "Не сдан"
                              ? "#dc3545"
                              : "#007bff",
                      }}>
                      {data.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#555", marginTop: 8 }}>
                    Вопросы:{" "}
                    {data.questions.map((qa: any) => (
                      <span
                        key={qa.num}
                        title={`Q${qa.num}: ${qa.result}`}
                        style={questionBadge(qa.result)}>
                        {qa.num}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ✅ СТИЛИ
const dashboardContainer: React.CSSProperties = {
  maxWidth: 1000,
  margin: "0 auto",
  padding: 20,
};
const inputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: 4,
  border: "1px solid #ccc",
  width: 300,
  fontSize: 14,
};
const loginBtnStyle: React.CSSProperties = {
  padding: "10px 24px",
  background: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer" as const,
  fontSize: 14,
};
const backBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#6c757d",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer" as const,
};
const hintText: React.CSSProperties = {
  color: "#666",
  marginBottom: 20,
  textAlign: "center" as const,
};
const emptyText: React.CSSProperties = {
  textAlign: "center" as const,
  color: "#666",
  padding: 40,
};
const loadingText: React.CSSProperties = {
  textAlign: "center" as const,
  color: "#666",
  padding: 40,
  fontStyle: "italic" as const,
};
const empCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 8,
  marginBottom: 20,
  overflow: "hidden" as const,
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
};
const empHeader: React.CSSProperties = {
  background: "#f8f9fa",
  padding: "15px",
  borderBottom: "1px solid #eee",
};
const quartersGrid: React.CSSProperties = {
  padding: 15,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 15,
};
const quarterCard: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 6,
  padding: 10,
  background: "#fafafa",
};
const quarterHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 5,
};
const questionBadge = (result: string): React.CSSProperties => ({
  display: "inline-block",
  width: 24,
  height: 24,
  lineHeight: "24px",
  textAlign: "center" as const,
  borderRadius: 3,
  background:
    result === "passed"
      ? "#d4edda"
      : result === "failed"
        ? "#f8d7da"
        : "#e2e3e5",
  margin: 2,
  fontSize: 11,
  fontWeight: "bold" as const,
  color:
    result === "passed"
      ? "#155724"
      : result === "failed"
        ? "#721c24"
        : "#383d41",
  cursor: "help" as const,
});

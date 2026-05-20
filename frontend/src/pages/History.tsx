import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../config";

interface HistoryItem {
  id: number;
  auditor_fio: string;
  center: string;
  check_date: string;
  quarter: string;
  employee_fio: string;
  employee_dept: string;
  employee_center: string;
  questions_asked: number[];
  session_status: string;
  total_passed: number;
  total_failed: number;
}

export default function History() {
  const [data, setData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    auditor_fio: "",
    date_from: "",
    date_to: "",
    status: "",
    center: "",
    quarter: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });

    try {
      const res = await axios.get(`${API.history}?${params}`);
      setData(res.data);
    } catch (e) {
      console.error("Ошибка загрузки истории:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    fetchData();
  };

  const resetFilters = () => {
    const empty = {
      auditor_fio: "",
      date_from: "",
      date_to: "",
      status: "",
      center: "",
      quarter: "",
    };
    setFilters(empty);
    setAppliedFilters(empty);
    fetchData();
  };

  return (
    <div style={pageContainer}>
      <h2>📋 История проверок</h2>

      <div style={filtersPanel}>
        <input
          placeholder="Аудитор"
          value={filters.auditor_fio}
          onChange={(e) =>
            setFilters({ ...filters, auditor_fio: e.target.value })
          }
          style={inputStyle}
        />
        <input
          type="date"
          value={filters.date_from}
          onChange={(e) =>
            setFilters({ ...filters, date_from: e.target.value })
          }
          style={inputStyle}
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          style={inputStyle}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          style={inputStyle}>
          <option value="">Все статусы</option>
          <option value="В процессе">В процессе</option>
          <option value="Сдан">Сдан</option>
          {/* ✅ Убрали "Не сдан" */}
        </select>
        <select
          value={filters.center}
          onChange={(e) => setFilters({ ...filters, center: e.target.value })}
          style={inputStyle}>
          <option value="">Все центры</option>
          {[
            "Казань",
            "Москва",
            "Пермь",
            "Всеволожск",
            "Красноярск",
            "Нижнекамск",
            "Нижний Новгород",
            "Воронеж",
          ].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          placeholder="Квартал (2024-Q1)"
          value={filters.quarter}
          onChange={(e) => setFilters({ ...filters, quarter: e.target.value })}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 10, gridColumn: "span 2" }}>
          <button
            onClick={applyFilters}
            style={{ ...btnStyle, background: "#007bff", flex: 1 }}>
            🔍 Применить
          </button>
          <button
            onClick={resetFilters}
            style={{ ...btnStyle, background: "#6c757d" }}>
            🔄 Сброс
          </button>
        </div>
      </div>

      {loading ? (
        <p style={loadingText}>Загрузка данных...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRow}>
                <th style={thStyle}>Дата</th>
                <th style={thStyle}>Квартал</th>
                <th style={thStyle}>Аудитор</th>
                <th style={thStyle}>Сотрудник</th>
                <th style={thStyle}>Центр сотр.</th>
                <th style={thStyle}>Вопросы</th>
                <th style={thStyle}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} style={tbodyRow}>
                  <td style={tdStyle}>{row.check_date}</td>
                  <td style={tdStyle}>{row.quarter}</td>
                  <td style={tdStyle}>{row.auditor_fio}</td>
                  <td style={tdStyle}>
                    {row.employee_fio}
                    <br />
                    <small style={smallText}>{row.employee_dept}</small>
                  </td>
                  <td style={tdStyle}>
                    <span style={badgeCenterStyle}>{row.employee_center}</span>
                  </td>
                  <td style={tdStyle}>
                    {row.questions_asked.map((n: number) => (
                      <span key={n} style={badgeStyle}>
                        #{n}
                      </span>
                    ))}
                    <div style={sessionStats}>
                      +{row.total_passed} / -{row.total_failed}
                    </div>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: "bold" as const,
                      color:
                        row.session_status === "Сдан" ? "#28a745" : "#007bff",
                    }}>
                    {row.session_status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <p style={emptyText}>🔍 Нет данных для отображения</p>
          )}
        </div>
      )}
    </div>
  );
}

// ✅ СТИЛИ
const pageContainer: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 20,
};
const filtersPanel: React.CSSProperties = {
  background: "#f1f3f5",
  padding: 15,
  borderRadius: 8,
  marginBottom: 20,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};
const inputStyle: React.CSSProperties = {
  padding: "8px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  boxSizing: "border-box" as const,
  width: "100%",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer" as const,
  color: "#fff",
  transition: "background 0.2s",
};
const loadingText: React.CSSProperties = {
  textAlign: "center" as const,
  padding: 20,
};
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  background: "#fff",
};
const theadRow: React.CSSProperties = { background: "#333", color: "#fff" };
const thStyle: React.CSSProperties = {
  padding: "12px",
  textAlign: "left" as const,
  fontSize: "13px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};
const tbodyRow: React.CSSProperties = { borderBottom: "1px solid #eee" };
const tdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "14px",
  verticalAlign: "top" as const,
};
const smallText: React.CSSProperties = { color: "#666", fontSize: 12 };
const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#e9ecef",
  padding: "2px 6px",
  borderRadius: 4,
  marginRight: 2,
  fontSize: 12,
};
const badgeCenterStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#e7f1ff",
  padding: "3px 8px",
  borderRadius: 4,
  fontSize: 12,
  color: "#0066cc",
  fontWeight: 500,
};
const sessionStats: React.CSSProperties = {
  fontSize: 11,
  color: "#666",
  marginTop: 4,
};
const emptyText: React.CSSProperties = {
  textAlign: "center" as const,
  padding: 20,
  color: "#666",
};

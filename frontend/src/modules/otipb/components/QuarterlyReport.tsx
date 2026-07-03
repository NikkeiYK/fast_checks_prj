/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../../../config";

interface HistoryItem {
  id: string;
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
  question_results?: Record<number, "passed" | "failed">;
}

interface HistoryFilters {
  auditor_fio: string;
  date_from: string;
  date_to: string;
  status: string;
  quarter: string;
}

// 🔹 Хелпер: вычисление текущего квартала
const getCurrentQuarter = (): string => {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
};

// 🔹 Хелпер: построение URL для общего экспорта
const getFullExportUrl = (quarter: string): string => {
  const params = new URLSearchParams({ quarter });
  return `${API.export}?${params}`;
};

export default function QuarterlyReport() {
  const [quarters, setQuarters] = useState<string[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCenter, setExpandedCenter] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [centerHistory, setCenterHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    auditor_fio: "",
    date_from: "",
    date_to: "",
    status: "",
    quarter: "",
  });

  useEffect(() => {
    axios
      .get(API.quarters)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        const currentQ = getCurrentQuarter();
        const quartersList = data.includes(currentQ) ? data : [currentQ, ...data];
        setQuarters(quartersList);
        if (quartersList.length > 0 && !selectedQuarter) {
          setSelectedQuarter(quartersList[0]);
        }
      })
      .catch(() => {
        const currentQ = getCurrentQuarter();
        setQuarters([currentQ]);
        setSelectedQuarter(currentQ);
        setErrorMsg("Не удалось загрузить кварталы, установлен текущий квартал");
      });
  }, []);

  const loadReport = async (quarterOverride?: string) => {
    const q = quarterOverride || selectedQuarter;
    if (!q) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await axios.get(API.quarterlyReport, {
        params: { quarter: q },
      });
      setReport(res.data);
    } catch (err) {
      setErrorMsg("Ошибка загрузки отчёта");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedQuarter) loadReport();
  }, [selectedQuarter]);

  useEffect(() => {
    if (expandedCenter && selectedQuarter) {
      loadCenterHistory(expandedCenter, selectedQuarter, historyFilters);
    }
  }, [selectedQuarter, expandedCenter]);

  const loadCenterHistory = async (
    center: string,
    quarter: string,
    filters: HistoryFilters
  ) => {
    setHistoryLoading(true);
    const params = new URLSearchParams({ center, quarter });
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });

    try {
      const res = await axios.get(`${API.history}?${params}`);
      setCenterHistory(res.data);
    } catch (err) {
      console.error("Ошибка загрузки истории центра:", err);
      setCenterHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const applyHistoryFilters = () => {
    if (expandedCenter && selectedQuarter) {
      loadCenterHistory(expandedCenter, selectedQuarter, historyFilters);
    }
  };

  const resetHistoryFilters = () => {
    const empty: HistoryFilters = {
      auditor_fio: "",
      date_from: "",
      date_to: "",
      status: "",
      quarter: "",
    };
    setHistoryFilters(empty);
    if (expandedCenter && selectedQuarter) {
      loadCenterHistory(expandedCenter, selectedQuarter, empty);
    }
  };

  const getExportUrl = () => {
    const params = new URLSearchParams({ quarter: selectedQuarter });
    if (expandedCenter) params.append("center", expandedCenter);
    Object.entries(historyFilters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    return `${API.export}?${params}`;
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(API.importEmployees, formData);
      setImportMsg(
        `✅ Справочник обновлён: добавлено ${res.data.added}, ` +
        `восстановлено ${res.data.updated ?? 0}, ` +
        `всего активно: ${res.data.total_active ?? "?"}`
      );
      if (!selectedQuarter) {
        const currentQ = getCurrentQuarter();
        setSelectedQuarter(currentQ);
      }
      const quartersRes = await axios.get(API.quarters);
      const data = Array.isArray(quartersRes.data) ? quartersRes.data : [];
      const currentQ = getCurrentQuarter();
      const quartersList = data.includes(currentQ) ? data : [currentQ, ...data];
      setQuarters(quartersList);

      await loadReport();
      setTimeout(() => setImportMsg(""), 5000);
    } catch (err: any) {
      setImportMsg(
        `❌ Ошибка импорта: ${err.response?.data?.detail || err.message}`
      );
    } finally {
      e.target.value = "";
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm("Удалить эту запись проверки?")) return;
    try {
      await axios.delete(`${API.sessions}/${sessionId}`);
      if (expandedCenter && selectedQuarter) {
        await loadCenterHistory(expandedCenter, selectedQuarter, historyFilters);
      }
      await loadReport();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка удаления");
    }
  };

  const toggleCenter = async (center: string) => {
    const newExpanded = expandedCenter === center ? null : center;
    setExpandedCenter(newExpanded);
    if (newExpanded && selectedQuarter) {
      await loadCenterHistory(newExpanded, selectedQuarter, historyFilters);
    }
  };

  const getCheckResult = (item: HistoryItem): "passed" | "failed" => {
    if (item.total_failed > 0) return "failed";
    if (item.session_status === "Сдан" && item.total_passed > 0) return "passed";
    return "failed";
  };

  const getQuestionStatus = (
    item: HistoryItem,
    questionNum: number
  ): "passed" | "failed" | "unknown" => {
    if (item.question_results?.[questionNum]) {
      return item.question_results[questionNum];
    }
    if (item.total_failed > 0 && questionNum > item.total_passed) {
      return "failed";
    }
    return "passed";
  };

  return (
    <div style={containerStyle}>
      <h2>📊 Статистика быстрой проверки</h2>

      <div style={sectionStyle}>
        <h4>📥 Импорт сотрудников из Excel</h4>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
          Загрузите файл с колонками: <b>ФИО, Центр, Подразделение</b>.
          История проверок сохранится.
        </p>
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileImport}
          style={{ marginBottom: 10 }}
        />
        {importMsg && (
          <div style={messageStyle(importMsg.startsWith("✅"))}>{importMsg}</div>
        )}
      </div>

      {errorMsg && <div style={messageStyle(false)}>{errorMsg}</div>}
      <div style={sectionStyle}>
        <label><b>Квартал: </b></label>
        <select
          value={selectedQuarter}
          onChange={(e) => setSelectedQuarter(e.target.value)}
          style={selectStyle}
        >
          {quarters.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <button onClick={() => loadReport()} disabled={loading} style={btnStyle}>
          🔄 Обновить
        </button>
        {/* 🔹 КНОПКА ЭКСПОРТА ВСЕХ ЦЕНТРОВ */}
        {selectedQuarter && (
          <a
            href={getFullExportUrl(selectedQuarter)}
            target="_blank"
            rel="noopener noreferrer"
            style={exportAllBtnStyle}
          >
            📥 Выгрузить всё в Excel
          </a>
        )}
      </div>

      {loading && <p style={{ textAlign: "center" }}>Загрузка...</p>}
      {report && report.centers?.length === 0 && (
        <div style={emptyReportStyle}>
          📭 Нет данных по центрам. Импортируйте список сотрудников.
        </div>
      )}
      {report && report.centers?.length > 0 && (
        <div>
          <h4>Общая сводка за {report.quarter}</h4>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Центр</th>
                <th style={thStyle}>Всего сотрудников</th>
                <th style={thStyle}>Проверку прошли</th>
                <th style={thStyle}>Не проходили</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {report.centers.map((c: any) => (
                <React.Fragment key={c.center}>
                  <tr
                    style={{
                      cursor: "pointer",
                      background:
                        expandedCenter === c.center ? "#f0f0f0" : "white",
                    }}
                    onClick={() => toggleCenter(c.center)}
                  >
                    <td style={tdStyle}><b>{c.center}</b></td>
                    <td style={tdStyle}>{c.total_employees}</td>
                    <td style={{ ...tdStyle, color: "#28a745", fontWeight: 500 }}>
                      {c.checked}
                    </td>
                    <td style={{ ...tdStyle, color: "#6c757d" }}>{c.not_checked}</td>
                    <td style={tdStyle}>
                      {expandedCenter === c.center ? "▲" : "▼"}
                    </td>
                  </tr>

                  {expandedCenter === c.center && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0, background: "#fafafa" }}>
                        <div style={historySectionStyle}>
                          <div style={historyHeaderStyle}>
                            <div>
                              <h4 style={{ margin: "0 0 10px 0" }}>
                                📋 История проверок: {c.center}
                              </h4>
                              <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
                                Квартал: <b>{selectedQuarter}</b>
                              </p>
                            </div>
                            <a
                              href={getExportUrl()}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={exportBtnStyle}
                            >
                              📥 Выгрузить этот центр
                            </a>
                          </div>

                          <div style={filtersPanelStyle}>
                            <input
                              placeholder="Аудитор"
                              value={historyFilters.auditor_fio}
                              onChange={(e) =>
                                setHistoryFilters({
                                  ...historyFilters,
                                  auditor_fio: e.target.value,
                                })
                              }
                              style={inputStyle}
                            />
                            <input
                              type="date"
                              value={historyFilters.date_from}
                              onChange={(e) =>
                                setHistoryFilters({
                                  ...historyFilters,
                                  date_from: e.target.value,
                                })
                              }
                              style={inputStyle}
                            />
                            <input
                              type="date"
                              value={historyFilters.date_to}
                              onChange={(e) =>
                                setHistoryFilters({
                                  ...historyFilters,
                                  date_to: e.target.value,
                                })
                              }
                              style={inputStyle}
                            />
                            <select
                              value={historyFilters.status}
                              onChange={(e) =>
                                setHistoryFilters({
                                  ...historyFilters,
                                  status: e.target.value,
                                })
                              }
                              style={inputStyle}
                            >
                              <option value="">Все статусы</option>
                              <option value="Сдан">Сдан</option>
                              <option value="В процессе">В процессе</option>
                            </select>
                            <input
                              placeholder="Квартал"
                              value={historyFilters.quarter}
                              onChange={(e) =>
                                setHistoryFilters({
                                  ...historyFilters,
                                  quarter: e.target.value,
                                })
                              }
                              style={inputStyle}
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={applyHistoryFilters}
                                style={{ ...btnSmallStyle, background: "#007bff" }}
                              >
                                🔍
                              </button>
                              <button
                                onClick={resetHistoryFilters}
                                style={{ ...btnSmallStyle, background: "#6c757d" }}
                              >
                                🔄
                              </button>
                            </div>
                          </div>

                          {historyLoading ? (
                            <p style={{ textAlign: "center", padding: 20 }}>
                              Загрузка истории...
                            </p>
                          ) : (
                            <div style={{ overflowX: "auto" }}>
                              <table style={innerTableStyle}>
                                <thead>
                                  <tr style={innerTheadRow}>
                                    <th style={innerThStyle}>Дата</th>
                                    <th style={innerThStyle}>Аудитор</th>
                                    <th style={innerThStyle}>Сотрудник</th>
                                    <th style={innerThStyle}>Подразделение</th>
                                    <th style={innerThStyle}>Вопросы</th>
                                    <th style={innerThStyle}>Результат</th>
                                    <th style={innerThStyle}>Действия</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {centerHistory.length === 0 ? (
                                    <tr>
                                      <td colSpan={7} style={{ ...innerTdStyle, textAlign: "center", color: "#666" }}>
                                        🔍 Нет данных для отображения
                                      </td>
                                    </tr>
                                  ) : (
                                    centerHistory.map((item) => {
                                      const result = getCheckResult(item);
                                      return (
                                        <tr key={item.id} style={innerTbodyRow}>
                                          <td style={innerTdStyle}>{item.check_date}</td>
                                          <td style={innerTdStyle}>{item.auditor_fio}</td>
                                          <td style={innerTdStyle}>{item.employee_fio}</td>
                                          <td style={innerTdStyle}>{item.employee_dept}</td>
                                          <td style={innerTdStyle}>
                                            {item.questions_asked.map((qNum) => {
                                              const qStatus = getQuestionStatus(item, qNum);
                                              return (
                                                <span
                                                  key={qNum}
                                                  style={{
                                                    ...questionBadgeStyle,
                                                    background:
                                                      qStatus === "passed"
                                                        ? "#d4edda"
                                                        : qStatus === "failed"
                                                        ? "#f8d7da"
                                                        : "#e9ecef",
                                                    color:
                                                      qStatus === "passed"
                                                        ? "#155724"
                                                        : qStatus === "failed"
                                                        ? "#721c24"
                                                        : "#666",
                                                    border: `1px solid ${
                                                      qStatus === "passed"
                                                        ? "#c3e6cb"
                                                        : qStatus === "failed"
                                                        ? "#f5c6cb"
                                                        : "#ccc"
                                                    }`,
                                                  }}
                                                  title={
                                                    qStatus === "passed"
                                                      ? "Верно"
                                                      : qStatus === "failed"
                                                      ? "Неверно"
                                                      : "Статус неизвестен"
                                                  }
                                                >
                                                  #{qNum}
                                                </span>
                                              );
                                            })}
                                            <div style={sessionStatsStyle}>
                                              +{item.total_passed} / −{item.total_failed}
                                            </div>
                                          </td>
                                          <td
                                            style={{
                                              ...innerTdStyle,
                                              fontWeight: 600,
                                              color: result === "passed" ? "#28a745" : "#dc3545",
                                              background: result === "passed" ? "#d4edda33" : "#f8d7da33",
                                              padding: "6px 10px",
                                              borderRadius: "4px",
                                              textAlign: "center" as const,
                                            }}
                                          >
                                            {result === "passed" ? "✅ Сдал" : "❌ Не сдал"}
                                          </td>
                                          <td style={innerTdStyle}>
                                            <button
                                              onClick={() => deleteSession(item.id)}
                                              style={deleteBtnStyle}
                                              title="Удалить запись"
                                              onMouseOver={(e) =>
                                                (e.currentTarget.style.background = "#fee2e2")
                                              }
                                              onMouseOut={(e) =>
                                                (e.currentTarget.style.background = "none")
                                              }
                                            >
                                              🗑️
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== СТИЛИ ====================
const containerStyle: React.CSSProperties = {
  maxWidth: 1400,
  margin: "0 auto",
  padding: 20,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const sectionStyle: React.CSSProperties = {
  background: "#f8f9fa",
  padding: 15,
  borderRadius: 8,
  marginBottom: 20,
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 4,
  border: "1px solid #ccc",
  marginLeft: 10,
  marginRight: 10,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 14,
};

// 🔹 Стиль для кнопки "Выгрузить всё"
const exportAllBtnStyle: React.CSSProperties = {
  background: "#107c41",
  color: "#fff",
  padding: "8px 16px",
  textDecoration: "none",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginLeft: 10,
  transition: "background 0.2s",
  cursor: "pointer",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 10,
  background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const thStyle: React.CSSProperties = {
  borderBottom: "2px solid #ddd",
  padding: "12px 10px",
  textAlign: "left",
  background: "#e9ecef",
  fontSize: 14,
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "12px 10px",
  fontSize: 14,
};

const innerTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const innerTheadRow: React.CSSProperties = {
  background: "#495057",
  color: "#fff",
};

const innerThStyle: React.CSSProperties = {
  borderBottom: "1px solid #dee2e6",
  padding: "10px 8px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: "0.3px",
};

const innerTbodyRow: React.CSSProperties = {
  borderBottom: "1px solid #f1f1f1",
};

const innerTdStyle: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "10px 8px",
  fontSize: 13,
  verticalAlign: "top" as const,
};

const historySectionStyle: React.CSSProperties = {
  padding: "15px 20px",
};

const historyHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 15,
  paddingBottom: 12,
  borderBottom: "1px solid #e0e0e0",
};

const exportBtnStyle: React.CSSProperties = {
  background: "#107c41",
  color: "#fff",
  padding: "8px 16px",
  textDecoration: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  transition: "background 0.2s",
};

const filtersPanelStyle: React.CSSProperties = {
  background: "#f8f9fa",
  padding: "12px 15px",
  borderRadius: 6,
  marginBottom: 15,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
  alignItems: "end",
};

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 4,
  border: "1px solid #ccc",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box" as const,
};

const btnSmallStyle: React.CSSProperties = {
  padding: "7px 12px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  color: "#fff",
  fontSize: 13,
  fontWeight: 500,
};

const questionBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 7px",
  borderRadius: 4,
  marginRight: 4,
  marginBottom: 4,
  fontSize: 11,
  fontWeight: 500,
  transition: "all 0.15s",
};

const sessionStatsStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#666",
  marginTop: 5,
  paddingTop: 4,
  borderTop: "1px dashed #eee",
};

const messageStyle = (isSuccess: boolean): React.CSSProperties => ({
  padding: 10,
  borderRadius: 4,
  marginTop: 10,
  fontWeight: 500,
  background: isSuccess ? "#d4edda" : "#f8d7da",
  color: isSuccess ? "#155724" : "#721c24",
  fontSize: 14,
});

const emptyReportStyle: React.CSSProperties = {
  textAlign: "center",
  padding: 40,
  color: "#666",
  background: "#f8f9fa",
  borderRadius: 8,
  fontSize: 15,
};

const deleteBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#dc3545",
  cursor: "pointer",
  fontSize: 16,
  padding: "4px 8px",
  borderRadius: 4,
  transition: "background 0.2s",
};
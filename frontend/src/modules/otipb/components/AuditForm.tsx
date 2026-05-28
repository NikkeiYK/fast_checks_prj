// src/modules/otipb/components/AuditForm.tsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API } from "../../../config";

export default function AuditForm() {
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    auditor_fio: "",
    auditor_dept: "",
    center: "",
    check_date: new Date().toISOString().split("T")[0],
    employee_fio: "",
    employee_dept: "",
    employee_center: "",
  });

  // 🔹 Состояния для автокомплита сотрудника
  const [empSuggestions, setEmpSuggestions] = useState<any[]>([]);
  const [showEmpSuggestions, setShowEmpSuggestions] = useState(false);

  // 🔹 Состояния для автокомплита аудитора (НОВОЕ)
  const [auditorSuggestions, setAuditorSuggestions] = useState<any[]>([]);
  const [showAuditorSuggestions, setShowAuditorSuggestions] = useState(false);

  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, "passed" | "failed">>({});

  // 🔹 Ref для закрытия подсказок при клике вне
  const auditorInputRef = useRef<HTMLDivElement>(null);
  const empInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    axios.get(API.meta).then((res) => setMeta(res.data));
  }, []);

  // 🔹 Закрытие подсказок при клике вне полей
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (auditorInputRef.current && !auditorInputRef.current.contains(event.target as Node)) {
        setShowAuditorSuggestions(false);
      }
      if (empInputRef.current && !empInputRef.current.contains(event.target as Node)) {
        setShowEmpSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🔹 Обработчик ввода ФИО аудитора
  const handleAuditorChange = async (val: string) => {
    setForm({ ...form, auditor_fio: val });
    if (val.length > 2) {
      try {
        const res = await axios.post(API.empSearch, { query: val });
        setAuditorSuggestions(res.data);
        setShowAuditorSuggestions(true);
      } catch (err) {
        console.error("❌ Auditor search error:", err);
        setAuditorSuggestions([]);
      }
    } else {
      setShowAuditorSuggestions(false);
      setAuditorSuggestions([]);
    }
  };

  // 🔹 Выбор аудитора из подсказок
  const selectAuditor = (emp: any) => {
    setForm({
      ...form,
      auditor_fio: emp.fio,
      auditor_dept: emp.department,
      center: emp.center, // авто-центр = центр аудитора
    });
    setShowAuditorSuggestions(false);
    setAuditorSuggestions([]);
  };

  // 🔹 Обработчик ввода ФИО сотрудника (без изменений)
  const handleEmpChange = async (val: string) => {
    setForm({ ...form, employee_fio: val });
    if (val.length > 2) {
      try {
        const res = await axios.post(API.empSearch, { query: val });
        setEmpSuggestions(res.data);
        setShowEmpSuggestions(true);
      } catch (err) {
        console.error("❌ Employee search error:", err);
        setEmpSuggestions([]);
      }
    } else {
      setShowEmpSuggestions(false);
      setEmpSuggestions([]);
    }
  };

  // 🔹 Выбор сотрудника из подсказок (без изменений)
  const selectEmployee = (emp: any) => {
    setForm({
      ...form,
      employee_fio: emp.fio,
      employee_dept: emp.department,
      employee_center: emp.center,
      center: emp.center, // автоцентр аудита = центр сотрудника
    });
    setShowEmpSuggestions(false);
    setEmpSuggestions([]);
  };

  const toggleQuestion = (qId: number) => {
    if (selectedQuestions.includes(qId)) {
      setSelectedQuestions(selectedQuestions.filter((id) => id !== qId));
      const newAns = { ...answers };
      delete newAns[qId];
      setAnswers(newAns);
    } else {
      setSelectedQuestions([...selectedQuestions, qId]);
    }
  };

  const selectAllQuestions = () => {
    if (!meta) return;
    const allIds = meta.questions.map((q: any) => q.id);
    setSelectedQuestions(allIds);
    const newAnswers: Record<number, "passed" | "failed"> = {};
    allIds.forEach((id: any) => {
      if (!answers[id]) newAnswers[id] = "passed";
    });
    setAnswers({ ...answers, ...newAnswers });
  };

  const clearAllQuestions = () => {
    setSelectedQuestions([]);
    setAnswers({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    if (selectedQuestions.length === 0) {
      setMsg("⚠️ Выберите хотя бы один вопрос для проверки");
      setLoading(false);
      return;
    }

    if (selectedQuestions.length < 17) {
      setMsg("⚠️ Вам необходимо провести полный опрос");
      setLoading(false);
      return;
    }

    const unanswered = selectedQuestions.filter((qId) => !answers[qId]);
    if (unanswered.length > 0) {
      setMsg(`⚠️ Не указан результат для вопросов: ${unanswered.join(", ")}`);
      setLoading(false);
      return;
    }

    // 🔹 Валидация: аудитор должен быть из справочника
    if (!form.auditor_dept || !form.center) {
      setMsg("⚠️ Выберите аудитора из справочника (не вводите вручную)");
      setLoading(false);
      return;
    }

    try {
      const questionIdsAsNumbers = selectedQuestions.map((id) => Number(id));

      const answersWithStringKeys: Record<string, string> = {};
      Object.entries(answers).forEach(([key, value]) => {
        answersWithStringKeys[String(key)] = value;
      });

      const payload = {
        auditor_fio: form.auditor_fio,
        auditor_dept: form.auditor_dept,
        center: form.center,
        check_date: form.check_date,
        employee_fio: form.employee_fio,
        employee_dept: form.employee_dept,
        employee_center: form.employee_center,
        selected_question_ids: questionIdsAsNumbers,
        answers: answersWithStringKeys,
      };

      const response = await axios.post(API.sessions, payload);

      setMsg(
        `✅ Сессия сохранена! Вопросы: ${selectedQuestions.join(", ")}. Статус: ${response.data.global_status}`
      );
      setSelectedQuestions([]);
      setAnswers({});
    } catch (err: any) {
      let errorMsg = "Неизвестная ошибка";

      if (err.response) {
        const status = err.response.status;
        const data = err.response.data;

        if (status === 422) {
          const details = data.detail;
          if (Array.isArray(details)) {
            errorMsg = details
              .map((d: any) => `${d.loc.join(".")}: ${d.msg}`)
              .join("; ");
          } else if (typeof details === "string") {
            errorMsg = details;
          } else {
            errorMsg = JSON.stringify(details);
          }
        } else {
          errorMsg = data?.detail || data?.message || `Ошибка сервера (${status})`;
        }
      } else if (err.request) {
        errorMsg = "Нет ответа от сервера. Проверьте, запущен ли бэкенд.";
      } else {
        errorMsg = err.message || "Ошибка при отправке";
      }

      setMsg(`❌ Ошибка: ${errorMsg}`);
      console.error("Full error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!meta) return <div style={containerStyle}>Загрузка справочников...</div>;

  return (
    <div style={containerStyle}>
      <h2>📝 Новая проверка</h2>

      <form onSubmit={handleSubmit} style={formStyle}>
        {/* 👤 Аудитор (с автокомплитом) */}
        <h4>👤 Аудитор (выберите из справочника)</h4>
        
        {/* Поле ФИО аудитора с подсказками */}
        <div ref={auditorInputRef} style={{ position: "relative", marginBottom: 15 }}>
          <input
            placeholder="ФИО Аудитора* (начните вводить)"
            required
            value={form.auditor_fio}
            onChange={(e) => handleAuditorChange(e.target.value)}
            style={inputStyle}
            autoComplete="off"
          />
          {showAuditorSuggestions && auditorSuggestions.length > 0 && (
            <ul style={suggestionsStyle}>
              {auditorSuggestions.map((emp: any) => (
                <li
                  key={`aud-${emp.id}`}
                  onClick={() => selectAuditor(emp)}
                  style={suggestionItemStyle}
                >
                  {emp.fio}{" "}
                  <small style={{ color: "#666" }}>
                    ({emp.department}, {emp.center})
                  </small>
                </li>
              ))}
            </ul>
          )}
          {showAuditorSuggestions && form.auditor_fio.length > 2 && auditorSuggestions.length === 0 && (
            <div style={noResultsStyle}>Не найдено в справочнике</div>
          )}
        </div>

        {/* Автозаполняемые поля отдела и центра */}
        <div style={gridStyle}>
          <input
            placeholder="Подразделение (авто)"
            readOnly
            required
            value={form.auditor_dept}
            style={{ ...inputStyle, background: "#f1f3f5", cursor: "not-allowed" }}
            title="Выберите аудитора из справочника"
          />
          <input
            placeholder="Центр (авто)"
            readOnly
            required
            value={form.center}
            style={{ ...inputStyle, background: "#f1f3f5", cursor: "not-allowed" }}
            title="Выберите аудитора из справочника"
          />
        </div>
        
        <input
          type="date"
          value={form.check_date}
          onChange={(e) => setForm({ ...form, check_date: e.target.value })}
          required
          style={{ ...inputStyle, marginBottom: 15 }}
        />

        {/* 🔍 Аудируемый (без изменений) */}
        <h4>🔍 Аудируемый</h4>
        <div ref={empInputRef} style={{ position: "relative", marginBottom: 15 }}>
          <input
            placeholder="ФИО Сотрудника (начните вводить)*"
            required
            value={form.employee_fio}
            onChange={(e) => handleEmpChange(e.target.value)}
            style={inputStyle}
            autoComplete="off"
          />
          {showEmpSuggestions && empSuggestions.length > 0 && (
            <ul style={suggestionsStyle}>
              {empSuggestions.map((emp: any) => (
                <li
                  key={`emp-${emp.id}`}
                  onClick={() => selectEmployee(emp)}
                  style={suggestionItemStyle}
                >
                  {emp.fio}{" "}
                  <small style={{ color: "#666" }}>
                    ({emp.department}, {emp.center})
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={gridStyle}>
          <input
            placeholder="Подразделение (автозаполнение)"
            readOnly
            required
            value={form.employee_dept}
            style={{ ...inputStyle, background: "#f1f3f5" }}
          />
          <input
            placeholder="Центр сотрудника (автозаполнение)"
            readOnly
            required
            value={form.employee_center}
            style={{ ...inputStyle, background: "#f1f3f5" }}
          />
        </div>

        {/* ❓ Вопросы (без изменений) */}
        <h4>Вопросы по списку:</h4>
        <div
          style={{
            marginBottom: 15,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={selectAllQuestions}
            style={{ ...btnSmallStyle, background: "#17a2b8", color: "#fff" }}
          >
            ✅ Выбрать все 17
          </button>
          <button
            type="button"
            onClick={clearAllQuestions}
            style={{ ...btnSmallStyle, background: "#6c757d", color: "#fff" }}
          >
            ❌ Снять выбор
          </button>
          <span style={{ fontSize: 13, color: "#666" }}>
            Выбрано: <b>{selectedQuestions.length}</b>/17
          </span>
        </div>

        <div style={questionsGridStyle}>
          {meta.questions.map((q: any) => (
            <label
              key={q.id}
              style={{
                ...questionLabelStyle,
                background: selectedQuestions.includes(q.id)
                  ? "#e7f1ff"
                  : "#fff",
                border: selectedQuestions.includes(q.id)
                  ? "2px solid #007bff"
                  : "1px solid #ddd",
              }}
            >
              <input
                type="checkbox"
                checked={selectedQuestions.includes(q.id)}
                onChange={() => toggleQuestion(q.id)}
                style={{ flexShrink: 0 }}
              />
              <span style={{ minWidth: 0, overflowWrap: "break-word" }}>
                <b>#{q.num}</b> {q.text}
              </span>
            </label>
          ))}
        </div>

        {/* 🎯 Результаты (без изменений) */}
        {selectedQuestions.length > 0 && (
          <div style={answersBoxStyle}>
            <h4>🎯 Результаты</h4>
            {selectedQuestions.map((qId) => {
              const q = meta.questions.find((x: any) => x.id === qId);
              return (
                <div key={qId} style={answerRowStyle}>
                  <span style={answerTextStyle}>
                    <b>#{q.num}</b> {q.text}
                  </span>
                  <div style={answerButtonsStyle}>
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers({ ...answers, [qId]: "passed" })
                      }
                      style={{
                        ...btnSmallStyle,
                        background:
                          answers[qId] === "passed" ? "#28a745" : "#e9ecef",
                        color: answers[qId] === "passed" ? "#fff" : "#333",
                      }}
                    >
                      Сдал
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers({ ...answers, [qId]: "failed" })
                      }
                      style={{
                        ...btnSmallStyle,
                        background:
                          answers[qId] === "failed" ? "#dc3545" : "#e9ecef",
                        color: answers[qId] === "failed" ? "#fff" : "#333",
                      }}
                    >
                      Не сдал
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || selectedQuestions.length === 0}
          style={{
            ...submitBtnStyle,
            opacity: loading || selectedQuestions.length === 0 ? 0.6 : 1,
          }}
        >
          {loading ? "Сохранение..." : "💾 Сохранить результат"}
        </button>

        {msg && (
          <p
            style={{
              textAlign: "center",
              marginTop: 10,
              padding: 10,
              borderRadius: 4,
              background: msg.includes("✅") ? "#d4edda" : "#f8d7da",
              color: msg.includes("✅") ? "#155724" : "#721c24",
              fontWeight: "bold",
              margin: 0,
            }}
          >
            {msg}
          </p>
        )}
      </form>
    </div>
  );
}

// ==================== СТИЛИ ====================
const containerStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: 4,
  border: "1px solid #ccc",
  boxSizing: "border-box",
  width: "100%",
  fontSize: "14px",
};

const formStyle: React.CSSProperties = {
  background: "#f8f9fa",
  padding: 20,
  borderRadius: 8,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginBottom: 15,
};

const suggestionsStyle: React.CSSProperties = {
  position: "absolute",
  background: "#fff",
  border: "1px solid #ddd",
  width: "100%",
  maxHeight: 150,
  overflow: "auto",
  zIndex: 10,
  margin: 0,
  padding: 0,
  listStyle: "none",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  borderRadius: "4px",
};

const suggestionItemStyle: React.CSSProperties = {
  padding: "8px 12px",
  cursor: "pointer",
  borderBottom: "1px solid #eee",
  fontSize: "14px",
  transition: "background 0.1s",
};

const noResultsStyle: React.CSSProperties = {
  position: "absolute",
  background: "#fff",
  border: "1px solid #ddd",
  width: "100%",
  padding: "8px 12px",
  zIndex: 10,
  color: "#666",
  fontSize: "13px",
  borderRadius: "4px",
};

const questionsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 8,
  marginBottom: 20,
};

const questionLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 10,
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "13px",
  minHeight: "44px",
  boxSizing: "border-box",
};

const answersBoxStyle: React.CSSProperties = {
  background: "#fff",
  padding: 15,
  borderRadius: 6,
  border: "1px solid #eee",
  marginBottom: 20,
};

const answerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "12px",
  padding: "8px 0",
  borderBottom: "1px solid #f0f0f0",
};

const answerTextStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: "14px",
  color: "#334155",
  lineHeight: 1.4,
  wordBreak: "normal",
  overflowWrap: "break-word",
};

const answerButtonsStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexShrink: 0,
};

const btnSmallStyle: React.CSSProperties = {
  padding: "8px 16px",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  transition: "background 120ms ease, transform 50ms ease",
};

const submitBtnStyle: React.CSSProperties = {
  padding: "14px 24px",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  color: "#fff",
  background: "#007bff",
  fontSize: "16px",
  fontWeight: 500,
  width: "100%",
  transition: "background 120ms ease",
};
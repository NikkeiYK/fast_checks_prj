import { useState, useEffect } from "react";
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
    employee_center: "", // ✅ Центр сотрудника
  });

  const [empSuggestions, setEmpSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, "passed" | "failed">>(
    {},
  );

  useEffect(() => {
    axios.get(API.meta).then((res) => setMeta(res.data));
  }, []);

  const handleEmpChange = async (val: string) => {
    setForm({ ...form, employee_fio: val });
    if (val.length > 2) {
      const res = await axios.post(API.empSearch, { query: val });
      setEmpSuggestions(res.data);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectEmployee = (emp: any) => {
    setForm({
      ...form,
      employee_fio: emp.fio,
      employee_dept: emp.department,
      employee_center: emp.center, // ✅ Автозаполнение центра
    });
    setShowSuggestions(false);
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

    // Валидация
    if (selectedQuestions.length === 0) {
      setMsg("⚠️ Выберите хотя бы один вопрос для проверки");
      setLoading(false);
      return;
    }

    const unanswered = selectedQuestions.filter((qId) => !answers[qId]);
    if (unanswered.length > 0) {
      setMsg(`⚠️ Не указан результат для вопросов: ${unanswered.join(", ")}`);
      setLoading(false);
      return;
    }

    try {
      // 1. Гарантируем, что сотрудник в базе (с центром)
      await axios.post(API.empUpsert, {
        fio: form.employee_fio,
        department: form.employee_dept,
        center: form.employee_center,
      });

      // 2. ✅ Явно конвертируем selected_question_ids в числа
      const questionIdsAsNumbers = selectedQuestions.map((id) => Number(id));

      // 3. ✅ Конвертируем ключи ответов в СТРОКИ (JSON безопаснее со строковыми ключами)
      const answersWithStringKeys: Record<string, string> = {};
      Object.entries(answers).forEach(([key, value]) => {
        answersWithStringKeys[String(key)] = value;
      });

      // 4. ✅ Формируем явный payload
      const payload = {
        auditor_fio: form.auditor_fio,
        auditor_dept: form.auditor_dept,
        center: form.center,
        check_date: form.check_date,
        employee_fio: form.employee_fio,
        employee_dept: form.employee_dept,
        employee_center: form.employee_center,
        selected_question_ids: questionIdsAsNumbers, // ✅ Числа
        answers: answersWithStringKeys, // ✅ Строковые ключи
      };

      // 5. Отправляем сессию
      const response = await axios.post(API.sessions, payload);

      setMsg(
        `✅ Сессия сохранена! Вопросы: ${selectedQuestions.join(", ")}. Статус: ${response.data.global_status}`,
      );
      setSelectedQuestions([]);
      setAnswers({});
    } catch (err: any) {
      // ✅ Подробное извлечение ошибки
      let errorMsg = "Неизвестная ошибка";

      if (err.response) {
        // Сервер вернул ошибку (422, 500, и т.д.)
        const status = err.response.status;
        const data = err.response.data;

        if (status === 422) {
          // Ошибка валидации — показываем детали
          const details = data.detail;
          if (Array.isArray(details)) {
            // FastAPI возвращает массив ошибок валидации
            errorMsg = details
              .map((d: any) => `${d.loc.join(".")}: ${d.msg}`)
              .join("; ");
          } else if (typeof details === "string") {
            errorMsg = details;
          } else {
            errorMsg = JSON.stringify(details);
          }
        } else {
          errorMsg =
            data?.detail || data?.message || `Ошибка сервера (${status})`;
        }
      } else if (err.request) {
        errorMsg = "Нет ответа от сервера. Проверьте, запущен ли бэкенд.";
      } else {
        errorMsg = err.message || "Ошибка при отправке";
      }

      setMsg(`❌ Ошибка: ${errorMsg}`);
      console.error("Full error:", err);
      console.error("Response data:", err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  if (!meta) return <div style={containerStyle}>Загрузка справочников...</div>;

  return (
    <div style={containerStyle}>
      <h2>📝 Новая проверка</h2>
      <a
        href={API.export}
        target="_blank"
        rel="noopener noreferrer"
        style={exportBtnStyle}>
        📥 Excel
      </a>

      <form onSubmit={handleSubmit} style={formStyle}>
        <h4>👤 Аудитор</h4>
        <div style={gridStyle}>
          <input
            placeholder="ФИО Аудитора*"
            required
            value={form.auditor_fio}
            onChange={(e) => setForm({ ...form, auditor_fio: e.target.value })}
            style={inputStyle}
          />
          <select
            value={form.auditor_dept}
            onChange={(e) => setForm({ ...form, auditor_dept: e.target.value })}
            required
            style={inputStyle}>
            <option value="">Департамент аудитора*</option>
            {meta.departments.map((d: string) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={form.center}
            onChange={(e) => setForm({ ...form, center: e.target.value })}
            required
            style={inputStyle}>
            <option value="">Центр Полилаб*</option>
            {meta.centers.map((c: string) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.check_date}
            onChange={(e) => setForm({ ...form, check_date: e.target.value })}
            required
            style={inputStyle}
          />
        </div>

        <h4>🔍 Аудируемый</h4>
        <div style={{ position: "relative", marginBottom: 15 }}>
          <input
            placeholder="ФИО Сотрудника (начните вводить)*"
            required
            value={form.employee_fio}
            onChange={(e) => handleEmpChange(e.target.value)}
            style={inputStyle}
          />
          {showSuggestions && empSuggestions.length > 0 && (
            <ul style={suggestionsStyle}>
              {empSuggestions.map((emp: any) => (
                <li
                  key={emp.id}
                  onClick={() => selectEmployee(emp)}
                  style={suggestionItemStyle}>
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
          <select
            value={form.employee_dept}
            onChange={(e) =>
              setForm({ ...form, employee_dept: e.target.value })
            }
            required
            style={inputStyle}>
            <option value="">Подразделение сотрудника*</option>
            {meta.departments.map((d: string) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={form.employee_center}
            onChange={(e) =>
              setForm({ ...form, employee_center: e.target.value })
            }
            required
            style={inputStyle}>
            <option value="">Центр Полилаб сотрудника*</option>
            {meta.centers.map((c: string) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <h4>Вопросы по списку:</h4>

        {/* ✅ Кнопки управления вопросами */}
        <div
          style={{
            marginBottom: 15,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}>
          <button
            type="button"
            onClick={selectAllQuestions}
            style={{ ...btnSmallStyle, background: "#17a2b8", color: "#fff" }}>
            ✅ Выбрать все 17
          </button>
          <button
            type="button"
            onClick={clearAllQuestions}
            style={{ ...btnSmallStyle, background: "#6c757d", color: "#fff" }}>
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
              }}>
              <input
                type="checkbox"
                checked={selectedQuestions.includes(q.id)}
                onChange={() => toggleQuestion(q.id)}
              />
              <span>
                <b>#{q.num}</b> {q.text}
              </span>
            </label>
          ))}
        </div>

        {selectedQuestions.length > 0 && (
          <div style={answersBoxStyle}>
            <h4>🎯 Результаты</h4>
            {selectedQuestions.map((qId) => {
              const q = meta.questions.find((x: any) => x.id === qId);
              return (
                <div key={qId} style={answerRowStyle}>
                  <span>
                    #{q.num} {q.text}
                  </span>
                  <div>
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
                      }}>
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
                        marginLeft: 5,
                      }}>
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
          }}>
          {loading ? "Сохранение..." : "💾 Сохранить сессию"}
        </button>
        {msg && (
          <p
            style={{
              textAlign: "center" as const,
              marginTop: 10,
              padding: 10,
              borderRadius: 4,
              background: msg.includes("✅") ? "#d4edda" : "#f8d7da",
              color: msg.includes("✅") ? "#155724" : "#721c24",
              fontWeight: "bold" as const,
            }}>
            {msg}
          </p>
        )}
      </form>
    </div>
  );
}

// ✅ СТИЛИ
const containerStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: 20,
};
const inputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: 4,
  border: "1px solid #ccc",
  boxSizing: "border-box" as const,
  width: "100%",
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
  position: "absolute" as const,
  background: "#fff",
  border: "1px solid #ddd",
  width: "100%",
  maxHeight: 150,
  overflow: "auto" as const,
  zIndex: 10,
  margin: 0,
  padding: 0,
  listStyle: "none" as const,
};
const suggestionItemStyle: React.CSSProperties = {
  padding: 8,
  cursor: "pointer" as const,
  borderBottom: "1px solid #eee",
};
const questionsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 8,
  marginBottom: 20,
};
const questionLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center" as const,
  gap: 8,
  padding: 10,
  borderRadius: 4,
  cursor: "pointer" as const,
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
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 10,
  padding: "8px 0",
  borderBottom: "1px solid #f0f0f0",
};
const btnSmallStyle: React.CSSProperties = {
  padding: "8px 14px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer" as const,
  fontSize: 13,
  fontWeight: 500,
};
const submitBtnStyle: React.CSSProperties = {
  padding: "14px 24px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer" as const,
  color: "#fff",
  background: "#007bff",
  fontSize: 16,
  width: "100%",
};
const exportBtnStyle: React.CSSProperties = {
  float: "right" as const,
  background: "#107c41",
  color: "#fff",
  padding: "10px 18px",
  textDecoration: "none",
  borderRadius: 4,
  fontSize: 14,
  fontWeight: 500,
};

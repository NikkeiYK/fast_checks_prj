import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API } from "../../../config";

interface Employee {
  id: number;
  fio: string;
  center: string;
  department: string;
}

interface Filters {
  fio: string;
  center: string;
  department: string;
  quarter: string;
}

export default function NoCheckedList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [showList, setShowList] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState("");
  
  const intervalRef = useRef<number | null>(null);

  const [filters, setFilters] = useState<Filters>({
    fio: "",
    center: "",
    department: "",
    quarter: getDefaultQuarter(),
  });

  const CENTERS = [
    "Казань", "Москва", "Пермь", "Всеволожск",
    "Красноярск", "Нижнекамск", "Нижний Новгород", "Воронеж"
  ];

  const DEPARTMENTS = [
    "СПОР", "Прикладные разработки",
    "Продуктовое развитие", "РПИ", "РПС", "ЦИРМ", "НТР"
  ];

  function getDefaultQuarter(): string {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  // ✅ Загрузка данных (БЕЗ автовыбора)
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setCopyFeedback("");
    
    const params = new URLSearchParams();
    if (filters.quarter) params.append("quarter", filters.quarter);
    if (filters.fio) params.append("fio", filters.fio);
    if (filters.center) params.append("center", filters.center);
    if (filters.department) params.append("department", filters.department);

    try {
      const res = await axios.get(`${API.employeesNotChecked}?${params}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setEmployees(data);
      
      if (data.length === 0) {
        setError("Сотрудники не найдены по заданным фильтрам");
      }
    } catch (err: any) {
      console.error("Ошибка загрузки:", err);
      setError(err.response?.data?.detail || err.message || "Ошибка загрузки данных");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ Очистка интервала при размонтировании
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const applyFilters = () => fetchData();

  const resetFilters = () => {
    setFilters({
      fio: "",
      center: "",
      department: "",
      quarter: getDefaultQuarter(),
    });
    fetchData();
  };

  // ✅ Анимация броска + случайный выбор
  const rollDice = useCallback(() => {
    if (employees.length === 0 || isRolling) return;
    
    setIsRolling(true);
    setSelected(null);
    setCopyFeedback("");

    let count = 0;
    const maxRolls = 14;
    
    intervalRef.current = window.setInterval(() => {
      const tempEmp = employees[Math.floor(Math.random() * employees.length)];
      setSelected(tempEmp);
      count++;
      
      if (count >= maxRolls) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsRolling(false);
        const finalEmp = employees[Math.floor(Math.random() * employees.length)];
        setSelected(finalEmp);
      }
    }, 60);
  }, [employees, isRolling]);

  // ✅ Копирование ФИО при клике
  const handleFioClick = () => {
    if (!selected || isRolling) return;
    navigator.clipboard.writeText(selected.fio).then(() => {
      setCopyFeedback("✅ ФИО скопировано!");
      setTimeout(() => setCopyFeedback(""), 2000);
    }).catch(() => {
      setCopyFeedback("⚠️ Ошибка копирования");
      setTimeout(() => setCopyFeedback(""), 2000);
    });
  };

  // ✅ Ручной выбор из списка
  const selectManually = (emp: Employee) => {
    if (isRolling) return;
    setSelected(emp);
    setCopyFeedback("");
    document.querySelector('[data-card="selected"]')?.scrollIntoView({ 
      behavior: "smooth", 
      block: "center" 
    });
  };

  return (
    <div style={containerStyle}>
      {/* 🔹 CSS для анимации кубика */}
      <style>{`
        @keyframes diceRoll {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(180deg) scale(1.3); }
          50% { transform: rotate(360deg) scale(0.8); }
          75% { transform: rotate(540deg) scale(1.1); }
          100% { transform: rotate(720deg) scale(1); }
        }
        .dice-animated {
          animation: diceRoll 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          display: inline-block;
          transform-origin: center;
        }
      `}</style>

      <h2>🎲 Выбор сотрудника для проверки</h2>

      {/* Панель фильтров */}
      <div style={filtersPanelStyle}>
        <input
          placeholder="ФИО (поиск)"
          value={filters.fio}
          onChange={(e) => setFilters({ ...filters, fio: e.target.value })}
          style={inputStyle}
        />
        <select
          value={filters.center}
          onChange={(e) => setFilters({ ...filters, center: e.target.value })}
          style={inputStyle}
        >
          <option value="">Все центры</option>
          {CENTERS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filters.department}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          style={inputStyle}
        >
          <option value="">Все подразделения</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input
          placeholder="Квартал"
          value={filters.quarter}
          onChange={(e) => setFilters({ ...filters, quarter: e.target.value })}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 8, gridColumn: "span 2" }}>
          <button onClick={applyFilters} style={{ ...btnStyle, background: "#007bff", flex: 1 }}>🔍 Применить</button>
          <button onClick={resetFilters} style={{ ...btnStyle, background: "#6c757d" }}>🔄 Сброс</button>
        </div>
      </div>

      {/* 🔹 Основная карточка */}
      <div style={cardContainerStyle} data-card="selected">
        {loading ? (
          <div style={loadingCardStyle}>🔄 Загрузка списка...</div>
        ) : error ? (
          <div style={errorCardStyle}>⚠️ {error}</div>
        ) : (
          <div style={selected ? selectedCardStyle : placeholderCardStyle}>
            {selected ? (
              // 🔸 Результат выбора
              <>
                <div style={cardHeaderStyle}>
                  <span className={isRolling ? "dice-animated" : ""} style={{ fontSize: 26, marginRight: 8 }}>🎲</span>
                  <span>Сотрудник для проверки</span>
                </div>

                <div 
                  onClick={handleFioClick}
                  style={fioDisplayStyle} 
                  title="Нажмите, чтобы скопировать ФИО"
                >
                  {selected.fio}
                  <span style={copyIconStyle}>📋</span>
                </div>

                <div style={metaGridStyle}>
                  <div style={metaItemStyle}>
                    <span style={metaLabelStyle}>Центр</span>
                    <span style={metaValueStyle}>{selected.center}</span>
                  </div>
                  <div style={metaItemStyle}>
                    <span style={metaLabelStyle}>Подразделение</span>
                    <span style={metaValueStyle}>{selected.department}</span>
                  </div>
                </div>

                {copyFeedback && <div style={feedbackStyle}>{copyFeedback}</div>}

                <button 
                  onClick={rollDice}
                  disabled={isRolling}
                  style={{
                    ...rerollBtnStyle,
                    opacity: isRolling ? 0.7 : 1,
                    cursor: isRolling ? "wait" : "pointer",
                  }}
                >
                  {isRolling ? "Бросаем..." : "🎲 Бросить кубик"}
                </button>

                <div style={counterStyle}>Из {employees.length} доступных</div>
              </>
            ) : (
              // 🔸 Заглушка до первого броска
              <>
                <div style={placeholderIconStyle}>🎲</div>
                <p style={{ margin: "0 0 20px 0", fontSize: 15, color: "#555" }}>
                  Настройте фильтры и нажмите кнопку ниже
                </p>
                <button 
                  onClick={rollDice}
                  disabled={employees.length === 0}
                  style={{
                    ...rerollBtnStyle,
                    opacity: employees.length === 0 ? 0.6 : 1,
                    cursor: employees.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  🎲 Бросить кубик
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 🔹 Переключатель списка */}
      {employees.length > 0 && (
        <div style={toggleListStyle}>
          <button onClick={() => setShowList(!showList)} style={toggleBtnStyle}>
            {showList ? "🔼 Скрыть список" : "🔽 Показать список для ручного выбора"}
          </button>
        </div>
      )}

      {/* 🔹 Список сотрудников */}
      {showList && employees.length > 0 && (
        <div style={listSectionStyle}>
          <div style={listHeaderStyle}>
            <span>📋 Все доступные сотрудники</span>
            <span style={listCountStyle}>{employees.length}</span>
          </div>
          <div style={scrollListStyle}>
            {employees.map((emp) => (
              <div
                key={emp.id}
                onClick={() => selectManually(emp)}
                style={{
                  ...listItemStyle,
                  background: selected?.id === emp.id ? "rgba(0, 137, 123, 0.1)" : "transparent",
                  borderLeft: selected?.id === emp.id ? "4px solid #00897b" : "4px solid transparent",
                }}
                title="Нажмите, чтобы выбрать"
              >
                <span style={listFioStyle}>{emp.fio}</span>
                <span style={listMetaStyle}>{emp.center} · {emp.department}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={hintStyle}>
        💡 <b>Совет:</b> клик по ФИО мгновенно копирует имя. Список ниже для ручного выбора, если нужен конкретный человек.
      </p>
    </div>
  );
}

// ==================== СТИЛИ ====================
const containerStyle: React.CSSProperties = { maxWidth: 750, margin: "0 auto", padding: 20, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };
const filtersPanelStyle: React.CSSProperties = { background: "#f8f9fa", padding: "15px 20px", borderRadius: 10, marginBottom: 25, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, alignItems: "end" };
const inputStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14, width: "100%", boxSizing: "border-box" };
const btnStyle: React.CSSProperties = { padding: "10px 16px", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 500 };

const cardContainerStyle: React.CSSProperties = { display: "flex", justifyContent: "center", marginBottom: 20 };
const loadingCardStyle: React.CSSProperties = { padding: "40px", background: "#f1f3f5", borderRadius: 16, textAlign: "center", color: "#666" };
const errorCardStyle: React.CSSProperties = { padding: "30px", background: "#f8d7da", color: "#721c24", borderRadius: 16, textAlign: "center", border: "1px solid #f5c6cb" };

const placeholderCardStyle: React.CSSProperties = { background: "#fff", border: "2px dashed #dee2e6", borderRadius: 20, padding: "40px 30px", textAlign: "center", maxWidth: 500, width: "100%" };
const placeholderIconStyle: React.CSSProperties = { fontSize: 50, marginBottom: 15, opacity: 0.5 };

const selectedCardStyle: React.CSSProperties = { background: "linear-gradient(135deg, #00b4a6 0%, #00897b 100%)", color: "#fff", padding: "30px 35px", borderRadius: 20, width: "100%", maxWidth: 550, boxShadow: "0 10px 35px rgba(0, 137, 123, 0.3)", textAlign: "center" };
const cardHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 15, opacity: 0.95 };
const fioDisplayStyle: React.CSSProperties = { fontSize: 26, fontWeight: 700, marginBottom: 20, lineHeight: 1.3, cursor: "pointer", position: "relative", padding: "10px 15px", borderRadius: 8, background: "rgba(255,255,255,0.12)", transition: "background 0.2s" };
const copyIconStyle: React.CSSProperties = { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.7 };
const metaGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 25, textAlign: "left" };
const metaItemStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const metaLabelStyle: React.CSSProperties = { fontSize: 11, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.5px" };
const metaValueStyle: React.CSSProperties = { fontSize: 17, fontWeight: 600 };
const rerollBtnStyle: React.CSSProperties = { padding: "14px 28px", background: "#fff", color: "#00897b", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 600, width: "100%", maxWidth: 300, margin: "0 auto", display: "block", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" };
const feedbackStyle: React.CSSProperties = { background: "rgba(255,255,255,0.9)", color: "#00897b", padding: "6px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600, display: "inline-block", marginBottom: 12, animation: "fadeIn 0.2s" };
const counterStyle: React.CSSProperties = { fontSize: 12, opacity: 0.85, paddingTop: 15, borderTop: "1px solid rgba(255,255,255,0.3)" };

const toggleListStyle: React.CSSProperties = { textAlign: "center", marginBottom: 15 };
const toggleBtnStyle: React.CSSProperties = { padding: "8px 20px", background: "transparent", border: "1px solid #00897b", color: "#00897b", borderRadius: 20, fontSize: 13, cursor: "pointer", fontWeight: 500 };
const listSectionStyle: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #e0e0e0", overflow: "hidden", marginBottom: 20 };
const listHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: "#f5f5f5", borderBottom: "1px solid #e0e0e0", fontSize: 14, fontWeight: 500 };
const listCountStyle: React.CSSProperties = { background: "#00897b", color: "#fff", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 };
const scrollListStyle: React.CSSProperties = { maxHeight: 280, overflowY: "auto", padding: "8px 0" };
const listItemStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", cursor: "pointer", transition: "background 0.15s", borderBottom: "1px solid #f0f0f0" };
const listFioStyle: React.CSSProperties = { fontSize: 15, fontWeight: 500, color: "#333" };
const listMetaStyle: React.CSSProperties = { fontSize: 13, color: "#666" };
const hintStyle: React.CSSProperties = { textAlign: "center", color: "#666", fontSize: 13, marginTop: 10, padding: "12px 20px", background: "#e0f2f1", borderRadius: 8, borderLeft: "4px solid #00897b" };
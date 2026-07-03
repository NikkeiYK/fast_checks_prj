import React, { useState, useMemo } from "react";
import DataTable, { type TableColumn } from "react-data-table-component";
import type { NpaProject } from "../../../api/monitoring/api";
import * as XLSX from "xlsx";

interface Props { data: NpaProject[]; }

const exportToExcel = (data: NpaProject[], filename: string) => {
  const exportData = data.map(row => ({
    "Приоритет": row.is_priority ? "Да" : "Нет",
    "ID проекта": row.id || "",
    "Наименование": row.title || "",
    "Разработчик": row.developer || "",
    "Вид": row.doc_type || "",
    "Дата создания": row.created_date || "",
    "Дата публикации": row.published_date || "",
    "Этап": row.stage || "",
    "Статус": row.status || "",
    "Процедура": row.procedure || "",
    "URL": row.url || "",
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "НПА");
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
};

const StatusBadge: React.FC<{ status: string | null }> = ({ status }) => {
  const map: Record<string, { bg: string; label: string }> = {
    "Идет обсуждение": { bg: "#008B92", label: "Идет обсуждение" },
    "Обсуждение завершено": { bg: "#95a5a6", label: "Завершено" },
  };
  const s = map[status || ""] || { bg: "#6c757d", label: status || "—" };
  return (
    <span style={{
      background: s.bg, color: "#fff", padding: "4px 12px",
      borderRadius: 12, fontSize: "0.75rem", fontWeight: 600,
    }}>
      {s.label}
    </span>
  );
};

const parseDate = (d: string | null): number => {
  if (!d) return 0;
  const months: Record<string, number> = {
    "января": 0, "февраля": 1, "марта": 2, "апреля": 3,
    "мая": 4, "июня": 5, "июля": 6, "августа": 7,
    "сентября": 8, "октября": 9, "ноября": 10, "декабря": 11,
  };
  
  const match = d.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (match) {
    const day = parseInt(match[1]);
    const month = months[match[2].toLowerCase()] ?? 0;
    const year = parseInt(match[3]);
    return new Date(year, month, day).getTime();
  }
  return 0;
};

export const NpaTable: React.FC<Props> = ({ data }) => {
  const [filter, setFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "priority" | "non-priority">("all");

  const filtered = useMemo(() => {
    let result = data;
    
    // Фильтр по приоритету
    if (priorityFilter === "priority") {
      result = result.filter(n => n.is_priority);
    } else if (priorityFilter === "non-priority") {
      result = result.filter(n => !n.is_priority);
    }
    
    // Текстовый поиск
    if (filter) {
      const f = filter.toLowerCase();
      result = result.filter(n =>
        (n.title || "").toLowerCase().includes(f) ||
        (n.id || "").toLowerCase().includes(f) ||
        (n.developer || "").toLowerCase().includes(f) ||
        (n.doc_type || "").toLowerCase().includes(f) ||
        (n.status || "").toLowerCase().includes(f)
      );
    }
    
    return result;
  }, [data, filter, priorityFilter]);

  // Подсчёт приоритетных
  const priorityCount = useMemo(() => data.filter(n => n.is_priority).length, [data]);

  const columns: TableColumn<NpaProject>[] = [
    {
      name: "ID проекта",
      selector: r => r.id || "—",
      width: "160px",
      sortable: true,
      cell: r => <code style={{ fontSize: "0.75rem", background: "#f0f0f0", padding: "2px 6px", borderRadius: 4 }}>{r.id || "—"}</code>
    },
    {
      name: "Наименование",
      selector: r => r.title || "—",
      grow: 2,
      sortable: true,
      cell: r => (
        <a href={r.url || "#"} target="_blank" rel="noreferrer"
           style={{ color: "#006b70", textDecoration: "none", fontWeight: 500 }}>
          {r.title || "—"}
        </a>
      )
    },
    {
      name: "Разработчик",
      selector: r => r.developer || "—",
      width: "200px",
      sortable: true,
      // cell: r => (
      //   <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
      //     <span>{r.developer || "—"}</span>
      //     {r.is_priority && (
      //       <span style={{
      //         background: "#FC5A41", color: "#fff", fontSize: "0.65rem",
      //         padding: "2px 6px", borderRadius: 8, whiteSpace: "nowrap",
      //         fontWeight: 600,
      //       }}>Приоритет</span>
      //     )}
      //   </span>
      // ),
    },
    {
      name: "Вид",
      selector: r => r.doc_type || "—",
      width: "180px",
      sortable: true,
      cell: r => (
        <span style={{
          background: "#e6f7f8", color: "#006b70",
          padding: "4px 10px", borderRadius: 12,
          fontSize: "0.75rem", fontWeight: 600,
        }}>
          {r.doc_type || "—"}
        </span>
      )
    },
    {
      name: "Дата публикации",
      selector: r => r.published_date || "—",
      width: "140px",
      sortable: true,
      sortFunction: (a, b) => parseDate(a.published_date) - parseDate(b.published_date),
    },
    {
      name: "Статус",
      selector: r => r.status || "—",
      width: "160px",
      sortable: true,
      cell: r => <StatusBadge status={r.status} />
    },
  ];

  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: 20,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      {/* Панель фильтров */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        gap: 12,
        flexWrap: "wrap",
      }}>
        <input
          type="text"
          placeholder="🔍 Поиск по названию, ID, разработчику, виду, статусу..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            flex: 1,
            minWidth: "250px",
            padding: "10px 14px",
            border: "1px solid #ddd",
            borderRadius: 8,
            fontSize: 14,
            boxSizing: "border-box",
          }}
          onFocus={e => e.target.style.borderColor = "#008B92"}
          onBlur={e => e.target.style.borderColor = "#ddd"}
        />
        <button
          onClick={() => exportToExcel(filtered, "npa_export")}
          style={{
            padding: "10px 20px",
            background: "#217346",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: "nowrap",
          }}
        >
          📥 Экспорт в Excel
        </button>
      </div>

      {/* Фильтр по приоритету */}
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: "0.9rem", color: "#555", fontWeight: 500 }}>
          Приоритет:
        </span>
        <button
          onClick={() => setPriorityFilter("all")}
          style={{
            padding: "6px 14px",
            background: priorityFilter === "all" ? "#008B92" : "#f5f5f5",
            color: priorityFilter === "all" ? "#fff" : "#555",
            border: `1px solid ${priorityFilter === "all" ? "#008B92" : "#ddd"}`,
            borderRadius: 16,
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: priorityFilter === "all" ? 600 : 400,
          }}
        >
          Все ({data.length})
        </button>
        <button
          onClick={() => setPriorityFilter("priority")}
          style={{
            padding: "6px 14px",
            background: priorityFilter === "priority" ? "#FC5A41" : "#fff5f3",
            color: priorityFilter === "priority" ? "#fff" : "#FC5A41",
            border: `1px solid ${priorityFilter === "priority" ? "#FC5A41" : "#FC5A41"}`,
            borderRadius: 16,
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: priorityFilter === "priority" ? 600 : 400,
          }}
        >
          ⭐ Приоритетные ({priorityCount})
        </button>
        <button
          onClick={() => setPriorityFilter("non-priority")}
          style={{
            padding: "6px 14px",
            background: priorityFilter === "non-priority" ? "#008B92" : "#f5f5f5",
            color: priorityFilter === "non-priority" ? "#fff" : "#555",
            border: `1px solid ${priorityFilter === "non-priority" ? "#008B92" : "#ddd"}`,
            borderRadius: 16,
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: priorityFilter === "non-priority" ? 600 : 400,
          }}
        >
          Обычные ({data.length - priorityCount})
        </button>
      </div>

      {/* Счётчик результатов */}
      {(filter || priorityFilter !== "all") && (
        <div style={{
          marginBottom: 16, padding: "10px 16px",
          background: "#f0f9fa", borderRadius: 8,
          fontSize: "0.9rem", color: "#006b70",
          fontWeight: 500,
        }}>
          Найдено: <strong>{filtered.length}</strong> из <strong>{data.length}</strong> записей
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        pagination
        paginationPerPage={25}
        paginationRowsPerPageOptions={[25, 50, 100]}
        highlightOnHover
        pointerOnHover
        defaultSortFieldId={5}
        defaultSortAsc={false}
        conditionalRowStyles={[{
          when: row => row.is_priority,
          style: {
            backgroundColor: "#e6f7f8",
            borderLeft: "4px solid #008B92",
          },
        }]}
        noDataComponent={<div style={{ padding: 40, color: "#999" }}>Нет данных</div>}
      />
    </div>
  );
};
import React, { useState, useMemo } from "react";
import DataTable, { type TableColumn } from "react-data-table-component";
import type { NpaProject } from "../../../api/monitoring/api";
import * as XLSX from "xlsx";

interface Props {
  data: NpaProject[];
}

const exportToExcel = (data: NpaProject[], filename: string) => {
  const exportData = data.map(row => ({
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
  // Формат: "17 июня 2026"
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

  const filtered = useMemo(() => {
    if (!filter) return data;
    const f = filter.toLowerCase();
    return data.filter(n =>
      (n.title || "").toLowerCase().includes(f) ||
      (n.id || "").toLowerCase().includes(f) ||
      (n.developer || "").toLowerCase().includes(f) ||
      (n.doc_type || "").toLowerCase().includes(f) ||
      (n.status || "").toLowerCase().includes(f)
    );
  }, [data, filter]);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <input
          type="text"
          placeholder="🔍 Поиск по названию, ID, разработчику, виду, статусу..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            flex: 1,
            padding: "12px 16px",
            border: "2px solid #e0e0e0",
            borderRadius: 10,
            fontSize: "0.95rem",
            boxSizing: "border-box",
          }}
          onFocus={e => e.target.style.borderColor = "#008B92"}
          onBlur={e => e.target.style.borderColor = "#e0e0e0"}
        />
        <button
          onClick={() => exportToExcel(filtered, "npa_export")}
          disabled={filtered.length === 0}
          style={{
            marginLeft: 12,
            padding: "12px 24px",
            background: filtered.length === 0 ? "#ccc" : "#217346",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: filtered.length === 0 ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "0.95rem",
          }}
        >
          📥 Экспорт в Excel
        </button>
      </div>

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
        noDataComponent={<div style={{ padding: 40, color: "#999" }}>Нет данных</div>}
      />
    </div>
  );
};
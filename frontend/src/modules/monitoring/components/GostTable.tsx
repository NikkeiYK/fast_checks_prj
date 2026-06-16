import React, { useState, useMemo } from "react";
import DataTable, { type TableColumn } from "react-data-table-component";
import type { GostNotification } from "../../../api/monitoring/api";
import * as XLSX from "xlsx";

interface Props {
  data: GostNotification[];
  isMyTk: (tk: string | null) => boolean;
}

const StatusBadge: React.FC<{ status: string | null }> = ({ status }) => {
  const map: Record<string, { bg: string; label: string }> = {
    "Вынесен на публичное обсуждение": { bg: "#008B92", label: "Публ. обсуждение" },
    "Публичное обсуждение завершено": { bg: "#95a5a6", label: "Завершено" },
    "Продлен срок публичного обсуждения": { bg: "#e67e22", label: "Продлено" },
    "На доработке": { bg: "#8e44ad", label: "Доработка" },
    "Направлено уведомление о завершении публичного обсуждения": { bg: "#01313D", label: "Уведомление" },
  };


  const s = map[status || ""] || { bg: "#6c757d", label: status || "—" };
  return (
    <span style={{
      background: s.bg, color: "#fff", padding: "3px 10px",
      borderRadius: 12, fontSize: "0.75rem", fontWeight: 500,
    }}>
      {s.label}
    </span>
  );
};

const exportToExcel = (data: GostNotification[], filename: string) => {
  const exportData = data.map(row => ({
    "Код ПРНС": row.prns_code || "",
    "Тип": row.doc_type || "",
    "Наименование проекта": row.project_name || "",
    "Технический комитет": row.technical_committee || "",
    "Разработчик": row.developer || "",
    "Начало": row.start_date || "",
    "Завершение": row.end_date || "",
    "Статус": row.status || "",
    "URL": row.url || "",
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ГОСТы");
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
};

export const GostTable: React.FC<Props> = ({ data, isMyTk }) => {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return data;
    const f = filter.toLowerCase();
    return data.filter(g =>
      (g.project_name || "").toLowerCase().includes(f) ||
      (g.prns_code || "").toLowerCase().includes(f) ||
      (g.technical_committee || "").toLowerCase().includes(f) ||
      (g.developer || "").toLowerCase().includes(f)
    );
  }, [data, filter]);

  

  const columns: TableColumn<GostNotification>[] = [
  { 
    name: "Код ПРНС", 
    selector: r => r.prns_code || "—", 
    width: "140px",
    sortable: true,  // ← ДОБАВИТЬ
    cell: r => <code style={{ fontSize: "0.8rem" }}>{r.prns_code || "—"}</code> 
  },
  { 
    name: "Тип", 
    selector: r => r.doc_type || "—", 
    width: "100px",
    sortable: true  // ← ДОБАВИТЬ
  },
  { 
    name: "Наименование проекта", 
    selector: r => r.project_name || "—", 
    grow: 2,
    sortable: true,  // ← ДОБАВИТЬ
    cell: r => (
      <a href={r.url || "#"} target="_blank" rel="noreferrer"
         style={{ color: "#006b70", textDecoration: "none", fontWeight: 500 }}>
        {r.project_name || "—"}
      </a>
    ) 
  },
  { 
    name: "Технический комитет", 
    selector: r => r.technical_committee || "—",
    sortable: true,  // ← ДОБАВИТЬ
    cell: r => (
      <span>
        {r.technical_committee || "—"}
        {isMyTk(r.technical_committee) && (
          <span style={{
            background: "#FC5A41", color: "#fff", fontSize: "0.65rem",
            padding: "2px 6px", borderRadius: 8, marginLeft: 6,
          }}>наш ТК</span>
        )}
      </span>
    ) 
  },
  { 
    name: "Разработчик", 
    selector: r => r.developer || "—", 
    width: "160px",
    sortable: true  // ← ДОБАВИТЬ
  },
  { 
    name: "Начало", 
    selector: r => r.start_date || "—", 
    width: "100px",
    sortable: true,  // ← ДОБАВИТЬ
    // Кастомная сортировка для дат
    sortFunction: (a, b) => {
      const parseDate = (d: string | null) => {
        if (!d) return 0;
        const parts = d.split(".");
        if (parts.length === 3) {
          return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
        }
        return 0;
      };
      return parseDate(a.start_date) - parseDate(b.start_date);
    }
  },
  { 
    name: "Завершение", 
    selector: r => r.end_date || "—", 
    width: "100px",
    sortable: true, 
    sortFunction: (a, b) => {
      const parseDate = (d: string | null) => {
        if (!d) return 0;
        const parts = d.split(".");
        if (parts.length === 3) {
          return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
        }
        return 0;
      };
      return parseDate(a.end_date) - parseDate(b.end_date);
    }
  },
  { 
    name: "Статус", 
    selector: r => r.status || "—", 
    width: "140px",
    sortable: true, 
    cell: r => <StatusBadge status={r.status} /> 
  },
];

  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: 20,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      <input
        type="text" placeholder="🔍 Поиск по названию, коду, ТК, разработчику..."
        value={filter} onChange={e => setFilter(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px", marginBottom: 16,
          border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box",
        }}
      />
      <button
    onClick={() => exportToExcel(filtered, "gost_export")}
    style={{
      marginLeft: 12,
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
      <DataTable
        columns={columns} data={filtered}
        pagination paginationPerPage={50}
        highlightOnHover
        defaultSortFieldId={6}  // ← сортировка по "Начало" (индекс колонки)
        defaultSortAsc={false} 
        conditionalRowStyles={[{
          when: row => isMyTk(row.technical_committee),
          style: { backgroundColor: "#e6f7f8", borderLeft: "3px solid #008B92" },
        }]}
        noDataComponent={<div style={{ padding: 40, color: "#999" }}>Нет данных</div>}
      />
    </div>
  );
};
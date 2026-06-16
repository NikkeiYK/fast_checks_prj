import React, { useState, useMemo } from "react";
import DataTable, { type TableColumn } from "react-data-table-component";
import type { SpNotification } from "../../../api/monitoring/api";
import * as XLSX from "xlsx";

interface Props { data: SpNotification[]; }

const exportToExcel = (data: SpNotification[], filename: string) => {
  const exportData = data.map(row => ({
    "Наименование": row.project_name || row.title || "",
    "Тип уведомления": row.notification_type || "",
    "Разработчик": row.developer || "",
    "Дата": row.placement_date || "",
    "URL": row.url || "",
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "СП");
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
};

export const SpTable: React.FC<Props> = ({ data }) => {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return data;
    const f = filter.toLowerCase();
    return data.filter(s =>
      (s.project_name || s.title || "").toLowerCase().includes(f) ||
      (s.developer || "").toLowerCase().includes(f)
    );
  }, [data, filter]);

  const columns: TableColumn<SpNotification>[] = [
  { 
    name: "Наименование", 
    selector: r => r.project_name || r.title || "—", 
    grow: 2,
    sortable: true,  // ← ДОБАВИТЬ
    cell: r => (
      <a href={r.url || "#"} target="_blank" rel="noreferrer"
         style={{ color: "#006b70", textDecoration: "none", fontWeight: 500 }}>
        {r.project_name || r.title || "—"}
      </a>
    ) 
  },
  { 
    name: "Тип уведомления", 
    selector: r => r.notification_type || "—", 
    width: "180px",
    sortable: true  
  },
  { 
    name: "Разработчик", 
    selector: r => r.developer || "—", 
    width: "180px",
    sortable: true  
  },
  { 
    name: "Дата", 
    selector: r => r.placement_date || "—", 
    width: "110px",
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
      return parseDate(a.placement_date) - parseDate(b.placement_date);
    }
  },
];


  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: 20,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      <input
        type="text" placeholder="🔍 Поиск..."
        value={filter} onChange={e => setFilter(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px", marginBottom: 16,
          border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box",
        }}
      />
      <button
    onClick={() => exportToExcel(filtered, "sp_export")}
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
        defaultSortFieldId={4}  // ← сортировка по "Дата"
        defaultSortAsc={false}  // ← по убыванию
        noDataComponent={<div style={{ padding: 40, color: "#999" }}>Нет данных</div>}
      />
    </div>
  );
};
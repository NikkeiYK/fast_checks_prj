import React, { useState, useMemo } from "react";
import DataTable, { type TableColumn } from "react-data-table-component";
import type { GostNotification } from "../../../api/monitoring/api";
import * as XLSX from "xlsx";

interface Props {
  data: GostNotification[];
  myTks: string[];
  isMyTk: (tk: string | null) => boolean;
}

const exportToExcel = (data: GostNotification[], filename: string) => {
  const exportData = data.map(row => ({
    "Код ПРНС": row.prns_code || "",
    "Наименование проекта": row.project_name || "",
    "Технический комитет": row.technical_committee || "",
    "Разработчик": row.developer || "",
    "Начало обсуждения": row.start_date || "",
    "Завершение обсуждения": row.end_date || "",
    "Статус": row.status || "",
    "URL": row.url || "",
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Наши ТК");
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
};

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
      background: s.bg, color: "#fff", padding: "4px 12px",
      borderRadius: 12, fontSize: "0.75rem", fontWeight: 600,
    }}>
      {s.label}
    </span>
  );
};

const parseDate = (d: string | null): number => {
  if (!d) return 0;
  const parts = d.split(".");
  if (parts.length === 3) {
    return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
  }
  return 0;
};

export const OurTkTable: React.FC<Props> = ({ data, myTks, isMyTk }) => {
  const [filter, setFilter] = useState("");
  
  const myData = useMemo(() => 
    data.filter(g => isMyTk(g.technical_committee)),
    [data, isMyTk]
  );

  const filteredData = useMemo(() => {
    if (!filter) return myData;
    const f = filter.toLowerCase();
    return myData.filter(g =>
      (g.project_name || "").toLowerCase().includes(f) ||
      (g.prns_code || "").toLowerCase().includes(f) ||
      (g.technical_committee || "").toLowerCase().includes(f) ||
      (g.developer || "").toLowerCase().includes(f) ||
      (g.status || "").toLowerCase().includes(f)
    );
  }, [myData, filter]);

  // Сводка по ТК
  const summary = useMemo(() => {
    const result: Record<string, { total: number; active: number }> = {};
    myData.forEach(g => {
      const tk = g.technical_committee || "Не указан";
      if (!result[tk]) result[tk] = { total: 0, active: 0 };
      result[tk].total++;
      if (g.status === "Вынесен на публичное обсуждение") result[tk].active++;
    });
    return result;
  }, [myData]);

  const columns: TableColumn<GostNotification>[] = [
    {
      name: "Код ПРНС",
      selector: r => r.prns_code || "—",
      width: "140px",
      sortable: true,
      cell: r => <code style={{ fontSize: "0.8rem", background: "#f0f0f0", padding: "2px 6px", borderRadius: 4 }}>{r.prns_code || "—"}</code>
    },
    {
      name: "Наименование проекта",
      selector: r => r.project_name || "—",
      grow: 2,
      sortable: true,
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
      width: "180px",
      sortable: true,
      cell: r => (
        <span style={{
          background: "#e6f7f8", color: "#006b70",
          padding: "4px 10px", borderRadius: 12,
          fontSize: "0.8rem", fontWeight: 600,
        }}>
          {r.technical_committee || "—"}
        </span>
      )
    },
    {
      name: "Разработчик",
      selector: r => r.developer || "—",
      width: "180px",
      sortable: true,
    },
    {
      name: "Начало",
      selector: r => r.start_date || "—",
      width: "110px",
      sortable: true,
      sortFunction: (a, b) => parseDate(a.start_date) - parseDate(b.start_date),
    },
    {
      name: "Завершение",
      selector: r => r.end_date || "—",
      width: "110px",
      sortable: true,
      sortFunction: (a, b) => parseDate(a.end_date) - parseDate(b.end_date),
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
    <div>
      {/* Заголовок с общим числом ТК */}
<div style={{
  borderRadius: 12, padding: "16px 20px", marginBottom: 20,
  background: "#fff",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
}}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
    <div>
      <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 600, color: "#01313D" }}>
        Участвуем в технических комитетах
      </h2>
      <div style={{ marginTop: 8, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.95rem", color: "#555" }}>
          📋 Всего ТК: <strong style={{ color: "#008B92" }}>{myTks.length}</strong>
        </span>
        <span style={{ fontSize: "0.95rem", color: "#555" }}>
          📄 ГОСТов: <strong style={{ color: "#008B92" }}>{myData.length}</strong>
        </span>
        <span style={{ fontSize: "0.95rem", color: "#555" }}>
          ✅ Активных: <strong style={{ color: "#008B92" }}>{Object.values(summary).reduce((sum, s) => sum + s.active, 0)}</strong>
        </span>
      </div>
    </div>
  </div>
</div>

      {/* Список ТК */}
      {myTks.length > 0 && (
        <div style={{
          background: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}>
          <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: 12, fontWeight: 500 }}>
            Наши технические комитеты:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {myTks.map(tk => (
              <span key={tk} style={{
                background: "linear-gradient(135deg, #e6f7f8 0%, #d4f1f4 100%)",
                color: "#006b70", padding: "6px 14px",
                borderRadius: 20, fontSize: "0.85rem",
                fontWeight: 600, border: "1px solid #b8e0e3",
              }}>
                {tk}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Сводка по ТК */}
      {Object.keys(summary).length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16, marginBottom: 20,
        }}>
          {Object.entries(summary).sort().map(([tk, s]) => (
            <div key={tk} style={{
              background: "#fff", borderRadius: 12, padding: "18px 20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #008B92",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
            }}
            >
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#01313D", marginBottom: 12 }}>
                {tk}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  background: "#008B92", color: "#fff",
                  padding: "6px 14px", borderRadius: 8,
                  fontSize: "0.9rem", fontWeight: 700,
                }}>
                  {s.active} активных
                </div>
                <div style={{ color: "#888", fontSize: "0.9rem" }}>
                  из {s.total} всего
                </div>
              </div>
              <div style={{
                marginTop: 10,
                background: "#f0f0f0", borderRadius: 6,
                height: 6, overflow: "hidden",
              }}>
                <div style={{
                  width: `${(s.active / s.total) * 100}%`,
                  background: "linear-gradient(90deg, #008B92 0%, #01313D 100%)",
                  height: "100%",
                  transition: "width 0.3s",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Таблица */}
      <div style={{
        background: "#fff", borderRadius: 12, padding: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}>
        {/* Поиск и экспорт */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 20, gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <input
              type="text"
              placeholder="🔍 Поиск по проекту, коду, ТК, разработчику, статусу..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                width: "100%", padding: "12px 16px",
                border: "2px solid #e0e0e0", borderRadius: 10,
                fontSize: "0.95rem", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "#008B92"}
              onBlur={e => e.target.style.borderColor = "#e0e0e0"}
            />
          </div>
          <button
            onClick={() => exportToExcel(filteredData, "our_tk_export")}
            disabled={filteredData.length === 0}
            style={{
              padding: "12px 24px",
              background: filteredData.length === 0 ? "#ccc" : "#217346",
              color: "#fff", border: "none", borderRadius: 10,
              cursor: filteredData.length === 0 ? "not-allowed" : "pointer",
              fontWeight: 600, fontSize: "0.95rem",
              display: "flex", alignItems: "center", gap: 8,
              transition: "background 0.2s",
            }}
            onMouseEnter={e => {
              if (filteredData.length > 0) e.currentTarget.style.background = "#1e5f3a";
            }}
            onMouseLeave={e => {
              if (filteredData.length > 0) e.currentTarget.style.background = "#217346";
            }}
          >
            📥 Экспорт в Excel
          </button>
        </div>

        {/* Счётчик результатов */}
        {filter && (
          <div style={{
            marginBottom: 16, padding: "10px 16px",
            background: "#f0f9fa", borderRadius: 8,
            fontSize: "0.9rem", color: "#006b70",
            fontWeight: 500,
          }}>
            Найдено: <strong>{filteredData.length}</strong> из <strong>{myData.length}</strong> записей
          </div>
        )}

        <DataTable
          columns={columns}
          data={filteredData}
          pagination
          paginationPerPage={25}
          paginationRowsPerPageOptions={[25, 50, 100]}
          highlightOnHover
          pointerOnHover
          defaultSortFieldId={5}
          defaultSortAsc={false}
          conditionalRowStyles={[{
            when: row => row.status === "Вынесен на публичное обсуждение",
            style: { 
              backgroundColor: "#f0f9fa",
              borderLeft: "4px solid #008B92",
            },
          }]}
          noDataComponent={
            <div style={{ padding: 60, textAlign: "center", color: "#999" }}>
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>📋</div>
              {myTks.length === 0
                ? "Добавьте ваши ТК в конфигурацию (OUR_TECHNICAL_COMMITTEES в config.py)"
                : filter
                  ? "По вашему запросу ничего не найдено"
                  : "Нет ГОСТов для ваших технических комитетов"}
            </div>
          }
        />
      </div>
    </div>
  );
};
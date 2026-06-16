import React from "react";
import DataTable from "react-data-table-component";
import type { TableColumn } from "react-data-table-component";
import type { ScrapingResult, GostNotification, SpNotification } from "../../../api/monitoring/api";

interface DiffWidgetProps {
  gostData: GostNotification[];
  spData: SpNotification[];
  isMyTk: (tk: string | null) => boolean;
  lastScrapeResult: ScrapingResult | null;  // ← НОВЫЙ PROP
}

// ── Бейдж статуса ГОСТ ─────────────────────────────────────
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

const parseDate = (d: string | null): number => {
  if (!d) return 0;
  const parts = d.split(".");
  if (parts.length === 3) {
    return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
  }
  return 0;
};

export const DiffWidget: React.FC<DiffWidgetProps> = ({ 
  gostData, 
  spData, 
  isMyTk,
  lastScrapeResult,  // ← ИСПОЛЬЗУЕМ переданные данные
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const [subTab, setSubTab] = React.useState<"gost" | "sp" | "changes">("gost");

  // Используем данные из последнего скрапинга ИЛИ загружаем из API (фоллбэк)
  const log = lastScrapeResult ? {
    gost_new: lastScrapeResult.gost_new,
    sp_new: lastScrapeResult.sp_new,
    new_gost_ids: lastScrapeResult.new_gost_ids,
    new_sp_ids: lastScrapeResult.new_sp_ids,
    updated_statuses: lastScrapeResult.updated_statuses,
    finished_at: new Date().toISOString(),  // текущее время
  } : null;

  // Фильтруем новые ГОСТы и СП из общих данных
  const newGosts = React.useMemo(() => {
    if (!log?.new_gost_ids?.length) return [];
    const idSet = new Set(log.new_gost_ids);
    return gostData.filter(g => idSet.has(g.id));
  }, [log, gostData]);

  const newSps = React.useMemo(() => {
    if (!log?.new_sp_ids?.length) return [];
    const idSet = new Set(log.new_sp_ids);
    return spData.filter(s => idSet.has(s.id));
  }, [log, spData]);

  const hasChanges = (log?.gost_new ?? 0) > 0 || (log?.sp_new ?? 0) > 0 || (log?.updated_statuses?.length ?? 0) > 0;

  if (!log || !hasChanges) {
    return null;
  }

  const finishedDate = new Date().toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  // ── Колонки для новых ГОСТов ─────────────────────────────
  const gostColumns: TableColumn<GostNotification>[] = [
    {
      name: "Код ПРНС",
      selector: r => r.prns_code || "—",
      width: "140px",
      sortable: true,
      cell: r => <code style={{ fontSize: "0.8rem" }}>{r.prns_code || "—"}</code>
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
      sortable: true,
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
      sortable: true
    },
    {
      name: "Начало",
      selector: r => r.start_date || "—",
      width: "100px",
      sortable: true,
      sortFunction: (a, b) => parseDate(a.start_date) - parseDate(b.start_date)
    },
    {
      name: "Статус",
      selector: r => r.status || "—",
      width: "140px",
      sortable: true,
      cell: r => <StatusBadge status={r.status} />
    },
  ];

  // ── Колонки для новых СП ─────────────────────────────────
  const spColumns: TableColumn<SpNotification>[] = [
    {
      name: "Наименование",
      selector: r => r.project_name || r.title || "—",
      grow: 2,
      sortable: true,
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
      sortFunction: (a, b) => parseDate(a.placement_date) - parseDate(b.placement_date)
    },
  ];

  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      padding: 0,
      marginBottom: 20,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      borderLeft: "4px solid #008B92",
      overflow: "hidden",
    }}>
      {/* Заголовок — кликабельный */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "16px 20px",
          cursor: "pointer",
          background: "linear-gradient(90deg, #f0f9fa 0%, #ffffff 100%)",
          borderBottom: expanded ? "1px solid #eee" : "none",
          transition: "background 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "linear-gradient(90deg, #e6f7f8 0%, #ffffff 100%)")}
        onMouseLeave={e => (e.currentTarget.style.background = "linear-gradient(90deg, #f0f9fa 0%, #ffffff 100%)")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "#01313D" }}>
                📊 Результаты последнего обновления
              </span>
              <span style={{
                fontSize: "0.8rem",
                color: "#666",
                background: "#f0f0f0",
                padding: "2px 8px",
                borderRadius: 10,
              }}>
                {finishedDate}
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(log.gost_new ?? 0) > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#e8f5e9", color: "#2e7d32",
                  padding: "4px 12px", borderRadius: 16, fontSize: "0.85rem", fontWeight: 600,
                }}>
                  <span style={{ fontSize: "1rem" }}>✨</span>
                  +{log.gost_new} новых ГОСТ
                </div>
              )}
              {(log.sp_new ?? 0) > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#e8f5e9", color: "#2e7d32",
                  padding: "4px 12px", borderRadius: 16, fontSize: "0.85rem", fontWeight: 600,
                }}>
                  <span style={{ fontSize: "1rem" }}>✨</span>
                  +{log.sp_new} новых СП
                </div>
              )}
              {(log.updated_statuses?.length ?? 0) > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#fff3e0", color: "#e65100",
                  padding: "4px 12px", borderRadius: 16, fontSize: "0.85rem", fontWeight: 600,
                }}>
                  <span style={{ fontSize: "1rem" }}>🔄</span>
                  {log.updated_statuses!.length} изменённых статусов
                </div>
              )}
            </div>
          </div>
          <div style={{
            color: "#008B92",
            fontSize: "0.9rem",
            fontWeight: 500,
            marginLeft: 16,
            transition: "transform 0.3s",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}>
            ▼
          </div>
        </div>
      </div>

      {/* Раскрывающийся контент */}
      {expanded && (
        <div style={{ padding: "16px 20px" }}>
          {/* Подвкладки */}
          <div style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            borderBottom: "1px solid #eee",
          }}>
            {(log.gost_new ?? 0) > 0 && (
              <button
                onClick={() => setSubTab("gost")}
                style={{
                  padding: "8px 16px",
                  background: subTab === "gost" ? "#008B92" : "transparent",
                  color: subTab === "gost" ? "#fff" : "#555",
                  border: "none",
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: subTab === "gost" ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                ✨ Новые ГОСТы ({log.gost_new})
              </button>
            )}
            {(log.sp_new ?? 0) > 0 && (
              <button
                onClick={() => setSubTab("sp")}
                style={{
                  padding: "8px 16px",
                  background: subTab === "sp" ? "#008B92" : "transparent",
                  color: subTab === "sp" ? "#fff" : "#555",
                  border: "none",
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: subTab === "sp" ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                ✨ Новые СП ({log.sp_new})
              </button>
            )}
            {(log.updated_statuses?.length ?? 0) > 0 && (
              <button
                onClick={() => setSubTab("changes")}
                style={{
                  padding: "8px 16px",
                  background: subTab === "changes" ? "#e65100" : "transparent",
                  color: subTab === "changes" ? "#fff" : "#555",
                  border: "none",
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: subTab === "changes" ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                🔄 Изменённые статусы ({log.updated_statuses!.length})
              </button>
            )}
          </div>

          {/* Контент подвкладок */}
          {subTab === "gost" && newGosts.length > 0 && (
            <div style={{
              background: "#fafbfc",
              borderRadius: 8,
              padding: 12,
              border: "1px solid #eee",
            }}>
              <div style={{
                background: "#e8f5e9",
                color: "#2e7d32",
                padding: "8px 12px",
                borderRadius: 6,
                marginBottom: 12,
                fontSize: "0.85rem",
                fontWeight: 500,
              }}>
                💡 Добавлено {newGosts.length} новых ГОСТов в последнем обновлении
              </div>
              <DataTable
                columns={gostColumns}
                data={newGosts}
                pagination
                paginationPerPage={10}
                highlightOnHover
                defaultSortFieldId={5}
                defaultSortAsc={false}
                conditionalRowStyles={[{
                  when: row => isMyTk(row.technical_committee),
                  style: { backgroundColor: "#e6f7f8", borderLeft: "3px solid #008B92" },
                }]}
                noDataComponent={<div style={{ padding: 20, color: "#999" }}>Нет данных</div>}
              />
            </div>
          )}

          {subTab === "sp" && newSps.length > 0 && (
            <div style={{
              background: "#fafbfc",
              borderRadius: 8,
              padding: 12,
              border: "1px solid #eee",
            }}>
              <div style={{
                background: "#e8f5e9",
                color: "#2e7d32",
                padding: "8px 12px",
                borderRadius: 6,
                marginBottom: 12,
                fontSize: "0.85rem",
                fontWeight: 500,
              }}>
                💡 Добавлено {newSps.length} новых сводов правил в последнем обновлении
              </div>
              <DataTable
                columns={spColumns}
                data={newSps}
                pagination
                paginationPerPage={10}
                highlightOnHover
                defaultSortFieldId={4}
                defaultSortAsc={false}
                noDataComponent={<div style={{ padding: 20, color: "#999" }}>Нет данных</div>}
              />
            </div>
          )}

          {subTab === "changes" && log.updated_statuses && log.updated_statuses.length > 0 && (
            <div style={{
              background: "#fafbfc",
              borderRadius: 8,
              padding: 16,
              border: "1px solid #eee",
            }}>
              <div style={{
                background: "#fff3e0",
                color: "#e65100",
                padding: "8px 12px",
                borderRadius: 6,
                marginBottom: 12,
                fontSize: "0.85rem",
                fontWeight: 500,
              }}>
                💡 В {log.updated_statuses.length} документах изменился статус
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {log.updated_statuses.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#fff",
                      borderRadius: 8,
                      padding: "12px 16px",
                      border: "1px solid #ffe0b2",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        background: item.type === "gost" ? "#008B92" : "#01313D",
                        color: "#fff",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}>
                        {item.type === "gost" ? "ГОСТ" : "СП"}
                      </span>
                      <span style={{
                        color: "#333",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        flex: 1,
                      }}>
                        {item.title}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <StatusBadge status={item.old_status} />
                      <span style={{ color: "#999", fontSize: "1.2rem" }}>→</span>
                      <StatusBadge status={item.new_status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
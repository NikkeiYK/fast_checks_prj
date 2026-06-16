import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { monitoringApi, type DashboardResponse, type ScrapingResult } from "../../api/monitoring/api";
import { StatsCards } from "./components/StatsCard";
import { GostTable } from "./components/GostTable";
import { SpTable } from "./components/SpTable";
import { OurTkTable } from "./components/OurTkTable";
import { TkChart } from "./components/TkChart";
import { PolymerChart } from "./components/PolymerChart";
import { DiffWidget } from "./components/DiffWidget";
import { OurTkVsAllChart } from "./components/OurTKVsAllChart";
import { ProfiledGostChart } from "./components/ProfiledGostChart";

export const MonitoringDashboard: React.FC = () => {
  const { isAuthenticated, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "gost" | "sp" | "tks">("overview");
  const [error, setError] = useState("");
  const [lastScrapeResult, setLastScrapeResult] = useState<ScrapingResult | null>(null);
  
  // ← НОВОЕ: состояние для фильтра из графиков
  const [chartFilter, setChartFilter] = useState<{
    type: "tk" | "status" | "polymer" | "our_tk";
    value: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const d = await monitoringApi.getDashboard();
      setData(d);
      setError("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, loadData]);

  const handleScrape = async () => {
    if (!hasPermission("monitoring:scrape") && !hasPermission("admin:dashboard")) {
      alert("Недостаточно прав для запуска скрапинга");
      return;
    }
    setScraping(true);
    try {
      const res = await monitoringApi.runScraping({ 
        fullBackfill: true,
        userRole: hasPermission("admin:dashboard") ? "admin" : undefined,
      });
      setLastScrapeResult(res);
      alert(res.message);
      await loadData();
    } catch (err: any) {
      alert("Ошибка: " + err.message);
    } finally {
      setScraping(false);
    }
  };

  // ← НОВЫЕ: обработчики кликов на графиках
  const handleChartClick = useCallback((type: "tk" | "status" | "polymer" | "our_tk", value: string) => {
    setChartFilter({ type, value });
    if (type === "our_tk") {
      setActiveTab("tks");
    } else {
      setActiveTab("gost");
    }
  }, []);

  const clearChartFilter = useCallback(() => {
    setChartFilter(null);
  }, []);

  // ← НОВОЕ: фильтрация данных на основе клика по графику
  const filteredGostData = useMemo(() => {
    if (!data || !chartFilter) return data?.gost || [];
    
    switch (chartFilter.type) {
      case "tk":
        return data.gost.filter(g => 
          g.technical_committee?.toLowerCase().includes(chartFilter.value.toLowerCase())
        );
      case "status":
        return data.gost.filter(g => g.status === chartFilter.value);
      case "polymer":
        return data.gost.filter(g => g.is_polymer);
      case "our_tk":
        return data.gost.filter(g => 
          g.technical_committee && data.my_tks.some(m => 
            g.technical_committee!.toLowerCase().includes(m.toLowerCase())
          )
        );
      default:
        return data.gost;
    }
  }, [data, chartFilter]);

  if (!isAuthenticated) return null;

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "#666" }}>
        <div style={{
          width: 40, height: 40, border: "3px solid #eee", borderTopColor: "#008B92",
          borderRadius: "50%", margin: "0 auto 16px",
          animation: "spin 1s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p>Загрузка данных мониторинга...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#c0392b" }}>
        {error || "Нет данных"}
        <button onClick={loadData} style={{ marginLeft: 16 }}>Повторить</button>
      </div>
    );
  }

  const isMyTk = (tk: string | null) =>
    !!tk && data.my_tks.some(m => tk.toLowerCase().includes(m.toLowerCase()));

  const canScrape = hasPermission("monitoring:scrape") || hasPermission("admin:dashboard");

  const tabs = [
    { key: "overview" as const, label: "Обзор" },
    { key: "gost" as const, label: `ГОСТы (${data.stats.total_gost})` },
    { key: "sp" as const, label: `Своды правил (${data.stats.total_sp})` },
    { key: "tks" as const, label: "Участвуем в ТК" },
  ];

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #008B92 0%, #01313D 100%)",
        color: "#fff", padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 600 }}>
              Мониторинг Росстандарта {data.current_year}
            </h1>
            <div style={{ opacity: 0.9, fontSize: "0.9rem", marginTop: 4 }}>
              Система отслеживания новых ГОСТов и сводов правил
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>
              Обновлено: {data.last_updated}
            </span>
            {canScrape && (
              <button
                onClick={handleScrape} disabled={scraping}
                style={{
                  padding: "8px 16px",
                  background: scraping ? "#95a5a6" : "rgba(255,255,255,0.15)",
                  color: "#fff", border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 8, cursor: scraping ? "not-allowed" : "pointer",
                  fontWeight: 500,
                }}
              >
                {scraping ? "⏳ Обновление..." : "🔄 Обновить данные"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 24px" }}>
        <DiffWidget 
          gostData={data.gost} 
          spData={data.sp} 
          isMyTk={isMyTk}
          lastScrapeResult={lastScrapeResult}
        />

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 0,
          borderBottom: "2px solid #ddd", marginBottom: 20,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                clearChartFilter(); // Сбрасываем фильтр при переключении вкладок
              }}
              style={{
                padding: "12px 24px", background: "none", border: "none",
                borderBottom: activeTab === tab.key
                  ? "3px solid #008B92"
                  : "3px solid transparent",
                color: activeTab === tab.key ? "#01313D" : "#555",
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: "pointer", fontSize: 15,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "overview" && (
          <div>
            <StatsCards stats={data.stats} currentYear={data.current_year} />
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr",
              gap: 20, marginTop: 20,
            }}>
              <div style={{
                background: "#fff", borderRadius: 12, padding: 20,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}>
                <h6 style={{ textAlign: "center", color: "#666", marginBottom: 12 }}>
                  Разбивка ГОСТов по техническим комитетам
                </h6>
                <TkChart
                  labels={data.stats.all_tk_labels}
                  values={data.stats.all_tk_values}
                  myTks={data.my_tks}
                  onBarClick={(tk) => handleChartClick("tk", tk)}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{
                  background: "#fff", borderRadius: 12, padding: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}>
                  <h6 style={{ textAlign: "center", color: "#666", fontSize: "0.8rem", marginBottom: 8 }}>
                    Участвуем в ТК vs все ГОСТы
                  </h6>
                  <div style={{ maxWidth: 220, margin: "0 auto" }}>
                    <OurTkVsAllChart
                      gostData={data.gost}
                      myTks={data.my_tks}
                      isMyTk={isMyTk}
                      onSegmentClick={(segment) => {
                        if (segment === "our") {
                          handleChartClick("our_tk", "our");
                        } else {
                          handleChartClick("tk", "other");
                        }
                      }}
                    />
                  </div>
                </div>
                
                <div style={{
                  background: "#fff", borderRadius: 12, padding: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}>
                  <h6 style={{ textAlign: "center", color: "#666", fontSize: "0.8rem", marginBottom: 8 }}>
                    Разбивка «профильных» ГОСТов по ТК
                  </h6>
                  <div style={{ maxWidth: 220, margin: "0 auto" }}>
                    <ProfiledGostChart
                      gostData={data.gost}
                      myTks={data.my_tks}
                      isMyTk={isMyTk}
                      onSegmentClick={(tk) => handleChartClick("tk", tk)}
                    />
                  </div>
                </div>
                
                <div style={{
                  background: "#fff", borderRadius: 12, padding: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}>
                  <h6 style={{ textAlign: "center", color: "#666", fontSize: "0.8rem", marginBottom: 8 }}>
                    Полимерные ГОСТы
                  </h6>
                  <PolymerChart
                    total={data.stats.polymer_total}
                    commented={data.stats.polymer_commented}
                    onClick={() => handleChartClick("polymer", "polymer")}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "gost" && (
          <div>
            {/* ← НОВОЕ: индикатор активного фильтра */}
            {chartFilter && (
              <div style={{
                background: "#fff3e0",
                border: "2px solid #ff9800",
                borderRadius: 12,
                padding: "12px 20px",
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div style={{ color: "#e65100", fontWeight: 500 }}>
                  🔍 Фильтр активен:{" "}
                  <strong>
                    {chartFilter.type === "tk" && `ТК: ${chartFilter.value}`}
                    {chartFilter.type === "status" && `Статус: ${chartFilter.value}`}
                    {chartFilter.type === "polymer" && "Полимерные ГОСТы"}
                    {chartFilter.type === "our_tk" && "Наши ТК"}
                  </strong>
                  {" "}({filteredGostData.length} записей)
                </div>
                <button
                  onClick={clearChartFilter}
                  style={{
                    padding: "6px 16px",
                    background: "#ff9800",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ✕ Сбросить фильтр
                </button>
              </div>
            )}
            <GostTable data={filteredGostData} isMyTk={isMyTk} />
          </div>
        )}
        {activeTab === "sp" && <SpTable data={data.sp} />}
        {activeTab === "tks" && (
          <OurTkTable data={data.gost} myTks={data.my_tks} isMyTk={isMyTk} />
        )}
      </div>
    </div>
  );
};
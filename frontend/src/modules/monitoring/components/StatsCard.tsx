import React from "react";
import type { DashboardStats } from "../../../api/monitoring/api";

interface Props { stats: DashboardStats; currentYear: number; }

const Card: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => (
  <div style={{
    background: "#fff", borderRadius: 12, padding: 20, textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)", borderTop: `3px solid ${color}`,
  }}>
    <div style={{ fontSize: "2.2rem", fontWeight: 700, color }}>{value}</div>
    <div style={{ color: "#556", fontSize: "0.85rem", marginTop: 4 }}>{label}</div>
  </div>
);

export const StatsCards: React.FC<Props> = ({ stats, currentYear }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
    <Card value={stats.total_gost} label={`ГОСТов в ${currentYear}`} color="#008B92" />
    <Card value={stats.total_sp} label="Сводов правил" color="#01313D" />
    <Card value={stats.active_count} label="Активных обсуждений" color="#008B92" />
    <Card value={stats.completed_count} label="Завершённых" color="#95a5a6" />
  </div>
);
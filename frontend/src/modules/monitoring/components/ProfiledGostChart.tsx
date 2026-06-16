import React, { useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { GostNotification } from "../../../api/monitoring/api";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface Props {
  gostData: GostNotification[];
  myTks: string[];
  isMyTk: (tk: string | null) => boolean;
  onSegmentClick?: (tk: string) => void;
}

const TK_PALETTE = [
  "#008B92", "#FC5A41", "#01313D", "#2ecc71", "#e67e22",
  "#9b59b6", "#3498db", "#e74c3c", "#1abc9c", "#f39c12",
  "#d35400", "#8e44ad", "#16a085", "#c0392b", "#27ae60",
  "#2980b9", "#f1c40f", "#7f8c8d", "#2c3e50", "#1dd1a1",
];

export const ProfiledGostChart: React.FC<Props> = ({ gostData, myTks, isMyTk, onSegmentClick }) => {
  useEffect(() => {
    console.log("📊 ProfiledGostChart - myTks:", myTks);
    const myGosts = gostData.filter(g => isMyTk(g.technical_committee));
    console.log("📊 ProfiledGostChart - my ГОСТы count:", myGosts.length);
  }, [gostData, myTks, isMyTk]);

  if (myTks.length === 0 && gostData.length === 0) {
    return null;
  }

  const myGosts = myTks.length > 0 
    ? gostData.filter(g => isMyTk(g.technical_committee))
    : gostData;
  
  const byTk: Record<string, number> = {};
  myGosts.forEach(g => {
    const tk = g.technical_committee || "Не указан";
    byTk[tk] = (byTk[tk] || 0) + 1;
  });

  const sorted = Object.entries(byTk).sort((a, b) => b[1] - a[1]);
  
  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "#999" }}>
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
        <div style={{ fontSize: "0.85rem" }}>
          {myTks.length === 0 ? "ТК не настроены" : "Нет ГОСТов в ваших ТК"}
        </div>
      </div>
    );
  }

  const labels = sorted.map(([tk, count]) => `${tk} (${count})`);
  const values = sorted.map(([, count]) => count);
  const tkNames = sorted.map(([tk]) => tk);

  const chartData = {
    labels: labels.map(l => l.length > 35 ? l.substring(0, 32) + "..." : l),
    datasets: [{
      data: values,
      backgroundColor: labels.map((_, i) => TK_PALETTE[i % TK_PALETTE.length]),
      borderWidth: 0,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    onClick: (_: any, elements: any[]) => {
      if (elements.length > 0 && onSegmentClick) {
        const index = elements[0].index;
        const tk = tkNames[index];
        onSegmentClick(tk);
      }
    },
    onHover: (event: any, elements: any[]) => {
      const target = event.native?.target;
      if (target) {
        target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    },
    plugins: {
      legend: { 
        position: "bottom" as const, 
        labels: { 
          font: { size: 8 }, 
          boxWidth: 8, 
          padding: 4,
        } 
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
            return `${ctx.parsed} (${pct}%)`;
          }
        }
      },
      datalabels: {
        color: "#fff",
        font: { size: 10, weight: 600 },
        formatter: (value: number) => value,
        display: (ctx: any) => ctx.dataset.data[ctx.dataIndex] >= 2,
      },
    },
  };

  return <Doughnut data={chartData} options={options} plugins={[ChartDataLabels]} />;
};
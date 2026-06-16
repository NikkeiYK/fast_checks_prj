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
  onSegmentClick?: (segment: "our" | "other") => void;
}

export const OurTkVsAllChart: React.FC<Props> = ({ gostData, myTks, isMyTk, onSegmentClick }) => {
  useEffect(() => {
    console.log("📊 OurTkVsAllChart - myTks:", myTks);
    console.log("📊 OurTkVsAllChart - gostData length:", gostData.length);
    const myCount = gostData.filter(g => isMyTk(g.technical_committee)).length;
    console.log("📊 OurTkVsAllChart - my ТК count:", myCount);
  }, [gostData, myTks, isMyTk]);

  const myTkCount = gostData.filter(g => isMyTk(g.technical_committee)).length;
  const otherCount = gostData.length - myTkCount;
  
  if (myTks.length === 0 && gostData.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "#999" }}>
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
        <div style={{ fontSize: "0.85rem" }}>
          ТК не настроены<br />
          <span style={{ fontSize: "0.75rem", color: "#666" }}>
            Добавьте ваши ТК для отображения статистики
          </span>
        </div>
      </div>
    );
  }

  const labels = myTks.length > 0 
    ? [`Участвуем в ТК (${myTkCount})`, `Остальные ТК (${otherCount})`]
    : [`Все ГОСТы (${gostData.length})`];
  
  const values = myTks.length > 0 
    ? [myTkCount, otherCount]
    : [gostData.length];
  
  const colors = myTks.length > 0
    ? ["#FC5A41", "#008B92"]
    : ["#008B92"];

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderWidth: 0,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    onClick: (_: any, elements: any[]) => {
      if (elements.length > 0 && onSegmentClick) {
        const index = elements[0].index;
        if (myTks.length > 0) {
          onSegmentClick(index === 0 ? "our" : "other");
        }
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
          font: { size: 9 }, 
          boxWidth: 10, 
          padding: 6,
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
        font: { size: 11, weight: 600 },
        formatter: (value: number, ctx: any) => {
          const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
          const pct = total > 0 ? Math.round(value / total * 100) : 0;
          return `${value}\n(${pct}%)`;
        },
        textAlign: "center" as const,
      },
    },
  };

  return <Doughnut data={chartData} options={options} plugins={[ChartDataLabels]} />;
};
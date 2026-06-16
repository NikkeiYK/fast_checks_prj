import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface Props { 
  total: number; 
  commented: number;
  onClick?: () => void;
}

export const PolymerChart: React.FC<Props> = ({ total, commented, onClick }) => {
  if (total === 0) {
    return (
      <div style={{ textAlign: "center", padding: 30, color: "#999" }}>
        <div style={{ fontSize: "2rem" }}>📋</div>
        <strong>Полимерных ГОСТов пока нет</strong>
      </div>
    );
  }

  const noComment = total - commented;
  const data = {
    labels: [`Комментарий направлен (${commented})`, `Без комментария (${noComment})`],
    datasets: [{
      data: [commented, noComment],
      backgroundColor: ["#2ecc71", "#e67e22"],
    }],
  };

  const options = {
    responsive: true,
    onClick: (_: any, elements: any[]) => {
      if (elements.length > 0 && onClick) {
        onClick();
      }
    },
    onHover: (event: any, elements: any[]) => {
      const target = event.native?.target;
      if (target) {
        target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    },
    plugins: {
      legend: { position: "bottom" as const, labels: { font: { size: 10 }, boxWidth: 10 } },
      datalabels: {
        color: "#fff", font: { size: 12, weight: 600 },
        formatter: (value: number, ctx: any) => {
          const t = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
          const pct = t > 0 ? Math.round(value / t * 100) : 0;
          return `${value}\n(${pct}%)`;
        },
        textAlign: "center" as const,
      },
    },
  };

  return (
    <div style={{ maxWidth: 220, margin: "0 auto" }}>
      <Doughnut data={data} options={options} plugins={[ChartDataLabels]} />
    </div>
  );
};
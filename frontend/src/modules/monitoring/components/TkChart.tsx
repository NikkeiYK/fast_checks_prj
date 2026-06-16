import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

interface Props {
  labels: string[];
  values: number[];
  myTks: string[];
  onBarClick?: (tk: string) => void;
}

export const TkChart: React.FC<Props> = ({ labels, values, myTks, onBarClick }) => {
  if (!labels.length) {
    return <div style={{ textAlign: "center", padding: 40, color: "#999" }}>Нет данных</div>;
  }

  const maxVal = Math.max(...values, 1);

  const data = {
    labels,
    datasets: [{
      label: "Уведомлений",
      data: values,
      backgroundColor: labels.map(tk =>
        myTks.some(m => tk.toLowerCase().includes(m.toLowerCase())) ? "#FC5A41" : "#008B92"
      ),
      borderRadius: 4,
    }],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_: any, elements: any[]) => {
      if (elements.length > 0 && onBarClick) {
        const index = elements[0].index;
        const tk = labels[index];
        onBarClick(tk);
      }
    },
    onHover: (event: any, elements: any[]) => {
      const target = event.native?.target;
      if (target) {
        target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    },
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: "end" as const, 
        align: "right" as const, 
        offset: 8,
        color: "#01313D", 
        font: { size: 11, weight: 600 },
        formatter: (v: number) => v,
      },
    },
    scales: {
      x: { 
        beginAtZero: true, 
        suggestedMax: maxVal * 1.15, 
        ticks: { stepSize: 1 } 
      },
      y: { 
        ticks: { font: { size: 11 } } 
      },
    },
  };

  return (
    <div style={{ height: Math.max(400, labels.length * 28) }}>
      <Bar data={data} options={options} plugins={[ChartDataLabels]} />
    </div>
  );
};
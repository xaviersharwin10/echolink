// src/components/ChartRenderer.tsx

import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ChartData {
  type: 'bar';
  title: string;
  labels: string[];
  data: number[];
}

interface ChartRendererProps {
  chartData: ChartData;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({ chartData }) => {
  const data = {
    labels: chartData.labels,
    datasets: [
      {
        label: chartData.title,
        data: chartData.data,
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: chartData.title,
        font: { size: 16 },
      },
    },
  };

  if (chartData.type === 'bar') {
    return <Bar options={options} data={data} />;
  }

  return null;
};
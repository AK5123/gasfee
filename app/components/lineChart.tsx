import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line, Chart } from 'react-chartjs-2';

import { BlockBaseGasProps } from '../page';

interface ScatterChartProps  {
    points : BlockBaseGasProps[]
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export default function LineChart({points}:ScatterChartProps) {
  // Extract x and y values from the data array
  const chartData = {
    labels: points.map((point) => `Block No : ${point.id}`),
    datasets: [      
      {        
        fill: true,
        label: "gwei",
        data: points.map((point) => {if(point.baseGas) return Number(point.baseGas.substring(0,point.baseGas.indexOf('.'))) }),
        timeStamp: points.map((point) => point.timestamp),
        borderColor: 'rgb(101, 71, 192,0.8)',
        backgroundColor: 'rgb(101, 71, 192,0.4)',
        pointRadius: 2
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    scales: {
      x: {
        ticks: {
          display: false
        }
      },
      y:{
        beginAtZero: true,
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        intersect: false,
        callbacks: {
          footer: (tooltipItems:any) =>  {
            let timestamp = tooltipItems[0].dataset.timeStamp[tooltipItems[0].parsed.x];
            return `Timestamp : ${new Date(timestamp*1000).toLocaleString()}`
          }
        }
      }
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <div style={{width: "100%", marginTop: "30px"}}>
      <Line data={chartData}  options={chartOptions} />
    </div>
  );
}


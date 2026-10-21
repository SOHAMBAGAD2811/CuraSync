"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface DayAdherence {
  day: string;
  taken: number;
  late: number;
  missed: number;
}

export function AdherenceChart({ data }: { data: DayAdherence[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barSize={16} barGap={4}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
        />
        <Bar
          dataKey="taken"
          name="Taken On-Time"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="late"
          name="Taken Late"
          fill="#f59e0b"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="missed"
          name="Missed"
          fill="#ef4444"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

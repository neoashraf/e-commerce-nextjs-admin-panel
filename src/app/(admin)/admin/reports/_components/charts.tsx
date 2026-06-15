"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Shared recharts wrappers for the report viewers. Charts are presentational —
 * each viewer renders a data **table** alongside as the accessible equivalent
 * (FR-RPT a11y, design §10), so these are marked `aria-hidden`. Brand-led
 * palette; values labelled in tooltips, not color-only.
 */

/** Brand-aligned categorical palette (also distinguishable in grayscale order). */
export const CHART_COLORS = [
  "#2563eb", // blue-600 (brand)
  "#16a34a", // green-600
  "#f59e0b", // amber-500
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#65a30d", // lime-600
];

function ChartFrame({
  height = 280,
  children,
}: {
  height?: number;
  children: React.ReactElement;
}) {
  return (
    <div aria-hidden="true" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export interface TrendPoint {
  bucket: string;
  revenue: number;
  orders: number;
}

/** Revenue area + orders line over time (dual axis). */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ChartFrame>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis yAxisId="rev" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis
          yAxisId="ord"
          orientation="right"
          tick={{ fontSize: 11 }}
          stroke="#94a3b8"
        />
        <Tooltip
          formatter={(value, name) =>
            name === "Revenue"
              ? [`৳ ${Number(value).toLocaleString("en-BD")}`, "Revenue"]
              : [String(value), "Orders"]
          }
        />
        <Legend />
        <Area
          yAxisId="rev"
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke={CHART_COLORS[0]}
          fill={CHART_COLORS[0]}
          fillOpacity={0.12}
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Line
          yAxisId="ord"
          type="monotone"
          dataKey="orders"
          name="Orders"
          stroke={CHART_COLORS[1]}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartFrame>
  );
}

export interface NamedValue {
  name: string;
  value: number;
}

/** Vertical bar chart for a single dimension (e.g. sales breakdown, products). */
export function BarBreakdownChart({
  data,
  valueLabel = "Value",
  currency = false,
}: {
  data: NamedValue[];
  valueLabel?: string;
  currency?: boolean;
}) {
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip
          formatter={(value) =>
            currency
              ? [`৳ ${Number(value).toLocaleString("en-BD")}`, valueLabel]
              : [String(value), valueLabel]
          }
        />
        <Bar dataKey="value" name={valueLabel} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/** Donut chart for a categorical split (e.g. orders-by-status, payment split). */
export function DonutChart({ data }: { data: NamedValue[] }) {
  return (
    <ChartFrame height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          isAnimationActive={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value, name) => [String(value), String(name)]} />
        <Legend />
      </PieChart>
    </ChartFrame>
  );
}

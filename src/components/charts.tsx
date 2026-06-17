"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Shared recharts wrappers for the dashboard + report viewers, styled to the
 * Commerce Admin design system (§3.4 palette, §9 data-viz rules). Charts are
 * presentational — each consumer renders a data **table** alongside as the
 * accessible equivalent (FR-RPT a11y, design §10), so the chart canvas is
 * `aria-hidden`. Component APIs are unchanged so existing callers keep working.
 */

/**
 * Restrained categorical palette (design-system §3.4): one harmonious family,
 * accent leads. Use in order; cap at 7 then bucket the rest as `viz-7` "Other".
 */
export const CHART_COLORS = [
  "#4F46E5", // viz-1 accent (lead series, "revenue")
  "#06B6D4", // viz-2 cyan
  "#F59E0B", // viz-3 amber
  "#10B981", // viz-4 emerald
  "#8B5CF6", // viz-5 violet
  "#F43F5E", // viz-6 rose (sparingly)
  "#64748B", // viz-7 slate ("other"/neutral)
];

/** Canonical order-status → color map (§3.4) — identical across donut/pill/legend. */
export const STATUS_COLORS: Record<string, string> = {
  pending: "#D97706",
  processing: "#D97706",
  confirmed: "#4F46E5",
  shipped: "#06B6D4",
  delivered: "#16A34A",
  cancelled: "#64748B",
  refunded: "#8B5CF6",
  failed: "#DC2626",
};

const AXIS_TICK = { fontSize: 11, fill: "#64748B" } as const;
const GRID_COLOR = "#E5E8EC";

function fmtBDT(value: number): string {
  return `৳ ${Number(value).toLocaleString("en-BD")}`;
}

interface TooltipRow {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/** Custom tooltip — surface card, soft shadow, color dot + bold value per series (§9). */
function ChartTooltip({
  active,
  payload,
  label,
  currencyKeys,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  currencyKeys?: string[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 shadow-md">
      {label !== undefined && (
        <p className="mb-1 text-xs font-medium text-text-muted">{label}</p>
      )}
      {payload.map((row, i) => {
        const isCurrency =
          currencyKeys?.includes(String(row.dataKey)) ||
          currencyKeys?.includes(String(row.name));
        const v =
          typeof row.value === "number" && isCurrency
            ? fmtBDT(row.value)
            : String(row.value);
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-text-secondary">{row.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-text">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

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

/** Revenue area + orders line over time (dual axis). Gradient area fill 14%→0%. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ChartFrame>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trendRevFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.14} />
            <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="bucket" tick={AXIS_TICK} stroke={GRID_COLOR} tickLine={false} />
        <YAxis
          yAxisId="rev"
          tick={AXIS_TICK}
          stroke={GRID_COLOR}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `৳ ${Number(v).toLocaleString("en-BD")}`}
        />
        <YAxis
          yAxisId="ord"
          orientation="right"
          tick={AXIS_TICK}
          stroke={GRID_COLOR}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<ChartTooltip currencyKeys={["revenue", "Revenue"]} />} />
        <Area
          yAxisId="rev"
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke={CHART_COLORS[0]}
          fill="url(#trendRevFill)"
          strokeWidth={2}
          activeDot={{ r: 4, fill: CHART_COLORS[0], stroke: "#fff", strokeWidth: 2 }}
          dot={false}
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
          activeDot={{ r: 4, fill: CHART_COLORS[1], stroke: "#fff", strokeWidth: 2 }}
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

/**
 * Bar chart for a single dimension (e.g. sales breakdown, top products).
 * `horizontal` flips to horizontal bars for rankings/top-N (design-system §9).
 */
export function BarBreakdownChart({
  data,
  valueLabel = "Value",
  currency = false,
  horizontal = false,
}: {
  data: NamedValue[];
  valueLabel?: string;
  currency?: boolean;
  horizontal?: boolean;
}) {
  const fmtCurrency = (v: number | string) =>
    `৳ ${Number(v).toLocaleString("en-BD")}`;
  const tooltip = (
    <Tooltip
      cursor={{ fill: "#F1F5F9" }}
      content={<ChartTooltip currencyKeys={currency ? ["value", valueLabel] : []} />}
    />
  );
  const cells = data.map((_, i) => (
    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
  ));

  if (horizontal) {
    return (
      <ChartFrame height={Math.max(220, data.length * 36 + 24)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            stroke={GRID_COLOR}
            tickLine={false}
            axisLine={false}
            tickFormatter={currency ? fmtCurrency : undefined}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_TICK}
            stroke={GRID_COLOR}
            tickLine={false}
            width={140}
          />
          {tooltip}
          <Bar dataKey="value" name={valueLabel} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {cells}
          </Bar>
        </BarChart>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="name" tick={AXIS_TICK} stroke={GRID_COLOR} tickLine={false} />
        <YAxis
          tick={AXIS_TICK}
          stroke={GRID_COLOR}
          tickLine={false}
          axisLine={false}
          tickFormatter={currency ? fmtCurrency : undefined}
        />
        {tooltip}
        <Bar dataKey="value" name={valueLabel} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {cells}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/**
 * Donut chart for a categorical split (e.g. orders-by-status, payment split).
 * Center label shows the total + metric name (§9). Pass `colorByStatus` to map
 * slices to the canonical order-status colors instead of the categorical order.
 */
export function DonutChart({
  data,
  centerLabel,
  colorByStatus = false,
}: {
  data: NamedValue[];
  centerLabel?: string;
  colorByStatus?: boolean;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const sliceColor = (entry: NamedValue, i: number) =>
    colorByStatus
      ? STATUS_COLORS[entry.name.toLowerCase()] ?? CHART_COLORS[i % CHART_COLORS.length]
      : CHART_COLORS[i % CHART_COLORS.length];

  return (
    <div className="relative" aria-hidden="true">
      <ChartFrame height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={sliceColor(entry, i)} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ChartFrame>
      {/* Center label: total + metric name */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-text">
          {total.toLocaleString("en-BD")}
        </span>
        {centerLabel && (
          <span className="text-xs font-medium text-text-muted">{centerLabel}</span>
        )}
      </div>
    </div>
  );
}

import { cn } from "@/lib/cn";

/**
 * Minimal stroke-only sparkline (design-system §9) — no axes/grid/labels.
 * Pure SVG (no recharts) so it stays cheap inside StatCards and table cells.
 * Decorative: the figure it accompanies carries the meaning, so aria-hidden.
 */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  stroke = "var(--accent-600)",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={cn("overflow-visible", className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

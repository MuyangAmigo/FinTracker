/*
 * StackedAreaChart — pure-SVG stacked area chart for the Phase-6 net-worth
 * trend. Server-component compatible: takes precomputed series as props and
 * emits inert SVG. No JS, no tooltips, no client interactivity.
 */

import { CHART_PALETTE, formatCompact, niceTicks } from "./palette";

export interface AreaSeries {
  key: string;
  label: string;
  colour: string;
  /** One value per x-axis tick, in the same order as `xLabels`. */
  values: number[];
}

export interface StackedAreaChartProps {
  xLabels: string[];
  series: AreaSeries[];
  /** Optional aria label; defaults to "Stacked area chart". */
  ariaLabel?: string;
  /** Internal viewBox height. Defaults to 240. */
  height?: number;
  /** Display height in px. Defaults to 100% (responsive). */
  className?: string;
  /** Tick-label formatter for the y-axis. Defaults to `formatCompact`. */
  yFormat?: (n: number) => string;
  /** Skip drawing one out of every N x-axis labels. Defaults to auto. */
  xLabelEvery?: number;
}

/**
 * Stacked area chart. Each series stacks on top of the previous one; the
 * outermost polygon path is rendered last so its top edge is the running
 * total.
 *
 * SVG coordinate system: x = 0..width, y = 0..height with origin top-left.
 * We flip y by subtracting from `chartHeight` so larger values render up.
 */
export function StackedAreaChart({
  xLabels,
  series,
  ariaLabel = "Stacked area chart",
  height = 240,
  className,
  yFormat = formatCompact,
  xLabelEvery,
}: StackedAreaChartProps) {
  const width = Math.max(xLabels.length * 60, 400);
  const padLeft = 48;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 32;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Validate and sum series across each x to find the y-axis maximum.
  const n = xLabels.length;
  const stacked: number[][] = [];
  let runningMax = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const col: number[] = [];
    for (const s of series) {
      sum += s.values[i] ?? 0;
      col.push(sum);
    }
    stacked.push(col);
    if (sum > runningMax) runningMax = sum;
  }
  const yTicks = niceTicks(runningMax || 1);
  const yMax = yTicks[yTicks.length - 1];

  const x = (i: number) =>
    n === 1 ? padLeft + chartW / 2 : padLeft + (i / (n - 1)) * chartW;
  const y = (value: number) =>
    padTop + chartH - (value / yMax) * chartH;

  // Each band is a polygon from running-total[s-1] (or 0 for first) to
  // running-total[s], swept left-to-right then back right-to-left.
  const bandPaths = series.map((s, sIdx) => {
    const top: string[] = [];
    const bottom: string[] = [];
    for (let i = 0; i < n; i++) {
      const upper = stacked[i][sIdx];
      const lower = sIdx === 0 ? 0 : stacked[i][sIdx - 1];
      top.push(`${x(i).toFixed(2)},${y(upper).toFixed(2)}`);
      bottom.push(`${x(i).toFixed(2)},${y(lower).toFixed(2)}`);
    }
    const points = [...top, ...bottom.reverse()].join(" ");
    return { key: s.key, colour: s.colour, points };
  });

  const labelEvery =
    xLabelEvery ?? (n <= 6 ? 1 : n <= 12 ? 2 : Math.ceil(n / 6));

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "w-full"}
    >
      {/* Y-axis grid lines + tick labels. */}
      {yTicks.map((t) => (
        <g key={`yt-${t}`}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={y(t)}
            y2={y(t)}
            stroke={CHART_PALETTE.primarySubdued}
            strokeOpacity={0.15}
            strokeWidth={1}
          />
          <text
            x={padLeft - 6}
            y={y(t)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.55}
          >
            {yFormat(t)}
          </text>
        </g>
      ))}

      {/* Stacked bands. */}
      {bandPaths.map((b) => (
        <polygon
          key={b.key}
          points={b.points}
          fill={b.colour}
          fillOpacity={0.85}
          stroke={b.colour}
          strokeWidth={0.5}
        />
      ))}

      {/* X-axis baseline. */}
      <line
        x1={padLeft}
        x2={width - padRight}
        y1={padTop + chartH}
        y2={padTop + chartH}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1}
      />

      {/* X-axis labels. */}
      {xLabels.map((label, i) => {
        if (i % labelEvery !== 0 && i !== n - 1) return null;
        return (
          <text
            key={`xl-${i}`}
            x={x(i)}
            y={padTop + chartH + 16}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.55}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

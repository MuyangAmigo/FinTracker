/*
 * LineChart — minimal SVG single-series line chart with optional area fill.
 *
 * Used by /dashboard/accounts/[id] to show a single account's balance trend
 * over time. Server-component compatible; no JS, no tooltips.
 */

import { CHART_PALETTE, formatCompact, niceTicks } from "./palette";

export interface LinePoint {
  label: string;
  value: number;
}

export interface LineChartProps {
  points: LinePoint[];
  colour?: string;
  fill?: boolean;
  height?: number;
  className?: string;
  ariaLabel?: string;
  yFormat?: (n: number) => string;
}

export function LineChart({
  points,
  colour = CHART_PALETTE.primarySoft,
  fill = true,
  height = 200,
  className,
  ariaLabel = "Trend line",
  yFormat = formatCompact,
}: LineChartProps) {
  const width = Math.max(points.length * 50, 360);
  const padLeft = 56;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 28;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const n = points.length;

  let max = 0;
  let min = 0;
  for (const p of points) {
    if (p.value > max) max = p.value;
    if (p.value < min) min = p.value;
  }
  const posTicks = niceTicks(Math.max(1, max));
  const yMax = posTicks[posTicks.length - 1];
  const negTicks = niceTicks(Math.abs(Math.min(0, min)));
  const yMin = min < 0 ? -negTicks[negTicks.length - 1] : 0;
  const range = yMax - yMin || 1;

  const x = (i: number) =>
    n <= 1 ? padLeft + chartW / 2 : padLeft + (i / (n - 1)) * chartW;
  const y = (v: number) => padTop + chartH - ((v - yMin) / range) * chartH;

  const linePoints = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const baselineY = y(Math.max(0, yMin));
  const areaPath =
    n === 0
      ? ""
      : `M ${x(0)} ${baselineY} ${points
          .map((p, i) => `L ${x(i)} ${y(p.value)}`)
          .join(" ")} L ${x(n - 1)} ${baselineY} Z`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "w-full"}
    >
      {posTicks.map((t) => (
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

      {fill && n > 0 ? (
        <path d={areaPath} fill={colour} fillOpacity={0.25} />
      ) : null}

      {n > 0 ? (
        <polyline
          points={linePoints}
          fill="none"
          stroke={colour}
          strokeWidth={1.5}
        />
      ) : null}

      {points.map((p, i) => (
        <circle key={`pt-${i}`} cx={x(i)} cy={y(p.value)} r={2} fill={colour} />
      ))}

      <line
        x1={padLeft}
        x2={width - padRight}
        y1={padTop + chartH}
        y2={padTop + chartH}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1}
      />

      {points.map((p, i) => {
        const every = n <= 6 ? 1 : n <= 12 ? 2 : Math.ceil(n / 6);
        if (i % every !== 0 && i !== n - 1) return null;
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
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

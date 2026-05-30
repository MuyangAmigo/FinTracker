/*
 * BarsLineChart — grouped income/expense bars with a savings-rate line and
 * optional dashed reference line (used for the household savings goal).
 *
 * Server-component compatible. Two y-axes:
 *   - Left  (bars):  currency values, 0 .. max(income/expense)
 *   - Right (line):  percent values, 0..100% (or wider if line exceeds 100)
 */

import { CHART_PALETTE, formatCompact, niceTicks } from "./palette";

export interface BarPoint {
  label: string;
  /** Bars (positive only). */
  income: number;
  expense: number;
  /** Line value as a fraction in [0, 1+]. null = skip the line node. */
  rate: number | null;
}

export interface BarsLineChartProps {
  points: BarPoint[];
  /** Optional dashed reference line on the right (rate) axis. */
  referenceRate?: number;
  /** Y-axis value formatter (bars side). Defaults to `formatCompact`. */
  yFormat?: (n: number) => string;
  ariaLabel?: string;
  height?: number;
  className?: string;
}

export function BarsLineChart({
  points,
  referenceRate,
  yFormat = formatCompact,
  ariaLabel = "Income and expense per month with savings rate",
  height = 260,
  className,
}: BarsLineChartProps) {
  const width = Math.max(points.length * 64, 400);
  const padLeft = 48;
  const padRight = 48;
  const padTop = 12;
  const padBottom = 32;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const n = points.length;

  let barMax = 0;
  for (const p of points) {
    barMax = Math.max(barMax, p.income, p.expense);
  }
  const yLeftTicks = niceTicks(barMax || 1);
  const yLeftMax = yLeftTicks[yLeftTicks.length - 1];

  // Right axis is rate as %. Reserve 0..1 by default; expand if any point
  // (or the reference line) exceeds 1 so the chart never clips.
  let rateMaxRaw = 1;
  for (const p of points) {
    if (p.rate !== null && p.rate > rateMaxRaw) rateMaxRaw = p.rate;
  }
  if (referenceRate !== undefined && referenceRate > rateMaxRaw) {
    rateMaxRaw = referenceRate;
  }
  const rateMax = Math.max(1, Math.ceil(rateMaxRaw * 10) / 10);

  // Each bucket gets a small horizontal slice of chartW. Within a bucket we
  // place two bars (income left, expense right) with a thin gap.
  const bucketW = n === 0 ? chartW : chartW / n;
  const barGap = 4;
  const barW = Math.max(6, (bucketW - barGap * 3) / 2);
  const bucketCenter = (i: number) => padLeft + (i + 0.5) * bucketW;

  const yLeft = (v: number) => padTop + chartH - (v / yLeftMax) * chartH;
  const yRight = (rate: number) => padTop + chartH - (rate / rateMax) * chartH;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "w-full"}
    >
      {/* Y-axis grid lines (left side ticks). */}
      {yLeftTicks.map((t) => (
        <g key={`yl-${t}`}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={yLeft(t)}
            y2={yLeft(t)}
            stroke={CHART_PALETTE.primarySubdued}
            strokeOpacity={0.15}
            strokeWidth={1}
          />
          <text
            x={padLeft - 6}
            y={yLeft(t)}
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

      {/* Right-axis tick labels (percent). */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const v = frac * rateMax;
        return (
          <text
            key={`yr-${frac}`}
            x={width - padRight + 6}
            y={yRight(v)}
            textAnchor="start"
            dominantBaseline="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.55}
          >
            {`${Math.round(v * 100)}%`}
          </text>
        );
      })}

      {/* Reference dashed line (goal). */}
      {referenceRate !== undefined ? (
        <g>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={yRight(referenceRate)}
            y2={yRight(referenceRate)}
            stroke={CHART_PALETTE.canvasCream}
            strokeWidth={1}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
          />
          <text
            x={width - padRight - 4}
            y={yRight(referenceRate) - 4}
            textAnchor="end"
            fontSize={10}
            fill={CHART_PALETTE.canvasCream}
            fillOpacity={0.9}
          >
            {`Goal ${Math.round(referenceRate * 100)}%`}
          </text>
        </g>
      ) : null}

      {/* Bars. */}
      {points.map((p, i) => {
        const cx = bucketCenter(i);
        const xIncome = cx - barW - barGap / 2;
        const xExpense = cx + barGap / 2;
        return (
          <g key={`bar-${i}`}>
            <rect
              x={xIncome}
              y={yLeft(p.income)}
              width={barW}
              height={padTop + chartH - yLeft(p.income)}
              fill={CHART_PALETTE.primarySoft}
              fillOpacity={0.85}
              rx={2}
            />
            <rect
              x={xExpense}
              y={yLeft(p.expense)}
              width={barW}
              height={padTop + chartH - yLeft(p.expense)}
              fill={CHART_PALETTE.ruby}
              fillOpacity={0.75}
              rx={2}
            />
          </g>
        );
      })}

      {/* Savings-rate polyline. */}
      <polyline
        fill="none"
        stroke={CHART_PALETTE.canvasCream}
        strokeWidth={1.5}
        points={points
          .map((p, i) =>
            p.rate === null ? null : `${bucketCenter(i)},${yRight(p.rate)}`,
          )
          .filter((v): v is string => v !== null)
          .join(" ")}
      />
      {points.map((p, i) =>
        p.rate === null ? null : (
          <circle
            key={`rd-${i}`}
            cx={bucketCenter(i)}
            cy={yRight(p.rate)}
            r={2.5}
            fill={CHART_PALETTE.canvasCream}
          />
        ),
      )}

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
      {points.map((p, i) => {
        const every = n <= 6 ? 1 : n <= 12 ? 2 : Math.ceil(n / 6);
        if (i % every !== 0 && i !== n - 1) return null;
        return (
          <text
            key={`xl-${i}`}
            x={bucketCenter(i)}
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

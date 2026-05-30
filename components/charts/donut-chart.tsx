/*
 * DonutChart — pure-SVG donut for category breakdown.
 *
 * Server-component compatible. Each slice is a SVG path drawn with arc
 * commands. A center label shows the total; an external legend is rendered
 * by the caller via the `slices` array so the chart stays presentational.
 */

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  colour: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  /** Centre text — typically the total formatted as currency. */
  centerLabel?: string;
  centerSubLabel?: string;
  size?: number;
  ariaLabel?: string;
  className?: string;
}

/**
 * Convert (cx, cy, radius, angleDeg) → cartesian. SVG arcs measure angles
 * from the positive x-axis clockwise; we offset by -90° so the donut starts
 * at 12 o'clock.
 */
function polar(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  const startOuter = polar(cx, cy, rOuter, endAngle);
  const endOuter = polar(cx, cy, rOuter, startAngle);
  const startInner = polar(cx, cy, rInner, startAngle);
  const endInner = polar(cx, cy, rInner, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function DonutChart({
  slices,
  centerLabel,
  centerSubLabel,
  size = 220,
  ariaLabel = "Category breakdown donut",
  className,
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 6;
  const rInner = rOuter * 0.62;

  const total = slices.reduce((s, x) => s + x.value, 0);

  let cursor = 0;
  const arcs =
    total === 0
      ? []
      : slices.map((s) => {
          const startAngle = cursor;
          const sweep = (s.value / total) * 360;
          const endAngle = cursor + sweep;
          cursor = endAngle;
          return {
            key: s.key,
            colour: s.colour,
            // Avoid a zero-width arc rendering as a thin line.
            d:
              sweep < 0.05
                ? null
                : describeArc(cx, cy, rOuter, rInner, startAngle, endAngle),
            label: s.label,
          };
        });

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "block"}
      width={size}
      height={size}
    >
      {total === 0 ? (
        <circle
          cx={cx}
          cy={cy}
          r={rOuter}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
        />
      ) : (
        arcs.map((a) =>
          a.d ? (
            <path
              key={a.key}
              d={a.d}
              fill={a.colour}
              fillOpacity={0.9}
              stroke="#1c1e54"
              strokeWidth={1}
            >
              <title>{a.label}</title>
            </path>
          ) : null,
        )
      )}

      {/* Centre label */}
      {centerLabel ? (
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={14}
          fontWeight={500}
          fill="currentColor"
        >
          {centerLabel}
        </text>
      ) : null}
      {centerSubLabel ? (
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.6}
        >
          {centerSubLabel}
        </text>
      ) : null}
    </svg>
  );
}

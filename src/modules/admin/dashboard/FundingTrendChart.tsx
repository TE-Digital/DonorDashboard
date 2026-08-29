// src/modules/admin/dashboard/FundingTrendChart.tsx
//
// Twelve months of money in against money placed. One chart on the whole page.
//
// Hand-authored SVG rather than a charting library. The product has no charting
// dependency and this is not enough of a reason to add one: two series, twelve
// points, no zoom, no brushing. A library would arrive with its own colours,
// its own type scale and its own tooltip, all of which would then have to be
// argued back into the Lumen tokens.
//
// The two series are told apart by colour AND by line style, because a reader
// who cannot separate the hues still has to be able to read the chart. The same
// numbers are also given as a table to assistive technology, so the figures are
// not locked inside a picture.

import React, { useId, useState } from "react";
import { SectionCard } from "../../../design-system";
import { formatCurrency } from "../../../design-system";
import type { TrendPoint } from "../dashboardMetrics";
import styles from "./Dashboard.module.scss";

export interface FundingTrendChartProps {
  points: TrendPoint[];
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

const shortBaht = (value: number): string => {
  if (value >= 1_000_000) return `฿${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `฿${Math.round(value / 1_000)}k`;
  return `฿${Math.round(value)}`;
};

export const FundingTrendChart: React.FC<FundingTrendChartProps> = ({ points }) => {
  const titleId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const peak = Math.max(
    1,
    ...points.map((point) => Math.max(point.receivedThb, point.allocatedThb)),
  );

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const x = (index: number) => PAD_LEFT + index * step;
  const y = (value: number) => PAD_TOP + plotHeight - (value / peak) * plotHeight;

  const path = (pick: (point: TrendPoint) => number) =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`)
      .join(" ");

  const active = hover === null ? null : points[hover];
  const everything = points.every(
    (point) => point.receivedThb === 0 && point.allocatedThb === 0,
  );

  return (
    <SectionCard
      title="Received against allocated"
      description="Twelve months. Whether money is being placed as fast as it arrives."
      gap="sm"
    >
      {everything ? (
        <p className={styles.headlineNote}>
          No contributions or allocations recorded in the last twelve months.
        </p>
      ) : (
        <>
          <div className={styles.chartWrap}>
            <svg
              className={styles.chart}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-labelledby={titleId}
            >
              <title id={titleId}>
                Contributions received and money allocated, by month, over the last twelve
                months. Peak month {shortBaht(peak)}.
              </title>

              {/* Three reference lines. Enough to read a height, not a grid. */}
              {[0, 0.5, 1].map((fraction) => (
                <line
                  key={fraction}
                  x1={PAD_LEFT}
                  x2={WIDTH - PAD_RIGHT}
                  y1={y(peak * fraction)}
                  y2={y(peak * fraction)}
                  stroke="var(--border-subtle)"
                  strokeWidth={1}
                />
              ))}

              <path
                d={path((point) => point.receivedThb)}
                fill="none"
                stroke="var(--blue-500)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={path((point) => point.allocatedThb)}
                fill="none"
                stroke="var(--plum-500)"
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {active && (
                <line
                  x1={x(hover as number)}
                  x2={x(hover as number)}
                  y1={PAD_TOP}
                  y2={PAD_TOP + plotHeight}
                  stroke="var(--border-strong)"
                  strokeWidth={1}
                />
              )}

              {points.map((point, index) => (
                <g key={point.month}>
                  {/* An invisible column per month: the hover target is the
                      whole width, not a 4px dot nobody can hit. */}
                  <rect
                    x={x(index) - step / 2}
                    y={PAD_TOP}
                    width={Math.max(step, 8)}
                    height={plotHeight}
                    fill="transparent"
                    onMouseEnter={() => setHover(index)}
                    onMouseLeave={() => setHover(null)}
                  />
                  {(index === 0 || index === points.length - 1 || index % 3 === 0) && (
                    <text
                      x={x(index)}
                      y={HEIGHT - 8}
                      textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                      fontSize={11}
                      fill="var(--text-muted)"
                    >
                      {point.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>

          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ background: "var(--blue-500)" }}
                aria-hidden="true"
              />
              Received (solid)
            </span>
            <span className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{
                  background:
                    "repeating-linear-gradient(90deg, var(--plum-500) 0 5px, transparent 5px 9px)",
                }}
                aria-hidden="true"
              />
              Allocated (dashed)
            </span>
            {active && (
              <span className={styles.legendItem} aria-live="polite">
                <strong>{active.label}</strong> · received {formatCurrency(active.receivedThb)} ·
                allocated {formatCurrency(active.allocatedThb)}
              </span>
            )}
          </div>

          <table className={styles.visuallyHidden}>
            <caption>Received against allocated, by month</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Received</th>
                <th scope="col">Allocated</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.month}>
                  <th scope="row">{point.label}</th>
                  <td>{formatCurrency(point.receivedThb)}</td>
                  <td>{formatCurrency(point.allocatedThb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </SectionCard>
  );
};

export default FundingTrendChart;

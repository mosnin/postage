"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type ChartType = "line" | "bar";

export interface MetricConfig {
  key: string;
  label: string;
  color: string;
  yAxisId?: "left" | "right";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface MetricsChartProps {
  data: Array<Record<string, any>>;
  metrics: MetricConfig[];
  type?: ChartType;
  height?: number;
  className?: string;
  formatValue?: (value: number) => string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDateLabel(dateStr: string): string {
  try {
    return format(new Date(dateStr + "T00:00:00"), "MMM d");
  } catch {
    return dateStr;
  }
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        {label ? formatDateLabel(label) : ""}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function MetricsChart({
  data,
  metrics,
  type = "line",
  height = 280,
  className,
  formatValue = formatNumber,
}: MetricsChartProps) {
  const hasDualAxis = metrics.some((m) => m.yAxisId === "right");

  const commonProps = {
    data,
    margin: { top: 5, right: hasDualAxis ? 10 : 5, left: 0, bottom: 0 },
  };

  const xAxis = (
    <XAxis
      dataKey="date"
      tickFormatter={formatDateLabel}
      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
      tickLine={false}
      axisLine={false}
      interval="preserveStartEnd"
    />
  );

  const yAxisLeft = (
    <YAxis
      yAxisId="left"
      tickFormatter={formatValue}
      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
      tickLine={false}
      axisLine={false}
      width={42}
    />
  );

  const yAxisRight = hasDualAxis ? (
    <YAxis
      yAxisId="right"
      orientation="right"
      tickFormatter={formatValue}
      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
      tickLine={false}
      axisLine={false}
      width={42}
    />
  ) : null;

  const grid = (
    <CartesianGrid
      strokeDasharray="3 3"
      stroke="hsl(var(--border))"
      vertical={false}
    />
  );

  const tooltip = <Tooltip content={<CustomTooltip />} />;

  const legend = (
    <Legend
      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
      formatter={(value) => (
        <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>
      )}
    />
  );

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === "line" ? (
          <LineChart {...commonProps}>
            {grid}
            {xAxis}
            {yAxisLeft}
            {yAxisRight}
            {tooltip}
            {legend}
            {metrics.map((m) => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                yAxisId={m.yAxisId ?? "left"}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart {...commonProps}>
            {grid}
            {xAxis}
            {yAxisLeft}
            {yAxisRight}
            {tooltip}
            {legend}
            {metrics.map((m) => (
              <Bar
                key={m.key}
                dataKey={m.key}
                name={m.label}
                fill={m.color}
                yAxisId={m.yAxisId ?? "left"}
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

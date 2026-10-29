import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import Card from "../../components/ui/Card";
import { compact } from "../../lib/format";

import { AXIS, ChartTooltip, GRID, colorFor, monthTick } from "./chartTheme";

export type TrendRow = { month: string } & Record<string, number | string>;

export default function CategoryTrend({ rows }: { rows: TrendRow[] }) {
    // Categories come from the data, not a hardcoded list — a new one
    // appears on the chart the moment a payee is labelled with it.
    const categories = Array.from(
        new Set(rows.flatMap((r) => Object.keys(r).filter((k) => k !== "month")))
    ).sort();

    return (
        <Card className="min-w-0 flex-[999_1_460px]">
            <div className="mb-4 flex flex-wrap items-baseline gap-3">
                <h2 className="grow text-base font-semibold tracking-[-0.015em]">
                    Categories over six months
                </h2>
                <div className="flex flex-wrap gap-3">
                    {categories.map((c) => (
                        <span key={c} className="flex items-center gap-1.5 text-xs text-ink-3">
                            <span
                                className="size-2 rounded-[2px]"
                                style={{ backgroundColor: colorFor(c) }}
                            />
                            <span className="capitalize">{c}</span>
                        </span>
                    ))}
                </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                        dataKey="month"
                        tickFormatter={monthTick}
                        tick={{ fill: AXIS, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tickFormatter={(v: number) => compact(v)}
                        tick={{ fill: AXIS, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: GRID }} />

                    {categories.map((c, i) => (
                        <Bar
                            key={c}
                            dataKey={c}
                            stackId="spend"
                            fill={colorFor(c)}
                            // Only the top segment gets rounded corners, or every
                            // slice looks like a separate floating pill.
                            radius={i === categories.length - 1 ? [4, 4, 0, 0] : undefined}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </Card>
    );
}
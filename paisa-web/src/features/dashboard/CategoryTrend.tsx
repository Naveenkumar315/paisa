import {
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import Card from "../../components/ui/Card";
import { compact } from "../../lib/format";
import { useUiStore } from "../../stores/ui";

import ChartTooltip from "./ChartTooltip";
import {
    AXIS,
    GRID,
    LABEL_STYLE,
    categoryRank,
    colorFor,
    labelCompact,
    monthTick,
} from "./chartTheme";
import { legendItemClass, useHidden } from "./useHidden";

export type TrendRow = { month: string } & Record<string, number | string>;

export default function CategoryTrend({ rows }: { rows: TrendRow[] }) {
    // Categories come from the data, not a hardcoded list — a new one
    // appears on the chart the moment a payee is labelled with it.
    // Transfers have their own chart; stacked here they dwarf every other
    // category and push the axis out of reach.
    const categories = Array.from(
        new Set(
            rows.flatMap((r) =>
                Object.keys(r).filter((k) => k !== "month" && k !== "transfer"),
            ),
        ),
    ).sort((a, b) => categoryRank(a) - categoryRank(b));
    const showLabels = useUiStore((s) => s.showChartLabels);
    const { hidden, toggle } = useHidden();
    const visible = categories.filter((c) => !hidden.has(c));
    // One total per stack, hung off whichever segment is on top that month.
    // Recharts draws no label for a zero-height segment, so pinning it to
    // the last category loses the total whenever that category is empty.
    const data = rows.map((r) => ({
        ...r,
        total: visible.reduce((sum, c) => sum + Number(r[c] ?? 0), 0),
        top: [...visible].reverse().find((c) => Number(r[c] ?? 0) > 0),
    }));

    return (
        <Card className="flex min-w-0 flex-[999_1_460px] flex-col">
            <div className="mb-4 flex flex-wrap items-baseline gap-3">
                <h2 className="grow text-base font-semibold tracking-[-0.015em]">
                    Categories over six months
                </h2>
                <div className="flex flex-wrap gap-3">
                    {categories.map((c) => (
                        <button
                            key={c}
                            type="button"
                            aria-pressed={!hidden.has(c)}
                            title={hidden.has(c) ? `Show ${c}` : `Hide ${c}`}
                            onClick={() => toggle(c)}
                            className={`flex cursor-pointer items-center gap-1.5 bg-transparent p-0 text-xs text-ink-3 ${legendItemClass(hidden.has(c))}`}
                        >
                            <span
                                className="size-2 rounded-[2px]"
                                style={{ backgroundColor: colorFor(c) }}
                            />
                            <span className="capitalize">{c}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Grows to the row's height, so a taller neighbour never leaves
                an empty band under the bars. */}
            <div className="min-h-60 flex-1">
                <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                    <BarChart
                        data={data}
                        margin={{
                            top: showLabels ? 20 : 4,
                            right: 8,
                            bottom: 0,
                            left: -12,
                        }}
                    >
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
                        <Tooltip
                            content={<ChartTooltip />}
                            cursor={{ fill: GRID }}
                        />

                        {visible.map((c, i) => (
                            <Bar
                                key={c}
                                dataKey={c}
                                stackId="spend"
                                fill={colorFor(c)}
                                // Only the top segment gets rounded corners, or every
                                // slice looks like a separate floating pill.
                                radius={
                                    i === visible.length - 1
                                        ? [4, 4, 0, 0]
                                        : undefined
                                }
                            >
                                {showLabels && (
                                    <LabelList
                                        position="top"
                                        valueAccessor={(entry) =>
                                            entry.payload.top === c
                                                ? labelCompact(
                                                      entry.payload.total,
                                                  )
                                                : ""
                                        }
                                        style={LABEL_STYLE}
                                    />
                                )}
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

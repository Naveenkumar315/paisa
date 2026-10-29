import {
    Area,
    LabelList,
    AreaChart,
    CartesianGrid,
    ReferenceDot,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { compact } from "../../lib/format";
import { useUiStore } from "../../stores/ui";
import type { MonthSummary } from "../../types/api";

import ChartTooltip from "./ChartTooltip";
import { ACCENT, AXIS, GRID, LABEL_STYLE, labelCompact, monthTick } from "./chartTheme";

export default function SpendTrend({
    months,
    selected,
    onSelect,
}: {
    months: MonthSummary[];
    selected: string;
    onSelect: (month: string) => void;
}) {
    const data = months.map((m) => ({
        month: m.month,
        spending: m.spending_paise,
    }));
    const current = data.find((d) => d.month === selected);
    const showLabels = useUiStore((s) => s.showChartLabels);

    return (
        <ResponsiveContainer width="100%" height={220}>
            <AreaChart
                data={data}
                margin={{ top: showLabels ? 22 : 8, right: 8, bottom: 0, left: -12 }}
                onClick={(e) => {
                    const month = e?.activeLabel;
                    if (typeof month === "string") onSelect(month);
                }}
                style={{ cursor: "pointer" }}
            >
                <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                    </linearGradient>
                </defs>

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
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID }} />

                <Area
                    type="monotone"
                    dataKey="spending"
                    name="Spending"
                    stroke={ACCENT}
                    strokeWidth={2}
                    fill="url(#spendFill)"
                    dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                >
                    {showLabels && (
                        <LabelList
                            dataKey="spending"
                            position="top"
                            offset={10}
                            formatter={labelCompact}
                            style={LABEL_STYLE}
                        />
                    )}
                </Area>

                {/* The selected month is marked rather than recoloured, so the
            line keeps reading as one series. */}
                {current && (
                    <ReferenceDot
                        x={current.month}
                        y={current.spending}
                        r={6}
                        fill={ACCENT}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                    />
                )}
            </AreaChart>
        </ResponsiveContainer>
    );
}
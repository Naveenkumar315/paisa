import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import Card from "../../components/ui/Card";
import { compact, money } from "../../lib/format";
import { useUiStore } from "../../stores/ui";
import type { MonthSummary } from "../../types/api";

import ChartTooltip from "./ChartTooltip";
import { AXIS, GRID, LABEL_STYLE, colorFor, labelCompact, monthTick } from "./chartTheme";

const TRANSFER = colorFor("transfer");

export default function TransferTrend({
    months,
    selected,
    onSelect,
}: {
    months: MonthSummary[];
    selected: string;
    onSelect: (month: string) => void;
}) {
    const data = months.map((m) => ({ month: m.month, transfer: m.transfers_paise }));
    const current = months.find((m) => m.month === selected);
    const showLabels = useUiStore((s) => s.showChartLabels);
    const share =
        current && current.spending_paise > 0
            ? Math.round((100 * current.transfers_paise) / current.spending_paise)
            : 0;

    return (
        <Card className="min-w-0 flex-[1_1_320px]">
            <div className="mb-4">
                <h2 className="mb-1 text-base font-semibold tracking-[-0.015em]">
                    Sent to people
                </h2>
                <p className="text-[28px] leading-none font-medium tracking-[-0.03em]">
                    {money(current?.transfers_paise ?? 0)}
                </p>
                <p className="mt-1.5 text-[13px] text-ink-3">
                    {monthTick(selected)} · {share}% of all spending
                </p>
            </div>

            <ResponsiveContainer width="100%" height={200}>
                <BarChart
                    data={data}
                    margin={{ top: showLabels ? 20 : 4, right: 8, bottom: 0, left: -12 }}
                    onClick={(e) => {
                        const month = e?.activeLabel;
                        if (typeof month === "string") onSelect(month);
                    }}
                    style={{ cursor: "pointer" }}
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
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: GRID }} />
                    <Bar dataKey="transfer" name="Transfer" fill={TRANSFER} radius={[4, 4, 0, 0]}>
                        {data.map((d) => (
                            <Cell
                                key={d.month}
                                fillOpacity={d.month === selected ? 1 : 0.45}
                            />
                        ))}
                        {showLabels && (
                            <LabelList
                                dataKey="transfer"
                                position="top"
                                formatter={labelCompact}
                                style={LABEL_STYLE}
                            />
                        )}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </Card>
    );
}

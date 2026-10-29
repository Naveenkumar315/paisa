import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import Card from "../../components/ui/Card";
import { money } from "../../lib/format";
import type { CategorySlice } from "../../types/api";

import { ChartTooltip, colorFor } from "./chartTheme";

export default function CategoryDonut({
    slices,
    total,
}: {
    slices: CategorySlice[];
    total: number;
}) {
    const data = slices.map((s) => ({
        name: s.name,
        value: s.amount_paise,
        pct: s.pct,
    }));

    return (
        <Card className="min-w-0 flex-[1_1_320px]">
            <h2 className="mb-4 text-base font-semibold tracking-[-0.015em]">Where it went</h2>

            <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={84}
                            paddingAngle={2}
                            stroke="none"
                        >
                            {data.map((d) => (
                                <Cell key={d.name} fill={colorFor(d.name)} />
                            ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                </ResponsiveContainer>

                {/* The hole is wasted space otherwise, and the total belongs
            where the eye already is. */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="font-mono text-xl tracking-tight">{money(total)}</p>
                    <p className="text-[11px] text-ink-3">this month</p>
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
                {data.map((d) => (
                    <div key={d.name} className="flex items-baseline gap-2.5">
                        <span
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{ backgroundColor: colorFor(d.name) }}
                        />
                        <span className="min-w-0 grow truncate text-[13.5px] font-medium">
                            {d.name}
                        </span>
                        <span className="shrink-0 text-xs text-ink-3">{d.pct}%</span>
                        <span className="w-16 shrink-0 text-right font-mono text-[13.5px]">
                            {money(d.value)}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
}
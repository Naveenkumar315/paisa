import {
    Cell,
    LabelList,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

import Card from "../../components/ui/Card";
import { money } from "../../lib/format";
import { useUiStore } from "../../stores/ui";
import type { CategorySlice } from "../../types/api";

import ChartTooltip from "./ChartTooltip";
import { LABEL_STYLE, categoryRank, colorFor } from "./chartTheme";
import { legendItemClass, useHidden } from "./useHidden";

export default function CategoryDonut({ slices }: { slices: CategorySlice[] }) {
    const showLabels = useUiStore((s) => s.showChartLabels);
    // Transfers to people have their own chart. Left in, one large transfer
    // fills the ring and every shop category shrinks to a sliver.
    const shops = slices.filter((s) => s.name.toLowerCase() !== "transfer");
    const { hidden, toggle } = useHidden();
    // Total and shares cover only what is still shown, so hiding a big
    // category re-reads the rest as a whole.
    const total = shops
        .filter((s) => !hidden.has(s.name))
        .reduce((sum, s) => sum + s.amount_paise, 0);
    const data = shops.map((s) => ({
        name: s.name,
        value: s.amount_paise,
        pct:
            total > 0 && !hidden.has(s.name)
                ? Math.round((100 * s.amount_paise) / total)
                : 0,
    }));
    // The ring keeps the fixed category order so neighbouring colours stay
    // distinguishable; the legend below stays sorted by amount.
    const ring = data
        .filter((d) => !hidden.has(d.name))
        .sort((a, b) => categoryRank(a.name) - categoryRank(b.name));

    return (
        <Card className="min-w-0 flex-[1_1_520px]">
            <h2 className="mb-4 text-base font-semibold tracking-[-0.015em]">
                Where it went
            </h2>

            {/* Ring and legend side by side: stacked, the list made this card
                twice the height of its neighbour and left that one half empty. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <div className="relative mx-auto w-[220px] shrink-0">
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={ring}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={58}
                                outerRadius={84}
                                paddingAngle={2}
                                stroke="none"
                            >
                                {ring.map((d) => (
                                    <Cell
                                        key={d.name}
                                        fill={colorFor(d.name)}
                                    />
                                ))}
                                {showLabels && (
                                    <LabelList
                                        dataKey="pct"
                                        position="outside"
                                        offset={10}
                                        // Slivers under 4% would print on top of
                                        // their neighbours; the legend has them.
                                        formatter={(v: unknown) =>
                                            Number(v) >= 4 ? `${v}%` : ""
                                        }
                                        style={LABEL_STYLE}
                                    />
                                )}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>

                    {/* The hole is wasted space otherwise, and the total belongs
            where the eye already is. */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[22px] font-medium tracking-[-0.03em]">
                            {money(total)}
                        </p>
                        <p className="text-[11px] text-ink-3">
                            shops &amp; services
                        </p>
                    </div>
                </div>

                <div className="flex min-w-[190px] flex-1 flex-col gap-2.5">
                    {data.map((d) => (
                        <button
                            key={d.name}
                            type="button"
                            aria-pressed={!hidden.has(d.name)}
                            title={
                                hidden.has(d.name)
                                    ? `Show ${d.name}`
                                    : `Hide ${d.name}`
                            }
                            onClick={() => toggle(d.name)}
                            className={`flex cursor-pointer items-baseline gap-2.5 bg-transparent p-0 text-left ${legendItemClass(hidden.has(d.name))}`}
                        >
                            <span
                                className="size-2.5 shrink-0 rounded-[3px]"
                                style={{ backgroundColor: colorFor(d.name) }}
                            />
                            <span className="min-w-0 grow truncate text-[13.5px] font-medium">
                                {d.name}
                            </span>
                            <span className="shrink-0 text-xs text-ink-3">
                                {hidden.has(d.name) ? "–" : `${d.pct}%`}
                            </span>
                            <span className="w-16 shrink-0 text-right font-mono text-[13.5px]">
                                {money(d.value)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </Card>
    );
}

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
import { compact, money, moneyExact } from "../../lib/format";
import { useUiStore } from "../../stores/ui";

import type { TrendRow } from "./CategoryTrend";
import { AXIS, GRID, LABEL_STYLE, labelCompact, monthTick } from "./chartTheme";
import { legendItemClass, useHidden } from "./useHidden";

// Shades of the mobile plum, light to dark, so the card still reads as
// "mobile" next to the category charts while each plan stays distinguishable.
const PLAN_SHADES = ["#A68AD2", "#8059B8", "#613F93", "#44296B"];

export type RechargeRow = {
    month: string;
    payee: string;
    amount_paise: number;
    count: number;
};

type Plan = {
    key: string;
    // Recharts reads a dotted dataKey as a path, and payee names can
    // contain dots, so the chart gets a plain index key instead.
    dataKey: string;
    payee: string;
    amount_paise: number;
    total: number;
    color: string;
};

function plansFrom(recharges: RechargeRow[]): Plan[] {
    const plans = new Map<string, Omit<Plan, "color" | "dataKey">>();
    for (const r of recharges) {
        const key = `${r.payee}|${r.amount_paise}`;
        const plan = plans.get(key) ?? { key, payee: r.payee, amount_paise: r.amount_paise, total: 0 };
        plan.total += r.count;
        plans.set(key, plan);
    }
    return [...plans.values()]
        .sort((a, b) => a.amount_paise - b.amount_paise || a.payee.localeCompare(b.payee))
        .map((p, i) => ({ ...p, dataKey: `plan${i}`, color: PLAN_SHADES[i % PLAN_SHADES.length] }));
}

function planLabel(p: Plan): string {
    return `${moneyExact(p.amount_paise)} ${p.payee}`;
}

type MonthDatum = { month: string; counts: Record<string, number> } & Record<string, unknown>;

function RechargeTooltip({
    active,
    payload,
    label,
    plans,
}: {
    active?: boolean;
    payload?: { payload: MonthDatum }[];
    label?: string;
    plans: Plan[];
}) {
    if (!active || !payload?.length || !label) return null;
    const counts = payload[0].payload.counts;
    const paid = plans.filter((p) => counts[p.key]);

    return (
        <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
            <p className="mb-1.5 text-xs font-semibold text-ink">{monthTick(label)}</p>
            {paid.length === 0 && <p className="text-xs text-ink-3">No recharges</p>}
            {paid.map((p) => (
                <p key={p.key} className="flex items-center gap-2 text-xs text-ink-2">
                    <span
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: p.color }}
                    />
                    <span className="grow">{planLabel(p)}</span>
                    <span className="font-mono">×{counts[p.key]}</span>
                </p>
            ))}
        </div>
    );
}

export default function MobileSpend({
    rows,
    recharges,
    selected,
    onSelect,
}: {
    rows: TrendRow[];
    recharges: RechargeRow[];
    selected: string;
    onSelect: (month: string) => void;
}) {
    const plans = plansFrom(recharges);
    const { hidden, toggle } = useHidden();
    // Colours are assigned across every plan before hiding, so switching a
    // plan off never repaints the ones that stay.
    const visible = plans.filter((p) => !hidden.has(p.key));
    const byKey = new Map(plans.map((p) => [p.key, p]));

    // Months come from the trend, not the recharges, so a month with no
    // recharge still gets an empty slot instead of vanishing from the axis.
    const data: MonthDatum[] = rows.map((r) => {
        const datum: MonthDatum = { month: r.month, counts: {} };
        for (const p of plans) datum[p.dataKey] = 0;
        for (const x of recharges.filter((x) => x.month === r.month)) {
            const plan = byKey.get(`${x.payee}|${x.amount_paise}`)!;
            datum[plan.dataKey] = (datum[plan.dataKey] as number) + x.amount_paise * x.count;
            datum.counts[plan.key] = (datum.counts[plan.key] ?? 0) + x.count;
        }
        datum.total = visible.reduce((sum, p) => sum + (datum[p.dataKey] as number), 0);
        // The total hangs off the top non-empty plan; see CategoryTrend.
        datum.top = [...visible].reverse().find((p) => (datum[p.dataKey] as number) > 0)?.dataKey;
        return datum;
    });
    const showLabels = useUiStore((s) => s.showChartLabels);

    const spentIn = (d: MonthDatum) => visible.reduce((sum, p) => sum + (d[p.dataKey] as number), 0);
    const current = data.find((d) => d.month === selected);
    const average = data.reduce((sum, d) => sum + spentIn(d), 0) / Math.max(data.length, 1);

    return (
        <Card className="min-w-0 flex-[999_1_460px]">
            <div className="mb-4 flex flex-wrap items-start gap-4">
                <div className="min-w-0 grow">
                    <h2 className="mb-1 text-base font-semibold tracking-[-0.015em]">Mobile recharges</h2>
                    <p className="text-[28px] leading-none font-medium tracking-[-0.03em]">
                        {money(current ? spentIn(current) : 0)}
                    </p>
                    <p className="mt-1.5 text-[13px] text-ink-3">
                        {monthTick(selected)} · click a bar for another month
                    </p>
                </div>
                <div className="text-right">
                    <p className="mb-1 text-xs text-ink-3">Monthly average</p>
                    <p className="text-base font-medium tracking-[-0.015em]">{money(average)}</p>
                </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {plans.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        aria-pressed={!hidden.has(p.key)}
                        title={hidden.has(p.key) ? "Show this plan" : "Hide this plan"}
                        onClick={() => toggle(p.key)}
                        className={`flex cursor-pointer items-center gap-1.5 bg-transparent p-0 text-xs text-ink-3 ${legendItemClass(hidden.has(p.key))}`}
                    >
                        <span
                            className="size-2 rounded-[2px]"
                            style={{ backgroundColor: p.color }}
                        />
                        <span className="font-mono text-ink">{moneyExact(p.amount_paise)}</span>
                        <span>{p.payee}</span>
                        <span className="font-mono">×{p.total}</span>
                    </button>
                ))}
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
                    <Tooltip content={<RechargeTooltip plans={visible} />} cursor={{ fill: GRID }} />

                    {visible.map((p, i) => (
                        <Bar
                            key={p.key}
                            dataKey={p.dataKey}
                            name={planLabel(p)}
                            stackId="plans"
                            fill={p.color}
                            radius={i === visible.length - 1 ? [4, 4, 0, 0] : undefined}
                        >
                            {/* Fade the other months rather than recolour the
                                selected one, so each plan keeps its colour. */}
                            {data.map((d) => (
                                <Cell
                                    key={d.month}
                                    fillOpacity={d.month === selected ? 1 : 0.45}
                                />
                            ))}
                            {showLabels && (
                                <LabelList
                                    position="top"
                                    valueAccessor={(entry) =>
                                        entry.payload.top === p.dataKey
                                            ? labelCompact(entry.payload.total)
                                            : ""
                                    }
                                    style={LABEL_STYLE}
                                />
                            )}
                        </Bar>
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </Card>
    );
}

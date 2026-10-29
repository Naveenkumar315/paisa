import { useMemo } from "react";

import Card from "../../components/ui/Card";
import { money } from "../../lib/format";

export interface DayRow {
    date: string; // YYYY-MM-DD
    amount_paise: number;
    count: number;
}

const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;
const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

// Five steps, light to dark. A continuous scale looks precise and is
// unreadable; five buckets are something the eye can actually compare.
const SHADES = ["#EDEFF4", "#C9D4F2", "#9FB0E8", "#6B82DC", "#2D4BBF"];

const MONTH_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Monday-first weekday index, because a spending week starts Monday. */
function weekdayIndex(d: Date): number {
    return (d.getDay() + 6) % 7;
}

export default function SpendHeatmap({ days }: { days: DayRow[] }) {
    const { cells, weeks, monthLabels, max } = useMemo(() => {
        if (days.length === 0) {
            return { cells: [], weeks: 0, monthLabels: [], max: 0 };
        }

        const byDate = new Map(days.map((d) => [d.date, d]));
        const first = new Date(days[0].date);
        const last = new Date(days[days.length - 1].date);

        // Back up to the Monday of the first week so columns line up.
        const start = new Date(first);
        start.setDate(start.getDate() - weekdayIndex(first));

        const out: Array<{
            x: number;
            y: number;
            date: string;
            amount: number;
            count: number;
        }> = [];
        const labels: Array<{ x: number; text: string }> = [];
        let seenMonth = -1;

        const cursor = new Date(start);
        let week = 0;
        while (cursor <= last) {
            const iso = cursor.toISOString().slice(0, 10);
            const row = byDate.get(iso);
            const col = weekdayIndex(cursor);

            if (cursor >= first) {
                out.push({
                    x: week * STEP,
                    y: col * STEP,
                    date: iso,
                    amount: row?.amount_paise ?? 0,
                    count: row?.count ?? 0,
                });

                if (cursor.getMonth() !== seenMonth && col <= 3) {
                    seenMonth = cursor.getMonth();
                    labels.push({ x: week * STEP, text: MONTH_SHORT[seenMonth] });
                }
            }

            if (col === 6) week += 1;
            cursor.setDate(cursor.getDate() + 1);
        }

        const peak = Math.max(...days.map((d) => d.amount_paise), 1);
        return { cells: out, weeks: week + 1, monthLabels: labels, max: peak };
    }, [days]);

    if (cells.length === 0) return null;

    const width = weeks * STEP + 36;
    const height = 7 * STEP + 22;

    const busiest = days.reduce(
        (best, d) => (d.amount_paise > best.amount_paise ? d : best),
        days[0]
    );
    const quiet = days.filter((d) => d.amount_paise === 0).length;

    return (
        <Card>
            <div className="mb-4 flex flex-wrap items-baseline gap-3">
                <h2 className="grow text-base font-semibold tracking-[-0.015em]">Every day</h2>
                <span className="flex items-center gap-1.5 text-xs text-ink-3">
                    Less
                    {SHADES.map((s) => (
                        <span
                            key={s}
                            className="size-2.5 rounded-[2px]"
                            style={{ backgroundColor: s }}
                        />
                    ))}
                    More
                </span>
            </div>

            <div className="overflow-x-auto">
                <svg
                    width={width}
                    height={height}
                    role="img"
                    aria-label="Daily spending across the statement period"
                    style={{ minWidth: width }}
                >
                    {DAYS.map((d, i) =>
                        d ? (
                            <text
                                key={i}
                                x={0}
                                y={i * STEP + 22}
                                fontSize={10}
                                fill="#5A6070"
                            >
                                {d}
                            </text>
                        ) : null
                    )}

                    {monthLabels.map((m) => (
                        <text
                            key={m.text + m.x}
                            x={m.x + 32}
                            y={9}
                            fontSize={10}
                            fill="#5A6070"
                        >
                            {m.text}
                        </text>
                    ))}

                    {cells.map((c) => {
                        const step =
                            c.amount === 0
                                ? 0
                                : Math.min(4, Math.ceil((c.amount / max) * 4));
                        return (
                            <rect
                                key={c.date}
                                x={c.x + 32}
                                y={c.y + 14}
                                width={CELL}
                                height={CELL}
                                rx={3}
                                fill={SHADES[step]}
                            >
                                <title>
                                    {c.date}
                                    {c.count > 0
                                        ? ` — ${money(c.amount)} across ${c.count} payments`
                                        : " — nothing spent"}
                                </title>
                            </rect>
                        );
                    })}
                </svg>
            </div>

            <p className="mt-4 border-t border-line-soft pt-4 text-[13px] leading-relaxed text-ink-3">
                Busiest day was {busiest.date} at {money(busiest.amount_paise)}. There
                were {quiet} days with nothing spent at all.
            </p>
        </Card>
    );
}
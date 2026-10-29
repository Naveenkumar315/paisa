import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import Stat from "../../components/ui/Stat";
import { api } from "../../api/client";
import { money, shortDate } from "../../lib/format";
import { cn } from "../../lib/cn";

interface PersonBalance {
    name: string;
    paid_paise: number;
    paid_count: number;
    received_paise: number;
    received_count: number;
    net_paise: number;
    settled: boolean;
}

interface LedgerEntry {
    occurred_at: string;
    direction: "debit" | "credit";
    amount_paise: number;
    running_paise: number;
}

async function getPeople(): Promise<PersonBalance[]> {
    const { data } = await api.get<PersonBalance[]>("/analytics/people");
    return data;
}

async function getLedger(name: string): Promise<LedgerEntry[]> {
    const { data } = await api.get<LedgerEntry[]>(
        `/analytics/people/${encodeURIComponent(name)}`
    );
    return data;
}

export default function PeoplePage() {
    const [open, setOpen] = useState<string | null>(null);
    const people = useQuery({ queryKey: ["people"], queryFn: getPeople });

    if (people.isLoading) {
        return <p className="p-8 text-sm text-ink-3">Loading…</p>;
    }

    const rows = people.data ?? [];

    if (rows.length === 0) {
        return (
            <div className="px-8 py-7">
                <Card className="max-w-xl">
                    <p className="text-sm font-semibold">No two-way payments yet</p>
                    <p className="mt-1 text-sm text-ink-2">
                        This screen only shows people money has moved both ways with. A
                        shop you only pay is spending, not a balance.
                    </p>
                </Card>
            </div>
        );
    }

    const owedToYou = rows
        .filter((p) => !p.settled && p.net_paise > 0)
        .reduce((sum, p) => sum + p.net_paise, 0);
    const youOwe = rows
        .filter((p) => !p.settled && p.net_paise < 0)
        .reduce((sum, p) => sum - p.net_paise, 0);
    const settled = rows.filter((p) => p.settled).length;

    return (
        <div className="flex flex-col gap-5 px-8 py-7 pb-14">
            <div>
                <h1 className="mb-1.5 text-[30px] leading-tight font-semibold tracking-[-0.03em]">
                    Money with people
                </h1>
                <p className="text-[13.5px] text-ink-3">
                    Paid and received are netted, so a loan that came back is not counted
                    as spending.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Stat label="Owed to you" value={money(owedToYou)} />
                <Stat label="You owe" value={money(youOwe)} />
                <Stat
                    label="Settled"
                    value={`${settled} of ${rows.length}`}
                    hint="Balance under ₹500"
                    valueClass="text-good-ink"
                />
            </div>

            <Card className="p-0">
                {rows.map((p) => (
                    <div key={p.name} className="border-b border-line-soft last:border-b-0">
                        <button
                            type="button"
                            onClick={() => setOpen(open === p.name ? null : p.name)}
                            className="flex w-full cursor-pointer flex-wrap items-center gap-3 bg-transparent px-6 py-3.5 text-left"
                        >
                            <Avatar name={p.name} tone={p.settled ? "accent" : "warn"} />
                            <span className="min-w-0 flex-[999_1_180px] truncate text-sm">
                                {p.name}
                            </span>

                            <span className="shrink-0 font-mono text-[13px] text-ink-3">
                                out {money(p.paid_paise)} · in {money(p.received_paise)}
                            </span>

                            <span
                                className={cn(
                                    "w-24 shrink-0 text-right font-mono text-sm font-medium",
                                    p.net_paise >= 0 ? "text-good-ink" : "text-ink"
                                )}
                            >
                                {p.net_paise >= 0 ? "+" : "−"}
                                {money(Math.abs(p.net_paise))}
                            </span>

                            {p.settled ? (
                                <Badge tone="good">Settled</Badge>
                            ) : (
                                <Badge tone="warn">Open</Badge>
                            )}
                        </button>

                        {open === p.name && <Ledger name={p.name} />}
                    </div>
                ))}
            </Card>
        </div>
    );
}

function Ledger({ name }: { name: string }) {
    const ledger = useQuery({
        queryKey: ["ledger", name],
        queryFn: () => getLedger(name),
    });

    if (ledger.isLoading) {
        return <p className="px-6 pb-4 text-xs text-ink-3">Loading…</p>;
    }

    return (
        <ol className="flex list-none flex-col gap-1.5 px-6 pb-4">
            {(ledger.data ?? []).map((e, i) => (
                <li
                    key={i}
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-ground px-3.5 py-2.5"
                >
                    <span className="w-16 shrink-0 font-mono text-[12.5px] text-ink-3">
                        {shortDate(e.occurred_at)}
                    </span>
                    <span className="min-w-0 flex-[999_1_120px] text-[13.5px]">
                        {e.direction === "debit" ? "You paid" : "Came back"}
                    </span>
                    <span
                        className={cn(
                            "shrink-0 font-mono text-[13.5px]",
                            e.direction === "credit" ? "text-good-ink" : "text-ink"
                        )}
                    >
                        {money(e.amount_paise)}
                    </span>
                    {/* Running balance is the point: it shows a loan closing. */}
                    <span className="w-24 shrink-0 text-right font-mono text-[12.5px] text-ink-3">
                        {e.running_paise >= 0 ? "+" : "−"}
                        {money(Math.abs(e.running_paise))}
                    </span>
                </li>
            ))}
        </ol>
    );
}
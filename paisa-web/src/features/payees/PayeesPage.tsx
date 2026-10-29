import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import {
    CATEGORIES,
    type Category,
    type Payee,
    listPayees,
    recategorise,
    setPayeeCategory,
} from "../../api/payees";
import { cn } from "../../lib/cn";

type Filter = "all" | "llm" | "user";

export default function PayeesPage() {
    const qc = useQueryClient();
    const [filter, setFilter] = useState<Filter>("all");
    const [search, setSearch] = useState("");

    const payees = useQuery({ queryKey: ["payees"], queryFn: listPayees });

    const save = useMutation({
        mutationFn: ({ name, category }: { name: string; category: Category }) =>
            setPayeeCategory(name, category),
        onSuccess: (updated) => {
            // The category feeds every total on every screen, so drop the lot
            // rather than patching each cache by hand.
            qc.invalidateQueries();
            toast.success(`${updated.name} is now ${updated.category}`);
        },
        onError: () => toast.error("Could not save that"),
    });

    const rerun = useMutation({
        mutationFn: recategorise,
        onSuccess: (res) => {
            qc.invalidateQueries();
            toast.success(
                `${res.categorised} payees categorised, ${res.kept_from_user} of your own kept`
            );
        },
        onError: () => toast.error("Could not re-run"),
    });

    const rows = useMemo(() => {
        const all = payees.data ?? [];
        const q = search.trim().toLowerCase();
        return all
            .filter((p) => (filter === "all" ? true : p.source === filter))
            .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [payees.data, filter, search]);

    const corrected = (payees.data ?? []).filter((p) => p.source === "user").length;

    if (payees.isLoading) {
        return <p className="p-8 text-sm text-ink-3">Loading…</p>;
    }

    return (
        <div className="flex flex-col gap-5 px-8 py-7 pb-14">
            <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-0 grow">
                    <h1 className="mb-1.5 text-[30px] leading-tight font-semibold tracking-[-0.03em]">Payees</h1>
                    <p className="text-[13.5px] text-ink-3">
                        {payees.data?.length ?? 0} payees · {corrected} corrected by you
                    </p>
                </div>
                <Button
                    variant="secondary"
                    disabled={rerun.isPending}
                    onClick={() => rerun.mutate()}
                >
                    {rerun.isPending ? "Re-running…" : "Re-run the model"}
                </Button>
            </div>

            <Card>
                <p className="mb-1 text-sm font-semibold">Your answer wins</p>
                <p className="text-[13.5px] leading-relaxed text-ink-2">
                    The model reads each payee&rsquo;s payment pattern and guesses. It is
                    right most of the time and wrong often enough to matter. Change
                    anything that looks off — once you do, re-running the model leaves
                    that payee alone.
                </p>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
                {(["all", "llm", "user"] as Filter[]).map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={cn(
                            "min-h-11 cursor-pointer rounded-md border px-3.5 text-sm",
                            filter === f
                                ? "border-accent bg-accent-bg font-semibold text-accent-ink"
                                : "border-line bg-surface font-medium text-ink-2"
                        )}
                    >
                        {f === "all" ? "All" : f === "llm" ? "From the model" : "Yours"}
                    </button>
                ))}
                <label htmlFor="payee-search" className="sr-only">
                    Search payees
                </label>
                <input
                    id="payee-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search a name…"
                    className="min-h-11 min-w-0 flex-[999_1_200px] rounded-md border border-line bg-surface px-3.5 text-sm outline-none focus:border-accent"
                />
            </div>

            <Card className="p-0">
                <div className="flex flex-col">
                    {rows.map((p) => (
                        <PayeeRow
                            key={p.name}
                            payee={p}
                            saving={save.isPending && save.variables?.name === p.name}
                            onChange={(category) => save.mutate({ name: p.name, category })}
                        />
                    ))}
                    {rows.length === 0 && (
                        <p className="px-6 py-10 text-center text-sm text-ink-3">
                            Nothing matches that.
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
}

function PayeeRow({
    payee,
    saving,
    onChange,
}: {
    payee: Payee;
    saving: boolean;
    onChange: (category: Category) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-6 py-3 last:border-b-0">
            <span className="min-w-0 flex-[999_1_220px] truncate text-sm">
                {payee.name}
            </span>

            {payee.source === "user" ? (
                <Badge tone="good">Yours</Badge>
            ) : (
                <Badge tone="neutral">Model</Badge>
            )}

            <label htmlFor={`cat-${payee.name}`} className="sr-only">
                Category for {payee.name}
            </label>
            <select
                id={`cat-${payee.name}`}
                value={payee.category ?? ""}
                disabled={saving}
                onChange={(e) => onChange(e.target.value as Category)}
                className="min-h-11 w-40 shrink-0 rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-accent disabled:opacity-50"
            >
                {!payee.category && <option value="">Not set</option>}
                {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                        {c}
                    </option>
                ))}
            </select>
        </div>
    );
}
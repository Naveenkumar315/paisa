import { isAxiosError } from "axios";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable, { type Column } from "../../components/ui/DataTable";
import { errorMessage } from "../../api/client";
import { CATEGORIES } from "../../api/payees";
import { useAccounts, useTransactionList, useUpdateTransaction } from "../../api/queries";
import { TXN_TYPES, typeLabel, type TransactionQuery } from "../../api/transactions";
import { fullDate, moneyExact, timeOfDay } from "../../lib/format";
import type { ClassifiedTransaction, TxnType } from "../../types/api";

const PAGE = 50;

const TYPE_TONE: Record<TxnType, "neutral" | "accent" | "good" | "warn"> = {
    expense: "neutral",
    transfer_out: "accent",
    self_transfer: "neutral",
    income: "good",
    transfer_in: "good",
    refund: "good",
};

const field =
    "min-h-11 rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-accent";

/**
 * Filters live in the URL, not in component state, so any chart or KPI can
 * link straight to the transactions behind it: /transactions?category=food.
 */
export default function TransactionsPage() {
    const [params, setParams] = useSearchParams();
    const accounts = useAccounts();

    const query: TransactionQuery = useMemo(
        () => ({
            from: params.get("from") ?? undefined,
            to: params.get("to") ?? undefined,
            type: (params.get("type") as TxnType) ?? undefined,
            category: params.get("category") ?? undefined,
            account_id: params.get("account") ?? undefined,
            statement_id: params.get("statement") ?? undefined,
            q: params.get("q") ?? undefined,
            sort: (params.get("sort") as TransactionQuery["sort"]) ?? "newest",
            limit: PAGE,
            offset: Number(params.get("offset") ?? 0),
        }),
        [params]
    );

    const list = useTransactionList(query);
    const update = useUpdateTransaction();

    function setFilter(key: string, value: string) {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        // Any new filter starts again from the first page.
        if (key !== "offset") next.delete("offset");
        setParams(next, { replace: true });
    }

    function save(t: ClassifiedTransaction, patch: Parameters<typeof update.mutate>[0]["patch"]) {
        update.mutate(
            { id: t.id, patch },
            {
                onSuccess: (saved) =>
                    toast.success(`${saved.counterparty_raw}: ${typeLabel(saved.txn_type)}${
                        saved.category ? ` · ${saved.category}` : ""
                    }`),
                onError: (err) => toast.error(errorMessage(err)),
            }
        );
    }

    const accountName = useMemo(() => {
        const m = new Map<string, string>();
        for (const a of accounts.data ?? []) m.set(a.id, a.name);
        return m;
    }, [accounts.data]);

    const data = list.data;
    const offset = query.offset ?? 0;
    const filtered = [...params.keys()].some((k) => k !== "offset" && k !== "sort");

    const columns: Column<ClassifiedTransaction>[] = [
        {
            key: "date",
            header: "Date",
            cell: (t) => (
                <div className="whitespace-nowrap">
                    <p>{fullDate(t.occurred_at)}</p>
                    <p className="text-xs text-ink-3">{timeOfDay(t.occurred_at)}</p>
                </div>
            ),
        },
        {
            key: "payee",
            header: "Payee",
            cell: (t) => (
                <div className="min-w-0 max-w-[260px]">
                    <p className="truncate" title={t.counterparty_raw}>{t.counterparty_raw}</p>
                    <p className="truncate text-xs text-ink-3">
                        {t.account_id ? accountName.get(t.account_id) ?? `${t.bank} ··${t.account_last4}` : "No account"}
                        {t.notes ? ` · ${t.notes}` : ""}
                    </p>
                </div>
            ),
        },
        {
            key: "type",
            header: "Type",
            cell: (t) => (
                <TypeSelect t={t} disabled={update.isPending} onChange={(v) => save(t, { type_override: v })} />
            ),
        },
        {
            key: "category",
            header: "Category",
            cell: (t) => (
                <CategorySelect
                    t={t}
                    disabled={update.isPending}
                    onChange={(v) => save(t, { category_override: v })}
                />
            ),
        },
        {
            key: "amount",
            header: "Amount",
            align: "right",
            cell: (t) => (
                <span
                    className={
                        t.direction === "credit"
                            ? "font-medium whitespace-nowrap text-good-ink"
                            : "font-medium whitespace-nowrap"
                    }
                >
                    {t.direction === "credit" ? "+" : "−"}
                    {moneyExact(t.amount_paise)}
                </span>
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-5 px-8 py-7 pb-14">
            <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-0 grow">
                    <h1 className="mb-1.5 text-[30px] leading-tight font-semibold tracking-[-0.03em]">
                        Transactions
                    </h1>
                    <p className="text-[13.5px] text-ink-3">
                        {data ? (
                            <>
                                {data.total.toLocaleString("en-IN")} {filtered ? "matching" : "in total"} · out{" "}
                                {moneyExact(data.debit_paise)} · in {moneyExact(data.credit_paise)}
                            </>
                        ) : (
                            "Loading…"
                        )}
                    </p>
                </div>
                {filtered && (
                    <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
                        Clear filters
                    </Button>
                )}
            </div>

            <Card>
                <p className="mb-1 text-sm font-semibold">Every number starts here</p>
                <p className="text-[13.5px] leading-relaxed text-ink-2">
                    Each payment&rsquo;s type and category feed the dashboard and Ask. They come from
                    the payee&rsquo;s label; change one here and only that payment changes. The amount,
                    date and payee are what the statement says and cannot be edited.
                </p>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="txn-search" className="sr-only">Search payees</label>
                <input
                    id="txn-search"
                    // Remount when the URL changes underneath it (Clear filters).
                    key={query.q ?? ""}
                    defaultValue={query.q ?? ""}
                    // Search on Enter or when leaving the box, not on every key.
                    onKeyDown={(e) => {
                        if (e.key === "Enter") setFilter("q", e.currentTarget.value.trim());
                    }}
                    onBlur={(e) => setFilter("q", e.currentTarget.value.trim())}
                    placeholder="Search a payee…"
                    className={`${field} min-w-0 flex-[999_1_200px]`}
                />

                <label htmlFor="txn-type" className="sr-only">Type</label>
                <select
                    id="txn-type"
                    value={query.type ?? ""}
                    onChange={(e) => setFilter("type", e.target.value)}
                    className={field}
                >
                    <option value="">All types</option>
                    {TXN_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>

                <label htmlFor="txn-category" className="sr-only">Category</label>
                <select
                    id="txn-category"
                    value={query.category ?? ""}
                    onChange={(e) => setFilter("category", e.target.value)}
                    className={field}
                >
                    <option value="">All categories</option>
                    <option value="uncategorised">Uncategorised</option>
                    {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                <label htmlFor="txn-account" className="sr-only">Account</label>
                <select
                    id="txn-account"
                    value={query.account_id ?? ""}
                    onChange={(e) => setFilter("account", e.target.value)}
                    className={field}
                >
                    <option value="">All accounts</option>
                    {(accounts.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>

                <label htmlFor="txn-from" className="sr-only">From</label>
                <input
                    id="txn-from"
                    type="date"
                    value={query.from ?? ""}
                    onChange={(e) => setFilter("from", e.target.value)}
                    className={field}
                />
                <label htmlFor="txn-to" className="sr-only">To</label>
                <input
                    id="txn-to"
                    type="date"
                    value={query.to ?? ""}
                    onChange={(e) => setFilter("to", e.target.value)}
                    className={field}
                />

                <label htmlFor="txn-sort" className="sr-only">Sort</label>
                <select
                    id="txn-sort"
                    value={query.sort}
                    onChange={(e) => setFilter("sort", e.target.value === "newest" ? "" : e.target.value)}
                    className={field}
                >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="largest">Largest first</option>
                    <option value="smallest">Smallest first</option>
                </select>
            </div>

            {list.isError && (
                <Card tone="warn">
                    <p className="text-sm font-semibold">Could not load transactions</p>
                    <p className="mt-1 text-sm text-ink-2">
                        {errorMessage(list.error)}
                        {isAxiosError(list.error) && list.error.response?.status === 404 &&
                            " — the API running on port 8000 is older than this page. Restart it."}
                    </p>
                </Card>
            )}

            {/* No table on error: an empty table would read as "you have no
                transactions", which is a different and wrong message. */}
            {!list.isError && <Card className="px-4 py-2">
                {list.isLoading ? (
                    <p className="py-8 text-center text-sm text-ink-3">Loading…</p>
                ) : (
                    <DataTable
                        columns={columns}
                        rows={data?.items ?? []}
                        rowKey={(t) => t.id}
                        minWidth={820}
                        empty={filtered ? "Nothing matches these filters." : "No transactions yet. Import a statement from the dashboard."}
                    />
                )}
            </Card>}

            {data && data.total > PAGE && (
                <div className="flex items-center justify-end gap-3">
                    <p className="text-[13px] text-ink-3">
                        {offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total.toLocaleString("en-IN")}
                    </p>
                    <Button
                        variant="secondary"
                        disabled={offset === 0}
                        onClick={() => setFilter("offset", String(Math.max(0, offset - PAGE)))}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="secondary"
                        disabled={offset + PAGE >= data.total}
                        onClick={() => setFilter("offset", String(offset + PAGE))}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}

/** The automatic type, or the person's override. "Auto" clears the override. */
function TypeSelect({
    t,
    disabled,
    onChange,
}: {
    t: ClassifiedTransaction;
    disabled: boolean;
    onChange: (v: TxnType | null) => void;
}) {
    const options = TXN_TYPES.filter((x) => x.direction === "both" || x.direction === t.direction);
    return (
        <div className="flex items-center gap-2">
            <Badge tone={TYPE_TONE[t.txn_type]}>{typeLabel(t.txn_type)}</Badge>
            <label htmlFor={`type-${t.id}`} className="sr-only">Type for {t.counterparty_raw}</label>
            <select
                id={`type-${t.id}`}
                value={t.type_override ?? ""}
                disabled={disabled}
                onChange={(e) => onChange((e.target.value || null) as TxnType | null)}
                className="min-h-9 w-[118px] rounded-md border border-line bg-surface px-2 text-xs outline-none focus:border-accent disabled:opacity-50"
            >
                <option value="">{t.type_override ? "Auto" : "Auto ✓"}</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

/** The payee's category, or this payment's own. "From payee" clears the override. */
function CategorySelect({
    t,
    disabled,
    onChange,
}: {
    t: ClassifiedTransaction;
    disabled: boolean;
    onChange: (v: string | null) => void;
}) {
    const inherited = t.category_source === "payee" ? t.category : null;
    return (
        <>
            <label htmlFor={`cat-${t.id}`} className="sr-only">Category for {t.counterparty_raw}</label>
            <select
                id={`cat-${t.id}`}
                value={t.category_override ?? ""}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value || null)}
                className="min-h-9 w-[150px] rounded-md border border-line bg-surface px-2 text-xs outline-none focus:border-accent disabled:opacity-50"
            >
                <option value="">
                    {t.category_override ? "From payee" : `${inherited ?? "uncategorised"} (payee)`}
                </option>
                {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                ))}
            </select>
        </>
    );
}

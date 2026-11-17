import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import { ACCOUNT_TYPES } from "../../api/accounts";
import { errorMessage } from "../../api/client";
import { useAccounts, useUpdateAccount } from "../../api/queries";
import { fullDate, money } from "../../lib/format";
import type { Account } from "../../types/api";

export default function AccountsPage() {
    const accounts = useAccounts();

    if (accounts.isLoading) {
        return <p className="p-8 text-sm text-ink-3">Loading…</p>;
    }

    const rows = accounts.data ?? [];

    return (
        <div className="flex flex-col gap-5 px-8 py-7 pb-14">
            <div>
                <h1 className="mb-1.5 text-[30px] leading-tight font-semibold tracking-[-0.03em]">
                    Accounts
                </h1>
                <p className="text-[13.5px] text-ink-3">
                    {rows.length} {rows.length === 1 ? "account" : "accounts"} found in your statements
                </p>
            </div>

            <Card>
                <p className="mb-1 text-sm font-semibold">Why there is no balance</p>
                <p className="text-[13.5px] leading-relaxed text-ink-2">
                    A Google Pay statement names the bank account behind each payment, but never
                    what is in it. The figures below are money that moved through each account in
                    the statements you imported — not what the account holds. Balances arrive with
                    bank-statement import.
                </p>
            </Card>

            {accounts.isError && (
                <Card tone="warn">
                    <p className="text-sm">{errorMessage(accounts.error)}</p>
                </Card>
            )}

            {rows.length === 0 && !accounts.isError ? (
                <p className="py-8 text-center text-sm text-ink-3">
                    No accounts yet. They appear once a statement is imported.
                </p>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                    {rows.map((a) => (
                        <AccountCard key={a.id} account={a} />
                    ))}
                </div>
            )}
        </div>
    );
}

function AccountCard({ account: a }: { account: Account }) {
    const update = useUpdateAccount();

    function save(patch: Parameters<typeof update.mutate>[0]["patch"]) {
        update.mutate(
            { id: a.id, patch },
            {
                onSuccess: () => toast.success("Saved"),
                onError: (err) => toast.error(errorMessage(err)),
            }
        );
    }

    return (
        <Card className="flex flex-col gap-4">
            <div>
                <label htmlFor={`name-${a.id}`} className="sr-only">Account name</label>
                <input
                    id={`name-${a.id}`}
                    key={a.name}
                    defaultValue={a.name}
                    maxLength={60}
                    disabled={update.isPending}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    onBlur={(e) => {
                        const name = e.currentTarget.value.trim();
                        if (name !== a.name) save({ name: name || null });
                    }}
                    className="-mx-2 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold tracking-[-0.02em] outline-none hover:border-line focus:border-accent"
                />
                <p className="text-[13px] text-ink-3">
                    {a.institution} ··{a.last4} · {a.currency}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <label htmlFor={`type-${a.id}`} className="sr-only">Account type</label>
                <select
                    id={`type-${a.id}`}
                    value={a.account_type}
                    disabled={update.isPending}
                    onChange={(e) => save({ account_type: e.target.value })}
                    className="min-h-9 rounded-md border border-line bg-surface px-2 text-sm outline-none focus:border-accent disabled:opacity-50"
                >
                    {ACCOUNT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
                {!a.is_active && <Badge tone="warn">Inactive</Badge>}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                    <dt className="text-xs text-ink-3">Paid out</dt>
                    <dd className="font-medium">{money(a.debit_paise)}</dd>
                </div>
                <div>
                    <dt className="text-xs text-ink-3">Received</dt>
                    <dd className="font-medium text-good-ink">+{money(a.credit_paise)}</dd>
                </div>
                <div>
                    <dt className="text-xs text-ink-3">Payments</dt>
                    <dd className="font-medium">{a.txn_count.toLocaleString("en-IN")}</dd>
                </div>
                <div>
                    <dt className="text-xs text-ink-3">Seen</dt>
                    <dd className="font-medium">
                        {a.first_txn_at && a.last_txn_at
                            ? `${fullDate(a.first_txn_at)} – ${fullDate(a.last_txn_at)}`
                            : "—"}
                    </dd>
                </div>
            </dl>

            <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-3">
                <Link
                    to={`/transactions?account=${a.id}`}
                    className="text-sm font-semibold text-accent no-underline hover:underline"
                >
                    View transactions
                </Link>
                <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() => save({ is_active: !a.is_active })}
                    className="cursor-pointer text-[13px] font-medium text-ink-3 hover:text-ink disabled:opacity-50"
                >
                    {a.is_active ? "Mark inactive" : "Mark active"}
                </button>
            </div>
        </Card>
    );
}

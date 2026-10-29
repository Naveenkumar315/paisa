import { Link } from "react-router-dom";

import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import DataTable, { type Column } from "../../components/ui/DataTable";
import { cn } from "../../lib/cn";
import { money } from "../../lib/format";
import type { PayeeSummary } from "../../types/api";

const columns: Column<PayeeSummary>[] = [
  {
    key: "name",
    header: "Payee",
    cell: (p) => (
      <span className="flex items-center gap-2.5">
        <Avatar name={p.name} tone={p.category ? "accent" : "warn"} />
        <span>{p.name}</span>
      </span>
    ),
  },
  {
    key: "category",
    header: "Category",
    cell: (p) =>
      p.category ? (
        <Badge tone="accent">{p.category}</Badge>
      ) : (
        <Badge tone="warn">Needs label</Badge>
      ),
  },
  {
    key: "count",
    header: "Times",
    align: "right",
    className: "font-mono",
    cell: (p) => p.count,
  },
  {
    key: "avg",
    header: "Average",
    align: "right",
    className: "font-mono text-ink-2",
    cell: (p) => money(p.avg_paise),
  },
  {
    key: "total",
    header: "Total",
    align: "right",
    className: "font-mono",
    cell: (p) => money(p.total_paise),
  },
];

export type PayeeScope = "month" | "all";

const SCOPES: { value: PayeeScope; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "all", label: "All months" },
];

export default function PayeeTable({
  payees,
  scope,
  onScopeChange,
}: {
  payees: PayeeSummary[];
  scope: PayeeScope;
  onScopeChange: (scope: PayeeScope) => void;
}) {
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold tracking-[-0.015em]">Most frequent payees</h2>
        <div className="flex grow gap-1.5" role="group" aria-label="Payee period">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={scope === s.value}
              onClick={() => onScopeChange(s.value)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 text-[12.5px]",
                scope === s.value
                  ? "border-accent bg-accent-bg font-semibold text-accent-ink"
                  : "border-line bg-surface font-medium text-ink-3"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Link to="/payees" className="text-[13.5px] font-semibold text-accent">
          All payees
        </Link>
      </div>
      <DataTable
        columns={columns}
        rows={payees}
        rowKey={(p) => p.name}
        empty={
          scope === "month"
            ? "No payments to payees this month"
            : "Upload a statement to see your payees"
        }
      />
    </Card>
  );
}
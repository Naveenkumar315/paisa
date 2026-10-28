import { Link } from "react-router-dom";

import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import DataTable, { type Column } from "../../components/ui/DataTable";
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

export default function PayeeTable({ payees }: { payees: PayeeSummary[] }) {
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h2 className="grow text-[15px] font-semibold">Most frequent payees</h2>
        <Link to="/payees" className="text-[13.5px] font-semibold text-accent">
          All payees
        </Link>
      </div>
      <DataTable
        columns={columns}
        rows={payees}
        rowKey={(p) => p.name}
        empty="Upload a statement to see your payees"
      />
    </Card>
  );
}
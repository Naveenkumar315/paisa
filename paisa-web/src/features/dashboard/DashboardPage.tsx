import Card from "../../components/ui/Card";
import Stat from "../../components/ui/Stat";
import { useCategories, useClock, useMonth, useMonths, usePayees } from "../../api/queries";
import { money, monthLabel } from "../../lib/format";
import { useUiStore } from "../../stores/ui";
import StatementUpload from "../statements/StatementUpload";

import CategoryBreakdown from "./CategoryBreakdown";
import ClockPanel from "./ClockPanel";
import MonthChart from "./MonthChart";
import PayeeTable from "./PayeeTable";

export default function DashboardPage() {
  const picked = useUiStore((s) => s.selectedMonth);
  const setSelectedMonth = useUiStore((s) => s.setSelectedMonth);

  const months = useMonths();

  // The month must come from the data, never from a constant. A hardcoded
  // "2026-09" 404s the moment the statement covers a different period.
  const available = months.data ?? [];
  const latest = available.at(-1)?.month ?? "";
  const month = picked && available.some((m) => m.month === picked) ? picked : latest;

  const summary = useMonth(month);
  const categories = useCategories(month);
  const clock = useClock();
  const payees = usePayees(6);

  if (months.isLoading) {
    return <p className="p-8 text-sm text-ink-3">Loading…</p>;
  }

  if (months.isError) {
    return (
      <div className="p-8">
        <Card tone="warn" className="max-w-xl">
          <p className="text-sm font-semibold">Could not reach the API</p>
          <p className="mt-1 text-sm text-ink-2">
            Check the backend is running on port 8000.
          </p>
        </Card>
      </div>
    );
  }

  // No statement imported yet. Not an error — the first thing to do.
  if (available.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-16">
        <StatementUpload />
      </div>
    );
  }

  if (summary.isLoading || !summary.data) {
    return <p className="p-8 text-sm text-ink-3">Loading…</p>;
  }

  const m = summary.data;
  const average =
    available.reduce((sum, x) => sum + x.spending_paise, 0) / available.length;
  const index = available.findIndex((x) => x.month === m.month);
  const previous = index > 0 ? available[index - 1] : undefined;
  const change =
    previous && previous.spending_paise > 0
      ? Math.round(
        ((m.spending_paise - previous.spending_paise) / previous.spending_paise) * 100
      )
      : null;

  return (
    <div className="flex flex-col gap-5 px-8 py-7 pb-14">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 grow">
          <h1 className="mb-1 text-2xl font-bold tracking-tight">
            {monthLabel(`${m.month}-01`)}
          </h1>
          <p className="text-[13.5px] text-ink-3">{m.txn_count} payments</p>
        </div>
        <StatementUpload variant="inline" />
      </div>

      <div className="flex flex-wrap gap-4">
        <Card className="min-w-0 flex-[999_1_420px]">
          <div className="mb-5 flex flex-wrap items-start gap-4">
            <div className="min-w-0 grow">
              <p className="mb-1.5 text-[13px] font-medium text-ink-3">
                Everyday spending
              </p>
              <p className="mb-2.5 font-mono text-[38px] leading-none tracking-tighter">
                {money(m.spending_paise)}
              </p>
              {change !== null && (
                <span
                  className={
                    change <= 0
                      ? "inline-flex rounded-full bg-good-bg px-2.5 py-1 text-[12.5px] font-semibold text-good-ink"
                      : "inline-flex rounded-full bg-warn-bg px-2.5 py-1 text-[12.5px] font-semibold text-warn-ink"
                  }
                >
                  {change <= 0 ? `${Math.abs(change)}% below` : `${change}% above`} last
                  month
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="mb-1 text-xs text-ink-3">Average</p>
              <p className="font-mono text-lg">{money(average)}</p>
            </div>
          </div>

          <MonthChart months={available} selected={m.month} onSelect={setSelectedMonth} />

          <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
            Transfers and self-transfers are excluded from every bar, so the
            months compare like with like.
          </p>
        </Card>

        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
          <Stat
            label="Transfers out"
            value={money(m.transfers_paise)}
            hint="Person-to-person, not purchases"
          />
          <Stat
            label="Received"
            value={`+${money(m.received_paise)}`}
            hint="Credits this month"
            valueClass="text-good-ink"
          />
          <Stat
            label="Self-transfers"
            value={money(m.self_transfer_paise)}
            hint="Between your own accounts · not counted"
            valueClass="text-ink-2"
          />
        </div>
      </div>

      {m.transfers_paise > m.spending_paise && (
        <Card tone="warn">
          <p className="mb-1 text-sm font-semibold">
            {money(m.transfers_paise)} of this month went to people, not shops
          </p>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Counted as spending, this month would read{" "}
            {money(m.spending_paise + m.transfers_paise)} and every other month
            would look cheap beside it.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        {categories.data && categories.data.length > 0 && (
          <CategoryBreakdown slices={categories.data} total={m.spending_paise} />
        )}
        {clock.data && <ClockPanel buckets={clock.data} />}
      </div>

      {payees.data && payees.data.length > 0 && <PayeeTable payees={payees.data} />}
    </div>
  );
}
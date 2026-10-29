import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import Card from "../../components/ui/Card";
import Stat from "../../components/ui/Stat";
import { api } from "../../api/client";
import { useCategories, useClock, useMonth, useMonths, usePayees } from "../../api/queries";
import { money, monthLabel } from "../../lib/format";
import { useUiStore } from "../../stores/ui";
import StatementUpload from "../statements/StatementUpload";

import CategoryDonut from "./CategoryDonut";
import CategoryTrend, { type TrendRow } from "./CategoryTrend";
import ClockPanel from "./ClockPanel";
import LabelsToggle from "./LabelsToggle";
import MobileSpend, { type RechargeRow } from "./MobileSpend";
import PayeeTable, { type PayeeScope } from "./PayeeTable";
import SpendHeatmap, { type DayRow } from "./SpendHeatmap";
import SpendTrend from "./SpendTrend";
import TransferTrend from "./TransferTrend";

async function getDaily(): Promise<DayRow[]> {
  const { data } = await api.get<DayRow[]>("/analytics/daily");
  return data;
}

async function getTrend(): Promise<TrendRow[]> {
  const { data } = await api.get<TrendRow[]>("/analytics/category-trend");
  return data;
}

async function getRecharges(): Promise<RechargeRow[]> {
  const { data } = await api.get<RechargeRow[]>("/analytics/mobile-recharges");
  return data;
}

export default function DashboardPage() {
  const picked = useUiStore((s) => s.selectedMonth);
  const setSelectedMonth = useUiStore((s) => s.setSelectedMonth);
  const [payeeScope, setPayeeScope] = useState<PayeeScope>("month");

  const months = useMonths();

  // The month comes from the data, never a constant — a hardcoded
  // "2026-09" 404s the moment the statement covers a different period.
  const available = months.data ?? [];
  const latest = available.at(-1)?.month ?? "";
  const month = picked && available.some((m) => m.month === picked) ? picked : latest;

  const summary = useMonth(month);
  const categories = useCategories(month);
  const clock = useClock();
  const payees = usePayees(6, payeeScope === "month" ? month : undefined);
  const daily = useQuery({ queryKey: ["daily"], queryFn: getDaily });
  const trend = useQuery({ queryKey: ["trend"], queryFn: getTrend });
  const recharges = useQuery({ queryKey: ["recharges"], queryFn: getRecharges });

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

  if (available.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-16">
        <StatementUpload />
      </div>
    );
  }

  if (!summary.data) {
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
          <h1 className="mb-1.5 text-[30px] leading-tight font-semibold tracking-[-0.03em]">
            {monthLabel(`${m.month}-01`)}
          </h1>
          <p className="text-[13.5px] text-ink-3">
            {m.txn_count} payments · click any month on the chart
          </p>
        </div>
        <LabelsToggle />
        <StatementUpload variant="inline" />
      </div>

      <div className="flex flex-wrap gap-4">
        <Card className="min-w-0 flex-[999_1_460px]">
          <div className="mb-4 flex flex-wrap items-start gap-4">
            <div className="min-w-0 grow">
              <p className="mb-1.5 text-[13px] font-medium text-ink-3">
                Spending
              </p>
              <p className="mb-3 text-[46px] leading-none font-medium tracking-[-0.04em]">
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
                  {change <= 0 ? `${Math.abs(change)}% below` : `${change}% above`}{" "}
                  last month
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="mb-1 text-xs text-ink-3">Six-month average</p>
              <p className="text-xl font-medium tracking-[-0.02em]">{money(average)}</p>
            </div>
          </div>

          <SpendTrend
            months={available}
            selected={month}
            onSelect={setSelectedMonth}
          />
        </Card>

        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-4">
          <Stat
            label="Transfers out"
            value={money(m.transfers_paise)}
            hint="Sent to people · included in spending"
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

      {/* spending_paise already includes transfers, so the shop-only
          figure is the difference. Flag the month when people outweigh it. */}
      {m.transfers_paise * 2 > m.spending_paise && (
        <Card tone="warn">
          <p className="mb-1 text-sm font-semibold">
            {money(m.transfers_paise)} of this month went to people, not shops
          </p>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            That is more than half of the {money(m.spending_paise)} spent. Shops
            and services took {money(m.spending_paise - m.transfers_paise)}.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        {categories.data && categories.data.length > 0 && (
          <CategoryDonut slices={categories.data} />
        )}
        {trend.data && trend.data.length > 0 && <CategoryTrend rows={trend.data} />}
      </div>

      {/* Their own row, so the wrap above can never split them. Side by side
          from lg up; stacked below that, where the two would be too narrow. */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 lg:w-[34%]">
          <TransferTrend months={available} selected={month} onSelect={setSelectedMonth} />
        </div>
        {trend.data && trend.data.length > 0 && (
          <div className="flex min-w-0 flex-1">
            <MobileSpend
              rows={trend.data}
              recharges={recharges.data ?? []}
              selected={month}
              onSelect={setSelectedMonth}
            />
          </div>
        )}
      </div>

      {daily.data && daily.data.length > 0 && <SpendHeatmap days={daily.data} />}

      <div className="flex flex-wrap gap-4">
        {/* Rendered even when a month has no payees, or the toggle would
            vanish and strand the user on an empty month. */}
        {payees.data && (
          <div className="min-w-0 flex-[999_1_460px]">
            <PayeeTable
              payees={payees.data}
              scope={payeeScope}
              onScopeChange={setPayeeScope}
            />
          </div>
        )}
        {clock.data && <ClockPanel buckets={clock.data} />}
      </div>
    </div>
  );
}
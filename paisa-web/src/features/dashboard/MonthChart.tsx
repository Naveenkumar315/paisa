import { cn } from "../../lib/cn";
import { compact } from "../../lib/format";
import type { MonthSummary } from "../../types/api";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortMonth(key: string): string {
  return SHORT[Number(key.slice(5, 7)) - 1] ?? key;
}

export default function MonthChart({
  months,
  selected,
  onSelect,
}: {
  months: MonthSummary[];
  selected: string;
  onSelect: (month: string) => void;
}) {
  // Scale to the tallest bar, never to a fixed ceiling — one big month
  // would otherwise flatten the rest into invisible slivers.
  const peak = Math.max(...months.map((m) => m.spending_paise), 1);

  return (
    <div>
      <div className="flex h-44 items-end gap-2.5 border-b border-line">
        {months.map((m) => {
          const isSelected = m.month === selected;
          const height = Math.max(6, Math.round((m.spending_paise / peak) * 142));
          return (
            <button
              key={m.month}
              type="button"
              onClick={() => onSelect(m.month)}
              aria-pressed={isSelected}
              className="flex h-full min-w-0 flex-1 cursor-pointer flex-col items-end justify-end gap-2 bg-transparent p-0"
            >
              <span className="w-full text-center font-mono text-[11.5px] text-ink-2">
                {compact(m.spending_paise)}
              </span>
              {/* Height is computed at runtime, so it has to be an inline
                  style — Tailwind generates classes at build time and
                  w-[${n}%] simply never exists. */}
              <span
                className={cn(
                  "w-full rounded-t-md transition-colors",
                  isSelected ? "bg-accent" : "bg-[#C9D0E4] hover:bg-[#B4BEDC]"
                )}
                style={{ height }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2.5">
        {months.map((m) => (
          <span
            key={m.month}
            className={cn(
              "min-w-0 flex-1 text-center text-xs font-medium",
              m.month === selected ? "text-ink" : "text-ink-3"
            )}
          >
            {shortMonth(m.month)}
          </span>
        ))}
      </div>
    </div>
  );
}
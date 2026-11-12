import Card from "../../components/ui/Card";
import { money } from "../../lib/format";
import type { CategorySlice } from "../../types/api";
import { colorFor } from "./chartTheme";

export default function CategoryBreakdown({
  slices,
  total,
}: {
  slices: CategorySlice[];
  total: number;
}) {
  return (
    <Card className="min-w-0 flex-[999_1_400px]">
      <h2 className="mb-4 text-base font-semibold tracking-[-0.015em]">
        Where the {money(total)} went
      </h2>

      <div className="mb-4.5 flex h-3.5 overflow-hidden rounded-full">
        {slices.map((s) => (
          <span
            key={s.name}
            style={{ width: `${s.pct}%`, backgroundColor: colorFor(s.name) }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {slices.map((s) => (
          <div key={s.name} className="flex items-baseline gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: colorFor(s.name) }}
            />
            <span className="min-w-0 grow text-sm font-medium">{s.name}</span>
            <span className="text-[13px] text-ink-3">{s.pct}%</span>
            <span className="w-16 text-right font-mono text-sm">
              {money(s.amount_paise)}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4.5 border-t border-line-soft pt-4 text-[13px] leading-relaxed text-ink-3">
        Categories come from the model reading each payee&rsquo;s payment
        pattern. Any one of them can be corrected, and a correction is never
        overwritten.
      </p>
    </Card>
  );
}
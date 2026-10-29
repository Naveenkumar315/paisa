import BarRow from "../../components/ui/BarRow";
import Card from "../../components/ui/Card";
import { money } from "../../lib/format";
import type { ClockBucket } from "../../types/api";

const SHADES = ["#2D4BBF", "#5E78D8", "#9FB0E8", "#C9D0E4"];

export default function ClockPanel({ buckets }: { buckets: ClockBucket[] }) {
  const sorted = [...buckets].sort((a, b) => b.count - a.count);
  const peak = Math.max(...sorted.map((b) => b.count), 1);
  const total = sorted.reduce((sum, b) => sum + b.count, 0);

  return (
    <Card className="min-w-0 flex-[1_1_280px]">
      <h2 className="mb-1 text-base font-semibold tracking-[-0.015em]">When you spend</h2>
      <p className="mb-4.5 text-[13px] text-ink-3">
        {total} payments, all months combined
      </p>

      <div className="flex flex-col gap-3.5">
        {sorted.map((b, i) => (
          <BarRow
            key={b.bucket}
            label={b.bucket}
            value={`${b.count} · ${money(b.amount_paise)}`}
            pct={(b.count / peak) * 100}
            color={SHADES[i] ?? SHADES[SHADES.length - 1]}
          />
        ))}
      </div>

      <p className="mt-4.5 border-t border-line-soft pt-4 text-[13px] leading-relaxed text-ink-3">
        This pattern is also what the model reads when a payee&rsquo;s name
        tells it nothing.
      </p>
    </Card>
  );
}
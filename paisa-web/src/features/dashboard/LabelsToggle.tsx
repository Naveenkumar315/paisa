import { cn } from "../../lib/cn";
import { useUiStore } from "../../stores/ui";

export default function LabelsToggle() {
  const on = useUiStore((s) => s.showChartLabels);
  const setOn = useUiStore((s) => s.setShowChartLabels);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-medium text-ink-3">Chart labels</span>
      <div className="flex gap-1.5" role="group" aria-label="Chart labels">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={on === value}
            onClick={() => setOn(value)}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 text-[12.5px]",
              on === value
                ? "border-accent bg-accent-bg font-semibold text-accent-ink"
                : "border-line bg-surface font-medium text-ink-3"
            )}
          >
            {value ? "On" : "Off"}
          </button>
        ))}
      </div>
    </div>
  );
}

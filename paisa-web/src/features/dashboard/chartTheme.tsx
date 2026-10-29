import { money } from "../../lib/format";

/** One hue per category, used by every chart so a colour means the same
 *  thing on the donut, the trend and the legend. */
export const CATEGORY_COLORS: Record<string, string> = {
    food: "#2D4BBF",
    groceries: "#0F6E68",
    travel: "#C98A2B",
    mobile: "#9FB0E8",
    shopping: "#6B82DC",
    health: "#B5453C",
    other: "#8E95A6",
    uncategorised: "#C9D0E4",
    transfer: "#5A6070",
};

export const ACCENT = "#2D4BBF";
export const GRID = "#EDEFF4";
export const AXIS = "#5A6070";

export function colorFor(name: string): string {
    return CATEGORY_COLORS[name.toLowerCase()] ?? CATEGORY_COLORS.other;
}

export const MONTH_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function monthTick(key: string): string {
    return MONTH_SHORT[Number(key.slice(5, 7)) - 1] ?? key;
}

type TooltipRow = { name: string; value: number; color?: string };

/** Recharts' default tooltip ignores the app's type and spacing, and
 *  prints raw paise. This one speaks rupees. */
export function ChartTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: TooltipRow[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;

    const rows = payload.filter((r) => r.value > 0);
    const total = rows.reduce((sum, r) => sum + r.value, 0);

    return (
        <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
            {label && (
                <p className="mb-1.5 text-xs font-semibold text-ink">
                    {label.length === 7 ? monthTick(label) : label}
                </p>
            )}
            {rows.map((r) => (
                <p key={r.name} className="flex items-center gap-2 text-xs text-ink-2">
                    <span
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: r.color ?? ACCENT }}
                    />
                    <span className="grow capitalize">{r.name}</span>
                    <span className="font-mono">{money(r.value)}</span>
                </p>
            ))}
            {rows.length > 1 && (
                <p className="mt-1.5 flex gap-2 border-t border-line-soft pt-1.5 text-xs font-semibold">
                    <span className="grow">Total</span>
                    <span className="font-mono">{money(total)}</span>
                </p>
            )}
        </div>
    );
}
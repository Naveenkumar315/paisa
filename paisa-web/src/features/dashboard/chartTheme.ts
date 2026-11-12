import { compact } from "../../lib/format";

/** One hue per category, used by every chart so a colour means the same
 *  thing on the donut, the trend and the legend. */
export const CATEGORY_COLORS: Record<string, string> = {
    health: "var(--chart-health)",
    travel: "var(--chart-travel)",
    shopping: "var(--chart-shopping)",
    transfer: "var(--chart-transfer)",
    groceries: "var(--chart-groceries)",
    mobile: "var(--chart-mobile)",
    food: "var(--chart-food)",
    other: "var(--chart-other)",
    uncategorised: "var(--chart-uncategorised)",
};

/** The order categories are drawn in, on every chart. The palette was
 *  validated for colour-blind separation between neighbours in exactly
 *  this order (values in index.css), so stacks and the donut must not
 *  re-sort by size, and reordering here means re-running the validator. */
export const CATEGORY_ORDER = Object.keys(CATEGORY_COLORS);

export function categoryRank(name: string): number {
    const i = CATEGORY_ORDER.indexOf(name.toLowerCase());
    return i === -1 ? CATEGORY_ORDER.length : i;
}

export const ACCENT = "var(--chart-accent)";
export const GRID = "var(--chart-grid)";
export const AXIS = "var(--chart-axis)";

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

/** Value labels drawn on the charts when the dashboard's Labels switch is
 *  on. Text ink, never the series colour, so a label reads on any fill. */
export const LABEL_STYLE = { fill: "var(--chart-label)", fontSize: 11, fontWeight: 500 };

/** Compact rupees for a value label; blank for zero so empty months stay
 *  clean. Takes unknown because Recharts hands labels over untyped. */
export function labelCompact(value: unknown): string {
    const n = Number(value);
    return n > 0 ? compact(n) : "";
}

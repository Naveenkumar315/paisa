import { compact } from "../../lib/format";

/** One hue per category, used by every chart so a colour means the same
 *  thing on the donut, the trend and the legend. */
export const CATEGORY_COLORS: Record<string, string> = {
    transfer: "#5E5650",
    food: "#3A62B0",
    groceries: "#4E8A5A",
    travel: "#DDAA45",
    shopping: "#C0664A",
    health: "#24676A",
    mobile: "#8059B8",
    other: "#A39E92",
    uncategorised: "#D6D2C8",
};

/** The order categories are drawn in, on every chart. The colours were
 *  checked for colour-blind separation as neighbours in exactly this
 *  order (ochre sits away from terracotta, plum away from stone),
 *  so stacks and the donut must not re-sort by size. */
export const CATEGORY_ORDER = Object.keys(CATEGORY_COLORS);

export function categoryRank(name: string): number {
    const i = CATEGORY_ORDER.indexOf(name.toLowerCase());
    return i === -1 ? CATEGORY_ORDER.length : i;
}

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

/** Value labels drawn on the charts when the dashboard's Labels switch is
 *  on. Text ink, never the series colour, so a label reads on any fill. */
export const LABEL_STYLE = { fill: "#4B5160", fontSize: 11, fontWeight: 500 };

/** Compact rupees for a value label; blank for zero so empty months stay
 *  clean. Takes unknown because Recharts hands labels over untyped. */
export function labelCompact(value: unknown): string {
    const n = Number(value);
    return n > 0 ? compact(n) : "";
}

const rupees = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
});

const rupeesExact = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
});

/** 604800 -> "₹6,048" */
export function money(paise: number): string {
    return rupees.format(paise / 100);
}

/** 17125 -> "₹171.25" */
export function moneyExact(paise: number): string {
    return rupeesExact.format(paise / 100);
}

/** 6048000 -> "60.5k" — chart labels */
export function compact(paise: number): string {
    const r = paise / 100;
    if (r >= 100000) return `${(r / 100000).toFixed(1)}L`;
    if (r >= 1000) return `${(r / 1000).toFixed(1)}k`;
    return String(Math.round(r));
}

const day = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });
const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

export function shortDate(iso: string): string {
    return day.format(new Date(iso));
}

export function monthLabel(iso: string): string {
    return monthYear.format(new Date(iso));
}
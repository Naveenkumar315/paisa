export default function BarRow({
    label,
    value,
    pct,
    color = "var(--color-accent)",
}: {
    label: string;
    value: string;
    pct: number;
    color?: string;
}) {
    const width = Math.max(0, Math.min(100, pct));
    return (
        <div>
            <div className="mb-1.5 flex justify-between gap-3">
                <span className="text-[13.5px] font-medium">{label}</span>
                <span className="font-mono text-[13px] text-ink-2">{value}</span>
            </div>
            <div
                className="h-2 overflow-hidden rounded-full bg-line-soft"
                role="img"
                aria-label={`${label}: ${value}`}
            >
                <div
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}
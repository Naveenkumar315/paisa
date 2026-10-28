import { cn } from "../../lib/cn";

const tones = {
    accent: "bg-accent-bg text-accent-ink",
    warn: "bg-warn-bg text-warn-ink",
} as const;

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
    name,
    tone = "accent",
}: {
    name: string;
    tone?: keyof typeof tones;
}) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-flex size-[30px] shrink-0 items-center justify-center rounded-[9px] text-xs font-semibold",
                tones[tone]
            )}
        >
            {initials(name)}
        </span>
    );
}
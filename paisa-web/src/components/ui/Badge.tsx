import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const tones = {
    neutral: "bg-line-soft text-ink-2",
    accent: "bg-accent-bg text-accent-ink",
    warn: "bg-warn-bg text-warn-ink",
    good: "bg-good-bg text-good-ink",
} as const;

export default function Badge({
    children,
    tone = "neutral",
}: {
    children: ReactNode;
    tone?: keyof typeof tones;
}) {
    return (
        <span
            className={cn(
                "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                tones[tone]
            )}
        >
            {children}
        </span>
    );
}
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export default function Card({
    children,
    tone = "plain",
    className,
}: {
    children: ReactNode;
    tone?: "plain" | "warn";
    className?: string;
}) {
    return (
        <section
            className={cn(
                "rounded-2xl border bg-surface px-6 py-5 shadow-card",
                tone === "warn" ? "border-warn-line" : "border-line",
                className
            )}
        >
            {children}
        </section>
    );
}
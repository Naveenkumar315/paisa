import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import Card from "./Card";

export default function Stat({
    label,
    value,
    hint,
    icon,
    valueClass,
}: {
    label: string;
    value: string;
    hint?: string;
    icon?: ReactNode;
    valueClass?: string;
}) {
    return (
        <Card className="px-5 py-5">
            <div className="mb-2.5 flex items-center gap-2">
                {icon}
                <p className="text-[13px] font-medium text-ink-3">{label}</p>
            </div>
            <p className={cn("mb-1.5 font-mono text-[26px] tracking-tight", valueClass)}>
                {value}
            </p>
            {hint && <p className="text-[13px] text-ink-3">{hint}</p>}
        </Card>
    );
}
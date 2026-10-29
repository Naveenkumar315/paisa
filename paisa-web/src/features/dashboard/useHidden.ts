import { useState } from "react";

/** Series the viewer has clicked off in one chart's legend. Local to the
 *  chart: hiding Food in the trend should not hide it in the donut. */
export function useHidden() {
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

    const toggle = (key: string) =>
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    return { hidden, toggle };
}

/** Legend item styling: a hidden series stays listed, faded and struck
 *  through, so it can be clicked back on. */
export function legendItemClass(isHidden: boolean): string {
    return isHidden ? "opacity-40 line-through" : "";
}

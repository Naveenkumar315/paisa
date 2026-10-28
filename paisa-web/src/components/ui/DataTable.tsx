import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type Column<T> = {
    key: string;
    header: string;
    align?: "left" | "right";
    cell: (row: T) => ReactNode;
    className?: string;
};

export default function DataTable<T>({
    columns,
    rows,
    rowKey,
    minWidth = 560,
    empty = "Nothing here yet",
}: {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    minWidth?: number;
    empty?: string;
}) {
    if (rows.length === 0) {
        return <p className="py-8 text-center text-sm text-ink-3">{empty}</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth }}>
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                scope="col"
                                className={cn(
                                    "border-b border-line px-2 pt-3 pb-2.5 text-xs font-semibold text-ink-3",
                                    c.align === "right" ? "text-right" : "text-left"
                                )}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={rowKey(row)}>
                            {columns.map((c) => (
                                <td
                                    key={c.key}
                                    className={cn(
                                        "border-b border-line-soft px-2 py-3 text-sm",
                                        c.align === "right" && "text-right",
                                        c.className
                                    )}
                                >
                                    {c.cell(row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
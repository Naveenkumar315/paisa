import { useQuery } from "@tanstack/react-query";

import { getTrace } from "../../api/ask";
import { cn } from "../../lib/cn";

const KIND_STYLE: Record<string, string> = {
    tool: "bg-accent-bg text-accent-ink",
    retry: "bg-warn-bg text-warn-ink",
    answer: "bg-line-soft text-ink-2",
};

export default function TracePanel({ runId }: { runId: string }) {
    // enabled stays true only once opened, so a closed panel costs nothing.
    const trace = useQuery({
        queryKey: ["trace", runId],
        queryFn: () => getTrace(runId),
    });

    if (trace.isLoading) {
        return <p className="mt-3 text-xs text-ink-3">Loading steps…</p>;
    }
    if (!trace.data) {
        return <p className="mt-3 text-xs text-ink-3">Could not load the trace.</p>;
    }

    const { trace: steps, steps: count, tokens, duration_ms } = trace.data;

    return (
        <div className="mt-3 flex flex-col gap-2">
            <p className="font-mono text-xs text-ink-3">
                {count} steps · {tokens.toLocaleString()} tokens · {(duration_ms / 1000).toFixed(1)}s
            </p>

            {steps.map((s, i) => (
                <div key={i} className="rounded-lg bg-ground px-3 py-2.5">
                    <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-[11px] text-ink-3">
                            step {s.step_no}
                        </span>
                        <span
                            className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                KIND_STYLE[s.kind] ?? KIND_STYLE.answer
                            )}
                        >
                            {s.kind}
                        </span>
                        {s.tool_name && (
                            <code className="font-mono text-xs text-accent-ink">
                                {s.tool_name}
                            </code>
                        )}
                        {s.duration_ms > 0 && (
                            <span className="ml-auto font-mono text-[11px] text-ink-3">
                                {s.duration_ms}ms
                            </span>
                        )}
                    </div>

                    {s.arguments && Object.keys(s.arguments).length > 0 && (
                        <pre className="overflow-x-auto font-mono text-[11.5px] leading-relaxed text-ink-2">
                            {JSON.stringify(s.arguments)}
                        </pre>
                    )}

                    {s.result && (
                        <pre className="mt-1 max-h-32 overflow-auto font-mono text-[11.5px] leading-relaxed text-ink-3">
                            {JSON.stringify(s.result, null, 2)}
                        </pre>
                    )}
                </div>
            ))}
        </div>
    );
}
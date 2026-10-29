import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Button from "../../components/ui/Button";
import { askQuestion } from "../../api/ask";
import { errorMessage } from "../../api/client";

import TracePanel from "./TracePanel";

type Turn =
    | { role: "user"; text: string }
    | { role: "agent"; text: string; runId: string; steps: number };

const SUGGESTIONS = [
    "How much did I spend on food last month?",
    "Why was August higher than September?",
    "What do I pay Jio in total?",
    "Who did I pay the most in September?",
];

export default function AskPage() {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [draft, setDraft] = useState("");
    const [openTrace, setOpenTrace] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const ask = useMutation({
        mutationFn: askQuestion,
        onSuccess: (res) => {
            setTurns((t) => [
                ...t,
                { role: "agent", text: res.answer, runId: res.run_id, steps: res.steps },
            ]);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        },
        onError: (err) => toast.error(errorMessage(err)),
    });

    function send(question: string) {
        const text = question.trim();
        if (!text || ask.isPending) return;
        setTurns((t) => [...t, { role: "user", text }]);
        setDraft("");
        ask.mutate(text);
    }

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-8 py-7 pb-14">
            <div>
                <h1 className="mb-1.5 text-[30px] leading-tight font-semibold tracking-[-0.03em]">Ask your data</h1>
                <p className="text-[13.5px] text-ink-3">
                    Every number comes from a query, not from the model.
                </p>
            </div>

            {turns.length === 0 && (
                <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => send(s)}
                            className="cursor-pointer rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm text-ink-2 hover:border-accent hover:text-ink"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-4">
                {turns.map((turn, i) =>
                    turn.role === "user" ? (
                        <p
                            key={i}
                            className="max-w-lg self-end rounded-2xl rounded-br-sm bg-accent px-4 py-3 text-[15px] leading-relaxed text-white"
                        >
                            {turn.text}
                        </p>
                    ) : (
                        <div
                            key={i}
                            className="rounded-2xl rounded-bl-sm border border-line bg-surface px-5 py-4"
                        >
                            <p className="text-[15px] leading-relaxed">{turn.text}</p>

                            <button
                                type="button"
                                onClick={() =>
                                    setOpenTrace(openTrace === turn.runId ? null : turn.runId)
                                }
                                className="mt-3 cursor-pointer text-xs font-semibold text-ink-3 hover:text-ink"
                            >
                                {openTrace === turn.runId ? "Hide" : "Show"} the {turn.steps}{" "}
                                steps behind this
                            </button>

                            {/* Mounted only when open, so the trace is fetched on demand */}
                            {openTrace === turn.runId && <TracePanel runId={turn.runId} />}
                        </div>
                    )
                )}

                {ask.isPending && (
                    <p className="text-sm text-ink-3">Working through the data…</p>
                )}
                <div ref={bottomRef} />
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    send(draft);
                }}
                className="sticky bottom-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-surface p-3"
            >
                <label htmlFor="q" className="sr-only">
                    Ask about your spending
                </label>
                <input
                    id="q"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ask about a month, a payee, a category…"
                    className="min-h-11 min-w-0 flex-[999_1_280px] rounded-md border border-line px-3.5 text-[15px] outline-none focus:border-accent"
                />
                <Button type="submit" disabled={ask.isPending || !draft.trim()}>
                    {ask.isPending ? "Asking…" : "Ask"}
                </Button>
            </form>
        </div>
    );
}
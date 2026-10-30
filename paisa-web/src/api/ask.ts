import { api } from "./client";

// Append these to src/types/api.ts
export interface AskResponse {
    run_id: string;
    thread_id: string;
    answer: string;
    steps: number;
    tokens: number;
    duration_ms: number;
}

export interface TraceStep {
    step_no: number;
    kind: "tool" | "retry" | "answer";
    tool_name: string | null;
    arguments: Record<string, unknown> | null;
    result: Record<string, unknown> | null;
    duration_ms: number;
}

export interface RunTrace {
    run_id: string;
    question: string;
    answer: string | null;
    steps: number;
    tokens: number;
    duration_ms: number;
    trace: TraceStep[];
}

export async function askQuestion(
    question: string,
    threadId?: string
): Promise<AskResponse> {
    const { data } = await api.post<AskResponse>("/ask", {
        question,
        ...(threadId && { thread_id: threadId }),
    });
    return data;
}

export async function getTrace(runId: string): Promise<RunTrace> {
    const { data } = await api.get<RunTrace>(`/ask/runs/${runId}`);
    return data;
}
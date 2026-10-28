import { api, USE_MOCKS } from "./client";
import { mockTotalTransactions, mockTransactions } from "./mocks";
import type { Statement, TransactionPage } from "../types/api";

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

export async function listTransactions(
    limit = 50,
    offset = 0
): Promise<TransactionPage> {
    if (USE_MOCKS) {
        await delay();
        return {
            items: mockTransactions.slice(offset, offset + limit),
            total: mockTotalTransactions,
            limit,
            offset,
        };
    }
    const { data } = await api.get<TransactionPage>("/statements/transactions", {
        params: { limit, offset },
    });
    return data;
}

export async function listStatements(): Promise<Statement[]> {
    if (USE_MOCKS) {
        await delay();
        return [
            {
                id: "mock-stmt-1",
                original_filename: "gpay-apr-sep-2026.pdf",
                period_start: "2026-04-01T08:07:00",
                period_end: "2026-09-28T22:52:00",
                rows_parsed: 399,
                rows_inserted: 399,
                rows_duplicate: 0,
                imported_at: new Date().toISOString(),
            },
        ];
    }
    const { data } = await api.get<Statement[]>("/statements");
    return data;
}

export async function uploadStatement(file: File): Promise<Statement> {
    if (USE_MOCKS) {
        await delay(1200);
        return {
            id: `mock-stmt-${Date.now()}`,
            original_filename: file.name,
            period_start: "2026-04-01T08:07:00",
            period_end: "2026-09-28T22:52:00",
            rows_parsed: 399,
            rows_inserted: 0,
            rows_duplicate: 399,
            imported_at: new Date().toISOString(),
        };
    }

    // Multipart. Do NOT set Content-Type by hand — the browser has to add
    // the boundary token, and setting it manually strips that off.
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<Statement>("/statements", form, {
        headers: { "Content-Type": undefined },
    });
    return data;
}
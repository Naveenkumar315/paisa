import { api } from "./client";
import type { ClassifiedTransaction, TransactionList, TxnType } from "../types/api";

export const TXN_TYPES: { value: TxnType; label: string; direction: "debit" | "credit" | "both" }[] = [
    { value: "expense", label: "Expense", direction: "debit" },
    { value: "transfer_out", label: "Transfer out", direction: "debit" },
    { value: "self_transfer", label: "Self-transfer", direction: "both" },
    { value: "income", label: "Income", direction: "credit" },
    { value: "transfer_in", label: "Transfer in", direction: "credit" },
    { value: "refund", label: "Refund", direction: "credit" },
];

export function typeLabel(t: TxnType): string {
    return TXN_TYPES.find((x) => x.value === t)?.label ?? t;
}

export interface TransactionQuery {
    from?: string;          // YYYY-MM-DD
    to?: string;            // YYYY-MM-DD, inclusive
    type?: TxnType;
    category?: string;      // a category, or "uncategorised"
    account_id?: string;
    statement_id?: string;
    q?: string;
    sort?: "newest" | "oldest" | "largest" | "smallest";
    limit?: number;
    offset?: number;
}

export async function listTransactions(query: TransactionQuery): Promise<TransactionList> {
    // Drop empty values so the URL only carries the filters in use.
    const params = Object.fromEntries(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== "")
    );
    const { data } = await api.get<TransactionList>("/transactions", { params });
    return data;
}

export interface TransactionPatch {
    type_override?: TxnType | null;       // null clears it
    category_override?: string | null;
    notes?: string | null;
}

export async function updateTransaction(
    id: string,
    patch: TransactionPatch
): Promise<ClassifiedTransaction> {
    const { data } = await api.patch<ClassifiedTransaction>(`/transactions/${id}`, patch);
    return data;
}

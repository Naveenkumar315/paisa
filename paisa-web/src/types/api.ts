export type Direction = "debit" | "credit"

export interface User {
    id: string
    email: string
    name: string
    created_at: string
}

export interface TokenResponse {
    access_token: string
    token_type: string
    user: User
}

export interface Transaction {
    id: string
    txn_id: string
    occurred_at: string
    direction: Direction
    is_self_transfer: boolean
    counterparty_raw: string
    amount_paise: number
    amount: string
    bank: string
    account_last4: string
}

export interface TransactionPage {
    items: Transaction[];
    total: number;
    limit: number;
    offset: number;
}

export interface Statement {
    id: string;
    original_filename: string;
    period_start: string | null;
    period_end: string | null;
    rows_parsed: number;
    rows_inserted: number;
    rows_duplicate: number;
    imported_at: string;
}

export interface ApiError {
    error: { code: string; message: string };
}

// Append these to src/types/api.ts — the contract for the analytics
// endpoints the backend does not have yet. Writing them down now is what
// lets the screens be built before the backend exists.

export interface MonthSummary {
    month: string;                 // "2026-09"
    spending_paise: number;        // every payment out, transfers included
    transfers_paise: number;       // the part of spending_paise sent to people
    received_paise: number;
    self_transfer_paise: number;   // between your own accounts, never counted
    txn_count: number;
}

export interface PayeeSummary {
    name: string;
    count: number;
    total_paise: number;
    avg_paise: number;
    category: string | null;       // null means it still needs a label
}

export interface ClockBucket {
    bucket: string;                // "Evening 5–10pm"
    count: number;
    amount_paise: number;
}

export interface CategorySlice {
    name: string;
    amount_paise: number;
    pct: number;
}
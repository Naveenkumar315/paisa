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
    rows_failed?: number;          // payment lines the parser could not read
    status?: "processing" | "completed" | "failed";
    total_debit_paise?: number | null;
    total_credit_paise?: number | null;
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
    // The same money split by transaction type.
    // expenses + transfers = spending; income + transfers_in + refunds = received.
    // Optional only because the mock data predates them; the API always sends them.
    expenses_paise?: number;
    income_paise?: number;
    transfers_in_paise?: number;
    refunds_paise?: number;
}

/** What a transaction is. Decided by the backend (services/classification.py). */
export type TxnType =
    | "expense"
    | "transfer_out"
    | "self_transfer"
    | "income"
    | "transfer_in"
    | "refund";

export interface ClassifiedTransaction {
    id: string;
    txn_id: string;
    occurred_at: string;
    direction: Direction;
    is_self_transfer: boolean;
    counterparty_raw: string;
    amount_paise: number;
    bank: string;
    account_last4: string;
    account_id: string | null;
    statement_id: string | null;   // null for imports made before Sprint 1
    txn_type: TxnType;
    category: string | null;
    category_source: "override" | "payee" | null;
    type_override: TxnType | null;
    category_override: string | null;
    notes: string | null;
    updated_at: string | null;
}

export interface TransactionList {
    items: ClassifiedTransaction[];
    total: number;
    limit: number;
    offset: number;
    debit_paise: number;     // over every match, not just this page
    credit_paise: number;
}

export interface Account {
    id: string;
    name: string;
    institution: string;
    last4: string;
    account_type: string;
    currency: string;
    is_active: boolean;
    txn_count: number;
    debit_paise: number;
    credit_paise: number;
    first_txn_at: string | null;
    last_txn_at: string | null;
    balance_paise: null;     // a Google Pay statement never states one
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
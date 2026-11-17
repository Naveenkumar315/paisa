import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as accounts from "./accounts";
import * as analytics from "./analytics";
import * as statements from "./statements";
import * as transactions from "./transactions";
import type { TransactionQuery } from "./transactions";

/**
 * Every key in one place. A typo in a key string is invisible — the query
 * silently misses the cache and refetches forever — so keys are never
 * written inline at a call site.
 */
export const keys = {
    months: ["months"] as const,
    month: (m: string) => ["month", m] as const,
    categories: (m: string) => ["categories", m] as const,
    payees: (limit: number, month?: string) => ["payees", limit, month ?? "all"] as const,
    clock: ["clock"] as const,
    statements: ["statements"] as const,
    transactions: (limit: number, offset: number) =>
        ["transactions", limit, offset] as const,
    transactionList: (q: TransactionQuery) => ["transaction-list", q] as const,
    accounts: ["accounts"] as const,
};

export function useMonths() {
    return useQuery({ queryKey: keys.months, queryFn: analytics.getMonths });
}

export function useMonth(month: string) {
    return useQuery({
        queryKey: keys.month(month),
        queryFn: () => analytics.getMonth(month),
        enabled: Boolean(month),
        // Keep the last month on screen while a new one loads, otherwise the
        // dashboard flashes back to "Loading…" on every first click.
        placeholderData: (previous) => previous,
    });
}

export function useCategories(month: string) {
    return useQuery({
        queryKey: keys.categories(month),
        queryFn: () => analytics.getCategories(month),
        enabled: Boolean(month),
        placeholderData: (previous) => previous,
    });
}

export function usePayees(limit = 12, month?: string) {
    return useQuery({
        queryKey: keys.payees(limit, month),
        queryFn: () => analytics.getPayees(limit, month),
        placeholderData: (previous) => previous,
    });
}

export function useClock() {
    return useQuery({ queryKey: keys.clock, queryFn: analytics.getClock });
}

export function useStatements() {
    return useQuery({
        queryKey: keys.statements,
        queryFn: statements.listStatements,
    });
}

export function useTransactions(limit = 50, offset = 0) {
    return useQuery({
        queryKey: keys.transactions(limit, offset),
        queryFn: () => statements.listTransactions(limit, offset),
        placeholderData: (previous) => previous,
    });
}

export function useTransactionList(query: TransactionQuery) {
    return useQuery({
        queryKey: keys.transactionList(query),
        queryFn: () => transactions.listTransactions(query),
        placeholderData: (previous) => previous,
    });
}

export function useUpdateTransaction() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: transactions.TransactionPatch }) =>
            transactions.updateTransaction(id, patch),
        // An override moves money between types and categories, which
        // every total on every screen reads.
        onSuccess: () => qc.invalidateQueries(),
    });
}

export function useAccounts() {
    return useQuery({ queryKey: keys.accounts, queryFn: accounts.listAccounts });
}

export function useUpdateAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof accounts.updateAccount>[1] }) =>
            accounts.updateAccount(id, patch),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.accounts }),
    });
}

export function useUploadStatement() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: statements.uploadStatement,
        onSuccess: () => {
            // An import changes every number on every screen. Drop the lot
            // rather than trying to patch each cache by hand.
            qc.invalidateQueries();
        },
    });
}
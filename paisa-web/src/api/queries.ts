import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as analytics from "./analytics";
import * as statements from "./statements";

/**
 * Every key in one place. A typo in a key string is invisible — the query
 * silently misses the cache and refetches forever — so keys are never
 * written inline at a call site.
 */
export const keys = {
    months: ["months"] as const,
    month: (m: string) => ["month", m] as const,
    categories: (m: string) => ["categories", m] as const,
    payees: (limit: number) => ["payees", limit] as const,
    clock: ["clock"] as const,
    statements: ["statements"] as const,
    transactions: (limit: number, offset: number) =>
        ["transactions", limit, offset] as const,
};

export function useMonths() {
    return useQuery({ queryKey: keys.months, queryFn: analytics.getMonths });
}

export function useMonth(month: string) {
    return useQuery({
        queryKey: keys.month(month),
        queryFn: () => analytics.getMonth(month),
        enabled: Boolean(month),
    });
}

export function useCategories(month: string) {
    return useQuery({
        queryKey: keys.categories(month),
        queryFn: () => analytics.getCategories(month),
        enabled: Boolean(month),
    });
}

export function usePayees(limit = 12) {
    return useQuery({
        queryKey: keys.payees(limit),
        queryFn: () => analytics.getPayees(limit),
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
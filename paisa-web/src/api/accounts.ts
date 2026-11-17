import { api } from "./client";
import type { Account } from "../types/api";

export const ACCOUNT_TYPES: { value: string; label: string }[] = [
    { value: "bank", label: "Bank account" },
    { value: "savings", label: "Savings" },
    { value: "current", label: "Current" },
    { value: "credit_card", label: "Credit card" },
    { value: "cash", label: "Cash" },
    { value: "wallet", label: "Wallet" },
    { value: "investment", label: "Investment" },
];

export async function listAccounts(): Promise<Account[]> {
    const { data } = await api.get<Account[]>("/accounts");
    return data;
}

export async function updateAccount(
    id: string,
    patch: { name?: string | null; account_type?: string; is_active?: boolean }
): Promise<Account> {
    const { data } = await api.patch<Account>(`/accounts/${id}`, patch);
    return data;
}

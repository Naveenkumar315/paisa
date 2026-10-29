import { api } from "./client";

export const CATEGORIES = [
    "food",
    "groceries",
    "travel",
    "mobile",
    "health",
    "shopping",
    "transfer",
    "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Payee {
    name: string;
    category: Category | null;
    source: "llm" | "user" | null;
}

export async function listPayees(): Promise<Payee[]> {
    const { data } = await api.get<Payee[]>("/payees");
    return data;
}

export async function setPayeeCategory(
    name: string,
    category: Category
): Promise<Payee> {
    // The name goes in the path, so it has to survive a slash or a space.
    const { data } = await api.put<Payee>(
        `/payees/${encodeURIComponent(name)}`,
        { category }
    );
    return data;
}

export async function recategorise(): Promise<{
    payees_seen: number;
    categorised: number;
    kept_from_user: number;
}> {
    const { data } = await api.post("/payees/categorize");
    return data;
}
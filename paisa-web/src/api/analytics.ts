import { api, USE_MOCKS } from "./client";
import { mockClock, mockMonths, mockPayees } from "./mocks";
import type {
    CategorySlice,
    ClockBucket,
    MonthSummary,
    PayeeSummary,
} from "../types/api";

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

export async function getMonths(): Promise<MonthSummary[]> {
    if (USE_MOCKS) {
        await delay();
        return mockMonths;
    }
    const { data } = await api.get<MonthSummary[]>("/analytics/months");
    return data;
}

export async function getMonth(month: string): Promise<MonthSummary> {
    if (USE_MOCKS) {
        await delay();
        const found = mockMonths.find((m) => m.month === month);
        if (!found) throw new Error(`No data for ${month}`);
        return found;
    }
    const { data } = await api.get<MonthSummary>("/analytics/summary", {
        params: { month },
    });
    return data;
}

export async function getPayees(limit = 12, month?: string): Promise<PayeeSummary[]> {
    if (USE_MOCKS) {
        await delay();
        return mockPayees.slice(0, limit);
    }
    const { data } = await api.get<PayeeSummary[]>("/analytics/payees", {
        params: month ? { limit, month } : { limit },
    });
    return data;
}

export async function getClock(): Promise<ClockBucket[]> {
    if (USE_MOCKS) {
        await delay();
        return mockClock;
    }
    const { data } = await api.get<ClockBucket[]>("/analytics/clock");
    return data;
}

export async function getCategories(month: string): Promise<CategorySlice[]> {
    if (USE_MOCKS) {
        await delay();
        // Most spending is uncategorised because most payees are personal
        // names. The real endpoint computes this the same way: anything whose
        // payee has no label lands in one bucket.
        const summary = mockMonths.find((m) => m.month === month);
        const total = summary?.spending_paise ?? 0;
        const slices: Array<[string, number]> = [
            ["Uncategorised", 0.52],
            ["Food & drink", 0.19],
            ["Delivery", 0.17],
            ["Mobile & bills", 0.12],
        ];
        return slices.map(([name, share]) => ({
            name,
            amount_paise: Math.round(total * share),
            pct: Math.round(share * 100),
        }));
    }
    const { data } = await api.get<CategorySlice[]>("/analytics/categories", {
        params: { month },
    });
    return data;
}
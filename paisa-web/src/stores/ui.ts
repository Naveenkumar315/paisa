import { create } from "zustand";

/**
 * Client state only — things the server neither knows nor cares about.
 * Anything that comes from an endpoint belongs in React Query, not here.
 */
type UiState = {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  selectedMonth: "2026-09",
  setSelectedMonth: (month) => set({ selectedMonth: month }),
}));
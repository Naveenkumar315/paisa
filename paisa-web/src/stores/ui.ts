import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client state only — things the server neither knows nor cares about.
 * Anything that comes from an endpoint belongs in React Query, not here.
 */
type UiState = {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  showChartLabels: boolean;
  setShowChartLabels: (on: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedMonth: "2026-09",
      setSelectedMonth: (month) => set({ selectedMonth: month }),
      showChartLabels: false,
      setShowChartLabels: (on) => set({ showChartLabels: on }),
    }),
    {
      name: "paisa-ui",
      // Only the label preference survives a reload. A remembered month
      // would point at data a new statement may no longer cover.
      partialize: (s) => ({ showChartLabels: s.showChartLabels }),
    }
  )
);

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeChoice = "light" | "dark" | "system";

/** Must match the key read by the inline script in index.html, which
 *  applies the theme before React loads so the page never flashes light. */
export const THEME_STORAGE_KEY = "paisa-theme";

type ThemeState = {
    theme: ThemeChoice;
    setTheme: (theme: ThemeChoice) => void;
};

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: "system",
            setTheme: (theme) => set({ theme }),
        }),
        { name: THEME_STORAGE_KEY }
    )
);

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function apply(theme: ThemeChoice) {
    const dark = theme === "dark" || (theme === "system" && darkQuery.matches);
    document.documentElement.classList.toggle("dark", dark);
}

/** Keep <html class="dark"> in step with the choice, and with the OS
 *  while the choice is "system". Call once at startup. */
export function initTheme() {
    apply(useThemeStore.getState().theme);
    useThemeStore.subscribe((s) => apply(s.theme));
    darkQuery.addEventListener("change", () => apply(useThemeStore.getState().theme));
}

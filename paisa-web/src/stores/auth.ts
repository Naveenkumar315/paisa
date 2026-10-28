import { create } from "zustand";
import type { User } from "../types/api";

type AuthState = {
    token: string | null;
    user: User | null;
    signIn: (token: string, user: User) => void;
    signOut: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
    // Read once at startup so a refresh does not log the user out.
    token: localStorage.getItem("paisa_token"),
    user: JSON.parse(localStorage.getItem("paisa_user") ?? "null"),

    signIn: (token, user) => {
        localStorage.setItem("paisa_token", token);
        localStorage.setItem("paisa_user", JSON.stringify(user));
        set({ token, user });
    },

    signOut: () => {
        localStorage.removeItem("paisa_token");
        localStorage.removeItem("paisa_user");
        set({ token: null, user: null });
    },
}));
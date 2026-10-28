import { api, USE_MOCKS } from "./client";
import type { TokenResponse } from "../types/api";

const mockToken: TokenResponse = {
    access_token: "mock-token",
    token_type: "bearer",
    user: {
        id: "mock-1",
        email: "naveen@example.com",
        name: "Naveen",
        created_at: new Date().toISOString(),
    },
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(email: string, password: string) {
    if (USE_MOCKS) {
        await delay(400);
        if (password.length < 8) throw new Error("Invalid email or password");
        return { ...mockToken, user: { ...mockToken.user, email } };
    }
    const { data } = await api.post<TokenResponse>("/auth/login", { email, password });
    return data;
}

export async function register(email: string, name: string, password: string) {
    if (USE_MOCKS) {
        await delay(400);
        return { ...mockToken, user: { ...mockToken.user, email, name } };
    }
    const { data } = await api.post<TokenResponse>("/auth/register", { email, name, password });
    return data;
}
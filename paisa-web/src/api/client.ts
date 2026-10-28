import axios from "axios";

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: { "Content-Type": "application/json" },
});

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

// Attach the token to every request from one place.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("paisa_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Token expired -> clear and bounce to login, from one place.
api.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("paisa_token");
            if (window.location.pathname !== "/login") {
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

/** Pull the backend's {error:{message}} out, fall back to axios's own text. */
export function errorMessage(err: unknown): string {
    if (axios.isAxiosError(err)) {
        return err.response?.data?.error?.message ?? err.message;
    }
    return "Something went wrong";
}
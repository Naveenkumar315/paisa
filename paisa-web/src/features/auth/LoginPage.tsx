import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "../../components/ui/Button";
import { login } from "../../api/auth";
import { errorMessage } from "../../api/client";
import { useAuthStore } from "../../stores/auth";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    const signIn = useAuthStore((s) => s.signIn);
    const navigate = useNavigate();
    const location = useLocation();
    const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await login(email, password);
            signIn(res.access_token, res.user);
            navigate(from, { replace: true });
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-ground px-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 flex items-center gap-2.5">
                    <span className="inline-flex size-8 items-center justify-center rounded-[9px] bg-accent text-base font-bold text-white">
                        P
                    </span>
                    <span className="text-lg font-bold tracking-tight">Paisa</span>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-7">
                    <h1 className="mb-1 text-xl font-bold tracking-tight">Sign in</h1>
                    <p className="mb-6 text-sm text-ink-3">
                        Your statement, grouped and searchable.
                    </p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="email" className="text-xs font-semibold text-ink-3">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="min-h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-accent"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="password" className="text-xs font-semibold text-ink-3">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                minLength={8}
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="min-h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-accent"
                            />
                        </div>

                        <Button type="submit" disabled={busy} className="mt-1 w-full">
                            {busy ? "Signing in…" : "Sign in"}
                        </Button>
                    </form>
                </div>

                <p className="mt-5 text-center text-sm text-ink-3">
                    No account?{" "}
                    <Link to="/register" className="font-semibold text-accent">
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
}
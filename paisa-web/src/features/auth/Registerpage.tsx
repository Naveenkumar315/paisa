import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "../../components/ui/Button";
import { register } from "../../api/auth";
import { errorMessage } from "../../api/client";
import { useAuthStore } from "../../stores/auth";

const MIN_PASSWORD = 8;

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    const signIn = useAuthStore((s) => s.signIn);
    const navigate = useNavigate();

    const tooShort = password.length > 0 && password.length < MIN_PASSWORD;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await register(email, name, password);
            signIn(res.access_token, res.user);
            navigate("/dashboard", { replace: true });
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-ground px-4 py-10">
            <div className="w-full max-w-sm">
                <div className="mb-8 flex items-center gap-2.5">
                    <span className="inline-flex size-8 items-center justify-center rounded-[9px] bg-accent text-base font-bold text-white">
                        P
                    </span>
                    <span className="text-lg font-bold tracking-tight">Paisa</span>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-7">
                    <h1 className="mb-1 text-xl font-bold tracking-tight">Create an account</h1>
                    <p className="mb-6 text-sm text-ink-3">
                        Upload a statement and see where the money went.
                    </p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="name" className="text-xs font-semibold text-ink-3">
                                Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                required
                                minLength={2}
                                maxLength={80}
                                autoComplete="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="min-h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-accent"
                            />
                        </div>

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
                                minLength={MIN_PASSWORD}
                                maxLength={128}
                                autoComplete="new-password"
                                aria-describedby="password-hint"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="min-h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-accent"
                            />
                            <p
                                id="password-hint"
                                className={tooShort ? "text-xs text-warn-ink" : "text-xs text-ink-3"}
                            >
                                At least {MIN_PASSWORD} characters
                            </p>
                        </div>

                        <Button type="submit" disabled={busy} className="mt-1 w-full">
                            {busy ? "Creating account…" : "Create account"}
                        </Button>
                    </form>
                </div>

                <p className="mt-5 text-center text-sm text-ink-3">
                    Already have an account?{" "}
                    <Link to="/login" className="font-semibold text-accent">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
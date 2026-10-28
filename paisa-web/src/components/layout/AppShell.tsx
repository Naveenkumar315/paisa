import { NavLink, Outlet } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useAuthStore } from "../../stores/auth";

const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/ask", label: "Ask" },
    { to: "/payees", label: "Payees" },
    { to: "/people", label: "People" },
];

export default function AppShell() {
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);

    return (
        <div className="flex min-h-screen flex-wrap items-stretch bg-ground">
            <aside className="flex min-w-0 flex-[0_1_232px] flex-col gap-7 border-r border-line bg-surface px-4 py-6">
                <div className="flex items-center gap-2.5 px-2">
                    <span className="inline-flex size-[30px] items-center justify-center rounded-[9px] bg-accent text-[15px] font-bold text-white">
                        P
                    </span>
                    <span className="font-bold tracking-tight">Paisa</span>
                </div>

                <nav className="flex flex-col gap-0.5">
                    {links.map((l) => (
                        <NavLink
                            key={l.to}
                            to={l.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex min-h-11 items-center rounded-[9px] px-3 text-sm no-underline",
                                    isActive
                                        ? "bg-accent-bg font-semibold text-accent"
                                        : "font-medium text-ink-2 hover:bg-ground"
                                )
                            }
                        >
                            {l.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto border-t border-line-soft px-3 pt-5">
                    <p className="mb-2 truncate text-[13px] text-ink-2">{user?.email}</p>
                    <button
                        onClick={signOut}
                        className="cursor-pointer text-[13px] font-semibold text-ink-3 hover:text-ink"
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            <main className="min-w-0 flex-[999_1_640px]">
                <Outlet />
            </main>
        </div>
    );
}
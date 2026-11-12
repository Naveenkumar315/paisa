import { cn } from "../../lib/cn";
import { type ThemeChoice, useThemeStore } from "../../stores/theme";

const options: { value: ThemeChoice; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
];

export default function ThemeToggle() {
    const theme = useThemeStore((s) => s.theme);
    const setTheme = useThemeStore((s) => s.setTheme);

    return (
        <div
            role="radiogroup"
            aria-label="Theme"
            className="flex rounded-[9px] border border-line bg-ground p-0.5"
        >
            {options.map((o) => (
                <button
                    key={o.value}
                    role="radio"
                    aria-checked={theme === o.value}
                    onClick={() => setTheme(o.value)}
                    className={cn(
                        "min-h-8 flex-1 cursor-pointer rounded-[7px] text-[12.5px] font-semibold transition-colors",
                        theme === o.value
                            ? "bg-surface text-ink shadow-card"
                            : "text-ink-3 hover:text-ink"
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

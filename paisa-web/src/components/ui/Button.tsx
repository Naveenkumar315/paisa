import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const variants = {
    primary: "bg-accent text-white hover:bg-accent-ink",
    secondary: "border border-line bg-surface text-ink hover:bg-ground",
    ghost: "text-ink-2 hover:bg-ground",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof variants;
};

export default function Button({
    variant = "primary",
    className,
    ...rest
}: Props) {
    return (
        <button
            className={cn(
                "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                variants[variant],
                className
            )}
            {...rest}
        />
    );
}
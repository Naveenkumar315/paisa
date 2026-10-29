import { useRef, useState } from "react";
import toast from "react-hot-toast";

import Button from "../../components/ui/Button";
import { errorMessage } from "../../api/client";
import { useUploadStatement } from "../../api/queries";
import { cn } from "../../lib/cn";

export default function StatementUpload({
    variant = "block",
}: {
    variant?: "block" | "inline";
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const upload = useUploadStatement();

    async function send(file: File | undefined) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            toast.error("That is not a PDF");
            return;
        }
        try {
            const result = await upload.mutateAsync(file);
            toast.success(
                result.rows_inserted > 0
                    ? `Imported ${result.rows_inserted} payments`
                    : `Already imported — ${result.rows_duplicate} payments skipped`
            );
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            // Clearing lets the same file be picked again after a failure.
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    const input = (
        <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => send(e.target.files?.[0])}
        />
    );

    if (variant === "inline") {
        return (
            <>
                {input}
                <Button
                    variant="secondary"
                    disabled={upload.isPending}
                    onClick={() => inputRef.current?.click()}
                >
                    {upload.isPending ? "Importing…" : "Import statement"}
                </Button>
            </>
        );
    }

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                send(e.dataTransfer.files?.[0]);
            }}
            className={cn(
                "rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                dragging ? "border-accent bg-accent-bg" : "border-line bg-surface"
            )}
        >
            {input}

            <h2 className="mb-2 text-xl font-semibold tracking-[-0.02em]">
                Import your Google Pay statement
            </h2>
            <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-ink-2">
                In the Google Pay app: Settings, then Transaction statement. Pick a
                period and it emails you a PDF. Drop it here.
            </p>

            <Button
                disabled={upload.isPending}
                onClick={() => inputRef.current?.click()}
            >
                {upload.isPending ? "Reading the PDF…" : "Choose a PDF"}
            </Button>

            <p className="mt-5 text-xs text-ink-3">
                Re-importing an overlapping period is safe — payments already stored
                are skipped, never duplicated.
            </p>
        </div>
    );
}
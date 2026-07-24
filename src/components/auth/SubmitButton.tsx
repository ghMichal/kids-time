import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  pending?: boolean;
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
}

export function SubmitButton({ pending = false, pendingText, icon, children }: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className={cn(
        "h-auto w-full rounded-xl bg-amber-600 px-4 py-2.5 text-base font-semibold text-white shadow-md",
        "hover:bg-amber-700",
      )}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </Button>
  );
}

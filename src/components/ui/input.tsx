import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({ className, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-11 w-full rounded-card border border-border bg-background-elevated px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted",
        className,
      )}
      {...props}
    />
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Same shape as button.tsx's cva pattern — small colored pill for enum
// values (game, status) that were previously rendered as raw text.
// Solid-fill variants only pair colors already proven safe by the
// axe-core contrast fixes in PLAN.md Phase 8 (accent-*/--on-accent,
// danger/--on-danger) rather than inventing new untested pairs.
const badgeVariants = cva(
  "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border border-border bg-background-elevated text-foreground-muted",
        pink: "bg-accent-pink text-on-accent",
        blue: "bg-accent-blue text-on-accent",
        mint: "bg-accent-mint text-on-accent",
        yellow: "bg-accent-yellow text-on-accent",
        danger: "bg-danger text-on-danger",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

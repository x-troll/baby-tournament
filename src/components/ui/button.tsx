import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn/ui-style primitive, styled with our own tokens rather than the
// default zinc palette — "everything heavily rounded, big pill buttons"
// per the visual direction, so pill is the default radius here, not
// shadcn's usual rounded-md. Touch targets default to 44px (WCAG 2.5.8
// "in practice" size for drunk-people-on-phones use), never below 24px.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-semibold shadow-soft transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // text-on-accent/text-on-danger, not text-foreground/text-white:
        // --accent-* and --danger are pastel-in-dark-mode-too colors, so
        // --fg (light in dark mode) fails contrast badly on them. Caught
        // by the axe-core suite, not hypothetical — see PLAN.md Phase 8.
        default: "bg-accent-pink text-on-accent hover:opacity-90",
        secondary: "border border-border bg-background-elevated text-foreground hover:opacity-90",
        destructive: "bg-danger text-on-danger hover:opacity-90",
        ghost: "bg-transparent text-foreground hover:bg-background-sunken shadow-none",
      },
      size: {
        default: "min-h-11 px-5 py-2",
        sm: "min-h-11 px-3 py-1.5 text-xs",
        lg: "min-h-12 px-7 py-3 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  ref?: React.Ref<HTMLButtonElement>;
}

// React 19: ref is just a regular prop on function components, no
// forwardRef wrapper needed.
export function Button({ className, variant, size, ref, ...props }: ButtonProps) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

// Exported so link-styled-as-button spots (e.g. an admin action that
// navigates instead of submitting) can reuse the same visual variants
// without wrapping a real <button> around an <a> or <Link>.
export { buttonVariants };

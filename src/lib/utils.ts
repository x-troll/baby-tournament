import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Standard shadcn/ui helper: merge conditional class names, then dedupe conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

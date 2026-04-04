import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
        success:
          "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
        warn: "border-transparent bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
        danger:
          "border-transparent bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
        muted:
          "border-transparent bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

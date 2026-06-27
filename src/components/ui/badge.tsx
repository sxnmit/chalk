import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-pill)] border font-medium",
  {
    variants: {
      variant: {
        neutral: "border-border bg-transparent text-text-muted",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/10 text-warning",
        danger: "border-transparent bg-danger/10 text-danger",
        chalk: "border-transparent bg-chalk-soft text-chalk",
      },
      size: {
        default: "min-h-7 px-2.5 text-sm",
        sm: "min-h-6 px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  }
)

/** Example: <Badge variant="chalk">Active</Badge> */
export function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size, className }))} {...props} />
}

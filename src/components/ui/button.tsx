import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chalk active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-chalk text-white hover:bg-chalk/90",
        primary: "bg-chalk text-white hover:bg-chalk/90",
        outline:
          "border-border bg-surface text-text hover:bg-surface-2 aria-expanded:bg-surface-2",
        secondary:
          "border-border bg-surface text-text hover:bg-surface-2 aria-expanded:bg-surface-2",
        ghost:
          "text-text-muted hover:bg-surface-2 hover:text-text aria-expanded:bg-surface-2 aria-expanded:text-text",
        destructive:
          "bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger",
        danger:
          "bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger",
        link: "h-auto rounded-none px-0 text-chalk underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-4",
        xs: "h-8 gap-1.5 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-13 gap-2 px-5 text-base",
        icon: "size-11 p-0",
        "icon-xs":
          "size-8 p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 p-0",
        "icon-lg": "size-13 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  iconLeft,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    iconLeft?: React.ReactNode
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" /> : iconLeft}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }

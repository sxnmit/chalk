"use client"

import * as React from "react"
import { Popover } from "radix-ui"
import { cn } from "@/lib/utils"

const PopoverRoot = Popover.Root
const PopoverTrigger = Popover.Trigger
const PopoverPortal = Popover.Portal

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof Popover.Content>,
  React.ComponentPropsWithoutRef<typeof Popover.Content>
>(({ className, align = "end", sideOffset = 8, ...props }, ref) => (
  <PopoverPortal>
    <Popover.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 rounded-xl border border-border/50 bg-popover shadow-2xl",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        "duration-200",
        className
      )}
      {...props}
    />
  </PopoverPortal>
))
PopoverContent.displayName = "PopoverContent"

export { PopoverRoot, PopoverTrigger, PopoverContent }

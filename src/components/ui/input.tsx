import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  error?: string
}

function Input({ className, type, error, "aria-invalid": ariaInvalid, ...props }: InputProps) {
  return (
    <div className="w-full">
      <input
        type={type}
        data-slot="input"
        aria-invalid={ariaInvalid ?? Boolean(error)}
        className={cn(
          "h-11 w-full min-w-0 rounded-[var(--radius)] border border-input bg-surface px-3 py-2 text-base text-text transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text placeholder:text-text-faint focus-visible:border-chalk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chalk disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-faint aria-invalid:border-danger aria-invalid:focus-visible:outline-danger md:text-sm",
          className
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  )
}

export { Input }

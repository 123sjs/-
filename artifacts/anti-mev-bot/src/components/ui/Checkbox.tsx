import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <div className="relative flex items-center justify-center">
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-border bg-card transition-all checked:border-primary checked:bg-primary hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      />
      <Check className="pointer-events-none absolute h-3.5 w-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
    </div>
  )
})
Checkbox.displayName = "Checkbox"

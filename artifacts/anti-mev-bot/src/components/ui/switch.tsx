import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  className?: string
  id?: string
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ checked, defaultChecked, onChange, disabled, className, id }, ref) => {
    return (
      <label className={cn("relative inline-flex cursor-pointer items-center shrink-0", disabled && "cursor-not-allowed opacity-50", className)}>
        <input
          type="checkbox"
          ref={ref}
          id={id}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="h-5 w-9 rounded-full bg-input transition-colors peer-checked:bg-primary" />
        <span className={cn(
          "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }

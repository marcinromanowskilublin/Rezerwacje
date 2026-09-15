import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-[0_8px_24px_-8px_rgba(26,71,54,0.55)] hover:shadow-[0_10px_28px_-6px_rgba(26,71,54,0.6)] hover:-translate-y-0.5 active:translate-y-0",
        outline: "border border-brand-200/80 bg-white/60 hover:bg-brand-50 hover:border-brand-300 text-ink",
        secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100",
        ghost: "hover:bg-brand-50 text-ink",
        link: "text-brand-700 underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-9 px-4 text-xs tracking-widest uppercase",
        lg: "h-14 px-8 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

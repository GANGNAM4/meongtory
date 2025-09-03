import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const legodtButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:transform hover:scale-[1.02] active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Primary - LEGODT 메인 컬러 (그레이)
        primary: "bg-slate-600 text-white hover:bg-slate-700 focus-visible:ring-slate-600 shadow-md hover:shadow-lg",
        
        // Secondary - LEGODT 옐로우 포인트
        secondary: "bg-yellow-400 text-slate-900 hover:bg-yellow-500 focus-visible:ring-yellow-400 shadow-md hover:shadow-lg font-semibold",
        
        // Success - 그린 액센트
        success: "bg-green-500 text-white hover:bg-green-600 focus-visible:ring-green-500 shadow-md hover:shadow-lg",
        
        // Outline - 테두리 스타일
        outline: "border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus-visible:ring-slate-600",
        
        // Ghost - 투명한 배경
        ghost: "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-600",
        
        // Link - 링크 스타일
        link: "text-slate-600 underline-offset-4 hover:underline hover:text-slate-800",
        
        // Destructive - 경고/삭제
        destructive: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500 shadow-md hover:shadow-lg",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-md",
        default: "h-10 px-4 py-2",
        lg: "h-12 px-8 text-base rounded-xl",
        xl: "h-14 px-10 text-lg rounded-xl",
        icon: "h-10 w-10 p-2",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  }
)

export interface LegodtButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof legodtButtonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const LegodtButton = React.forwardRef<HTMLButtonElement, LegodtButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, loading = false, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    return (
      <Comp
        className={cn(legodtButtonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {leftIcon && !loading && <span className="mr-1">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="ml-1">{rightIcon}</span>}
      </Comp>
    )
  }
)
LegodtButton.displayName = "LegodtButton"

export { LegodtButton, legodtButtonVariants }
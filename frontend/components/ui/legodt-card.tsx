import * as React from "react"
import { cn } from "@/lib/utils"

// LEGODT 스타일의 카드 컴포넌트
const LegodtCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "elevated" | "outlined" | "product"
    padding?: "sm" | "md" | "lg"
  }
>(({ className, variant = "default", padding = "md", ...props }, ref) => {
  const variants = {
    default: "bg-white border border-slate-200 shadow-sm",
    elevated: "bg-white shadow-md hover:shadow-lg transition-shadow duration-250",
    outlined: "bg-white border-2 border-slate-300 hover:border-slate-400 transition-colors duration-250",
    product: "bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-250 hover:transform hover:scale-[1.02]"
  }
  
  const paddings = {
    sm: "p-4",
    md: "p-6", 
    lg: "p-8"
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl",
        variants[variant],
        paddings[padding],
        className
      )}
      {...props}
    />
  )
})
LegodtCard.displayName = "LegodtCard"

const LegodtCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
))
LegodtCardHeader.displayName = "LegodtCardHeader"

const LegodtCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & {
    size?: "sm" | "md" | "lg"
  }
>(({ className, size = "md", ...props }, ref) => {
  const sizes = {
    sm: "text-lg font-semibold",
    md: "text-xl font-semibold", 
    lg: "text-2xl font-bold"
  }
  
  return (
    <h3
      ref={ref}
      className={cn(
        "leading-none tracking-tight text-slate-900",
        sizes[size],
        className
      )}
      {...props}
    />
  )
})
LegodtCardTitle.displayName = "LegodtCardTitle"

const LegodtCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-slate-600 leading-relaxed", className)}
    {...props}
  />
))
LegodtCardDescription.displayName = "LegodtCardDescription"

const LegodtCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-slate-700", className)} {...props} />
))
LegodtCardContent.displayName = "LegodtCardContent"

const LegodtCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
))
LegodtCardFooter.displayName = "LegodtCardFooter"

// Product Card - LEGODT 상품 스타일을 반영한 특별한 카드
const LegodtProductCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    imageUrl?: string
    productName?: string
    price?: string | number
    originalPrice?: string | number
    isSoldOut?: boolean
    brand?: string
    onProductClick?: () => void
  }
>(({ 
  className, 
  imageUrl, 
  productName, 
  price, 
  originalPrice, 
  isSoldOut = false,
  brand = "LEGODT",
  onProductClick,
  children,
  ...props 
}, ref) => (
  <LegodtCard
    ref={ref}
    variant="product"
    padding="sm"
    className={cn(
      "cursor-pointer group overflow-hidden",
      isSoldOut && "opacity-60",
      className
    )}
    onClick={onProductClick}
    {...props}
  >
    {/* 상품 이미지 */}
    {imageUrl && (
      <div className="relative mb-4 overflow-hidden rounded-lg">
        <img 
          src={imageUrl} 
          alt={productName || "상품 이미지"}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold">품절</span>
          </div>
        )}
      </div>
    )}
    
    {/* 브랜드 */}
    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
      {brand}
    </div>
    
    {/* 상품명 */}
    {productName && (
      <h3 className="font-medium text-slate-900 mb-2 line-clamp-2 group-hover:text-slate-700 transition-colors">
        {productName}
      </h3>
    )}
    
    {/* 가격 */}
    {price !== undefined && (
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-900">
          {typeof price === 'number' ? `${price.toLocaleString()}원` : price}
        </span>
        {originalPrice && originalPrice !== price && (
          <span className="text-sm text-slate-500 line-through">
            {typeof originalPrice === 'number' ? `${originalPrice.toLocaleString()}원` : originalPrice}
          </span>
        )}
      </div>
    )}
    
    {children}
  </LegodtCard>
))
LegodtProductCard.displayName = "LegodtProductCard"

export {
  LegodtCard,
  LegodtCardHeader,
  LegodtCardFooter,
  LegodtCardTitle,
  LegodtCardDescription,
  LegodtCardContent,
  LegodtProductCard,
}
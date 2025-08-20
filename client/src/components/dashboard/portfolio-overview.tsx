import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { formatCurrency, formatPercentage, getPerformanceColorClass } from "@/lib/utils/portfolio-calculations"

interface PortfolioOverviewProps {
  totalValue: number
  totalChange: number
  totalChangePercent: number
  isLoading?: boolean
}

/**
 * Portfolio Overview Component
 * 
 * Displays the total portfolio value with large typography, color-coded performance indicators,
 * percentage and absolute change displays, and responsive design for mobile and desktop.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
export function PortfolioOverview({
  totalValue,
  totalChange,
  totalChangePercent,
  isLoading = false
}: PortfolioOverviewProps) {
  // Determine performance indicator color and icon
  const getPerformanceIndicator = () => {
    if (totalChangePercent > 0) {
      return {
        color: "text-green-600",
        bgColor: "bg-green-500",
        icon: TrendingUp,
        variant: "default" as const
      }
    } else if (totalChangePercent < 0) {
      return {
        color: "text-red-600", 
        bgColor: "bg-red-500",
        icon: TrendingDown,
        variant: "destructive" as const
      }
    } else {
      return {
        color: "text-gray-600",
        bgColor: "bg-gray-500", 
        icon: Minus,
        variant: "secondary" as const
      }
    }
  }

  const performanceIndicator = getPerformanceIndicator()
  const PerformanceIcon = performanceIndicator.icon

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Portfolio Value
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Large value skeleton */}
          <Skeleton className="h-12 w-48" />
          
          {/* Performance indicators skeleton */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      className="col-span-full"
      role="region"
      aria-labelledby="portfolio-overview-title"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle 
          id="portfolio-overview-title"
          className="text-sm font-medium text-muted-foreground"
        >
          Total Portfolio Value
        </CardTitle>
        <PerformanceIcon 
          className={`h-5 w-5 ${performanceIndicator.color}`}
          aria-hidden="true"
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Large typography for total value - Requirements 1.1, 1.2 */}
        <div 
          className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight"
          aria-label={`Total portfolio value: ${formatCurrency(totalValue)}`}
        >
          {formatCurrency(totalValue)}
        </div>
        
        {/* Performance indicators with color coding - Requirements 1.3, 1.4, 1.5, 1.6 */}
        <div 
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
          role="group"
          aria-label="Portfolio performance indicators"
        >
          {/* Percentage change badge */}
          <Badge 
            variant={performanceIndicator.variant}
            className={`
              w-fit text-sm font-semibold
              ${performanceIndicator.variant === 'default' ? performanceIndicator.bgColor : ''}
            `}
            aria-label={`Performance change: ${formatPercentage(totalChangePercent)}`}
          >
            {formatPercentage(totalChangePercent)}
          </Badge>
          
          {/* Absolute change display */}
          <div 
            className={`
              text-sm font-medium
              ${performanceIndicator.color}
            `}
            aria-label={`Absolute change: ${totalChange >= 0 ? 'gain of' : 'loss of'} ${formatCurrency(Math.abs(totalChange))}`}
          >
            {totalChange >= 0 ? '+' : ''}
            {formatCurrency(totalChange)}
          </div>
          
          {/* Additional context for mobile */}
          <div className="text-xs text-muted-foreground sm:hidden">
            vs. previous period
          </div>
        </div>
        
        {/* Desktop additional context */}
        <div className="hidden sm:block text-xs text-muted-foreground">
          Performance compared to previous period
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Compact Portfolio Overview Component
 * 
 * A more compact version for use in grid layouts or smaller spaces
 */
export function CompactPortfolioOverview({
  totalValue,
  totalChange,
  totalChangePercent,
  isLoading = false
}: PortfolioOverviewProps) {
  const performanceColorClass = getPerformanceColorClass(totalChangePercent)
  const PerformanceIcon = totalChangePercent > 0 ? TrendingUp : 
                         totalChangePercent < 0 ? TrendingDown : Minus

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Portfolio Value
          </CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      role="region"
      aria-labelledby="compact-portfolio-overview-title"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle 
          id="compact-portfolio-overview-title"
          className="text-sm font-medium"
        >
          Total Portfolio Value
        </CardTitle>
        <PerformanceIcon 
          className={`h-4 w-4 ${performanceColorClass}`}
          aria-hidden="true"
        />
      </CardHeader>
      <CardContent>
        <div 
          className="text-2xl font-bold"
          aria-label={`Total portfolio value: ${formatCurrency(totalValue)}`}
        >
          {formatCurrency(totalValue)}
        </div>
        <div 
          className="flex items-center gap-2 text-xs mt-1"
          role="group"
          aria-label="Portfolio performance"
        >
          <Badge 
            variant={totalChangePercent >= 0 ? "default" : "destructive"}
            className={`text-xs ${totalChangePercent >= 0 ? "bg-green-500" : ""}`}
            aria-label={`Performance change: ${formatPercentage(totalChangePercent)}`}
          >
            {formatPercentage(totalChangePercent)}
          </Badge>
          <span 
            className={performanceColorClass}
            aria-label={`Absolute change: ${totalChange >= 0 ? 'gain of' : 'loss of'} ${formatCurrency(Math.abs(totalChange))}`}
          >
            {totalChange >= 0 ? "+" : ""}
            {formatCurrency(totalChange)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
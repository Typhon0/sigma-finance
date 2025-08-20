import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Portfolio } from "@/lib/types/dashboard.types"
import { calculateIndividualPortfolioMetrics, formatCurrency, formatPercentage, getPerformanceColorClass } from "@/lib/utils/portfolio-calculations"

interface PortfolioAllocation {
  portfolio: Portfolio
  value: number
  percentage: number
}

interface PortfolioSummaryCardsProps {
  portfolios: Portfolio[]
  portfolioAllocation?: PortfolioAllocation[]
  isLoading?: boolean
  onCreatePortfolio?: () => void
  onPortfolioClick?: (portfolioId: string) => void
  onViewAllPortfolios?: () => void
}

/**
 * Portfolio Summary Cards Component
 * 
 * Displays a responsive grid of portfolio cards showing:
 * - Portfolio name and value
 * - Performance indicators with color coding
 * - Allocation percentage relative to total assets
 * - Click-to-navigate functionality
 * - Empty state with create portfolio action
 */
export function PortfolioSummaryCards({
  portfolios,
  portfolioAllocation = [],
  isLoading = false,
  onCreatePortfolio,
  onPortfolioClick,
  onViewAllPortfolios,
}: PortfolioSummaryCardsProps) {
  // Handle navigation to portfolio details
  const handlePortfolioClick = (portfolioId: string) => {
    if (onPortfolioClick) {
      onPortfolioClick(portfolioId)
    } else {
      // Navigate to portfolio detail page
      window.location.href = `/portfolios/${portfolioId}`
    }
  }

  // Handle create portfolio action
  const handleCreatePortfolio = () => {
    if (onCreatePortfolio) {
      onCreatePortfolio()
    } else {
      // Navigate to create portfolio page
      window.location.href = '/portfolios/create'
    }
  }

  // Handle view all portfolios action
  const handleViewAllPortfolios = () => {
    if (onViewAllPortfolios) {
      onViewAllPortfolios()
    } else {
      // Navigate to all portfolios page
      window.location.href = '/portfolios'
    }
  }

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-12" />
              </div>
              <Skeleton className="h-6 w-20 mb-2" />
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Show empty state if no portfolios
  if (!portfolios || portfolios.length === 0) {
    return (
      <div 
        className="text-center py-8"
        role="region"
        aria-labelledby="empty-portfolios-title"
      >
        <div className="mb-4">
          <div 
            className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4"
            aria-hidden="true"
          >
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 
            id="empty-portfolios-title"
            className="text-lg font-semibold mb-2"
          >
            No portfolios found
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Get started by creating your first portfolio to track your investments and assets.
          </p>
        </div>
        <Button 
          onClick={handleCreatePortfolio} 
          className="gap-2"
          aria-describedby="empty-portfolios-title"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Your First Portfolio
        </Button>
      </div>
    )
  }

  // Display up to 5 portfolios (as per requirements)
  const displayPortfolios = portfolios.slice(0, 5)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayPortfolios.map((portfolio) => {
          // Calculate individual portfolio metrics
          const metrics = calculateIndividualPortfolioMetrics(portfolio)
          
          // Find allocation data for this portfolio
          const allocationData = portfolioAllocation.find(
            (allocation) => allocation.portfolio.id === portfolio.id
          )
          
          const allocationPercentage = allocationData?.percentage || 0
          const assetCount = portfolio.assets?.length || 0
          
          // Determine performance indicator
          const performanceIcon = metrics.totalGainLoss > 0 
            ? <TrendingUp className="h-4 w-4 text-green-600" />
            : metrics.totalGainLoss < 0 
            ? <TrendingDown className="h-4 w-4 text-red-600" />
            : <Minus className="h-4 w-4 text-gray-600" />

          return (
            <Card 
              key={portfolio.id} 
              className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              onClick={() => handlePortfolioClick(portfolio.id)}
              tabIndex={0}
              role="button"
              aria-label={`View details for ${portfolio.name}. Value: ${formatCurrency(metrics.totalValue)}. ${assetCount} assets. ${allocationPercentage.toFixed(1)}% of total portfolio.`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handlePortfolioClick(portfolio.id)
                }
              }}
            >
              <CardContent className="p-4">
                {/* Header with name and allocation percentage */}
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold truncate text-base" title={portfolio.name}>
                    {portfolio.name}
                  </h3>
                  <Badge variant="outline" className="ml-2 flex-shrink-0">
                    {allocationPercentage.toFixed(1)}%
                  </Badge>
                </div>

                {/* Portfolio value */}
                <div className="mb-3">
                  <div className="text-xl font-bold">
                    {formatCurrency(metrics.totalValue)}
                  </div>
                  
                  {/* Performance indicator */}
                  {metrics.totalCost > 0 && (
                    <div className={`flex items-center gap-1 text-sm ${getPerformanceColorClass(metrics.totalGainLoss)}`}>
                      {performanceIcon}
                      <span>
                        {formatPercentage(metrics.totalGainLossPercent)} 
                        ({metrics.totalGainLoss >= 0 ? '+' : ''}{formatCurrency(metrics.totalGainLoss)})
                      </span>
                    </div>
                  )}
                </div>

                {/* Asset count and additional info */}
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>
                    {assetCount} {assetCount === 1 ? 'asset' : 'assets'}
                  </span>
                  {metrics.totalCost > 0 && (
                    <span className="text-xs">
                      Cost: {formatCurrency(metrics.totalCost)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Show "View All" link if there are more than 5 portfolios */}
      {portfolios.length > 5 && (
        <div className="text-center pt-4">
          <Button 
            variant="outline" 
            onClick={handleViewAllPortfolios}
            className="gap-2"
            aria-label={`View all ${portfolios.length} portfolios. Currently showing 5 of ${portfolios.length}.`}
          >
            View All Portfolios ({portfolios.length})
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Portfolio Summary Cards Skeleton
 * Loading state component for portfolio summary cards
 */
export function PortfolioSummaryCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-12" />
            </div>
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-4 w-28 mb-3" />
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
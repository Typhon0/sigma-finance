import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, ArrowRight, ExternalLink } from "lucide-react"
import { AssetPerformance } from "@/lib/types/dashboard.types"
import { formatCurrency, formatPercentage, getPerformanceColorClass } from "@/lib/utils/portfolio-calculations"
import { useNavigate } from "@tanstack/react-router"

interface AssetPerformanceProps {
  topPerformers: AssetPerformance[]
  worstPerformers: AssetPerformance[]
  isLoading?: boolean
}

/**
 * Asset Performance Component
 * 
 * Displays top performing and worst performing assets with asset name, symbol, 
 * value, and percentage change. Implements color-coded gains/losses display
 * and click-to-navigate functionality to asset details.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export function AssetPerformanceComponent({
  topPerformers,
  worstPerformers,
  isLoading = false
}: AssetPerformanceProps) {
  const navigate = useNavigate()

  // Handle navigation to asset detail view - Requirements 3.4
  const handleAssetClick = (assetId: string) => {
    // TODO: Update with actual asset detail route when implemented
    navigate({ to: `/assets/${assetId}` })
  }

  // Render individual asset performance item
  const renderAssetItem = (assetPerformance: AssetPerformance, index: number) => {
    const { asset, currentValue, changePercent, changeAmount } = assetPerformance
    const performanceColorClass = getPerformanceColorClass(changePercent)
    const PerformanceIcon = changePercent >= 0 ? TrendingUp : TrendingDown

    return (
      <div
        key={`${asset.id}-${index}`}
        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => handleAssetClick(asset.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleAssetClick(asset.id)
          }
        }}
      >
        <div className="flex-1 min-w-0">
          {/* Asset name and symbol - Requirements 3.3 */}
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm truncate">
              {asset.name}
            </h4>
            {asset.symbol && (
              <Badge variant="outline" className="text-xs">
                {asset.symbol}
              </Badge>
            )}
          </div>
          
          {/* Current value - Requirements 3.3 */}
          <p className="text-xs text-muted-foreground">
            {formatCurrency(currentValue)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Performance metrics with color coding - Requirements 3.3, 3.5 */}
          <div className="text-right">
            <div className={`text-sm font-medium ${performanceColorClass}`}>
              {formatPercentage(changePercent)}
            </div>
            <div className={`text-xs ${performanceColorClass}`}>
              {changeAmount >= 0 ? '+' : ''}
              {formatCurrency(changeAmount)}
            </div>
          </div>
          
          {/* Performance icon */}
          <PerformanceIcon className={`h-4 w-4 ${performanceColorClass}`} />
          
          {/* Navigation indicator */}
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Loading skeleton
  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <Skeleton className="h-4 w-12 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-3" />
          </div>
        </div>
      ))}
    </div>
  )

  // Empty state component
  const renderEmptyState = (title: string, description: string) => (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <TrendingUp className="h-6 w-6 text-muted-foreground" />
      </div>
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Top Performers Section - Requirements 3.1, 3.2 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Top Performers
          </CardTitle>
          {!isLoading && topPerformers.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                // TODO: Navigate to full asset performance view
                console.log('View all top performers clicked')
              }}
            >
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            renderSkeleton()
          ) : topPerformers.length > 0 ? (
            <div className="space-y-2">
              {topPerformers.map((asset, index) => renderAssetItem(asset, index))}
            </div>
          ) : (
            renderEmptyState(
              "No Top Performers",
              "No assets with positive performance found"
            )
          )}
        </CardContent>
      </Card>

      {/* Worst Performers Section - Requirements 3.1, 3.2 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            Worst Performers
          </CardTitle>
          {!isLoading && worstPerformers.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                // TODO: Navigate to full asset performance view
                console.log('View all worst performers clicked')
              }}
            >
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            renderSkeleton()
          ) : worstPerformers.length > 0 ? (
            <div className="space-y-2">
              {worstPerformers.map((asset, index) => renderAssetItem(asset, index))}
            </div>
          ) : (
            renderEmptyState(
              "No Poor Performers",
              "No assets with negative performance found"
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Compact Asset Performance Component
 * 
 * A more compact version for use in smaller spaces or mobile layouts
 */
export function CompactAssetPerformance({
  topPerformers,
  worstPerformers,
  isLoading = false
}: AssetPerformanceProps) {
  const navigate = useNavigate()

  const handleAssetClick = (assetId: string) => {
    navigate({ to: `/assets/${assetId}` })
  }

  const renderCompactAssetItem = (assetPerformance: AssetPerformance, index: number) => {
    const { asset, changePercent } = assetPerformance
    const performanceColorClass = getPerformanceColorClass(changePercent)
    const PerformanceIcon = changePercent >= 0 ? TrendingUp : TrendingDown

    return (
      <div
        key={`${asset.id}-${index}`}
        className="flex items-center justify-between py-2 cursor-pointer hover:bg-muted/50 rounded px-2 transition-colors"
        onClick={() => handleAssetClick(asset.id)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <PerformanceIcon className={`h-3 w-3 ${performanceColorClass}`} />
          <span className="text-sm truncate">{asset.name}</span>
          {asset.symbol && (
            <Badge variant="outline" className="text-xs">
              {asset.symbol}
            </Badge>
          )}
        </div>
        <div className={`text-sm font-medium ${performanceColorClass}`}>
          {formatPercentage(changePercent)}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Asset Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const hasData = topPerformers.length > 0 || worstPerformers.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Asset Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-1">
            {topPerformers.slice(0, 2).map((asset, index) => 
              renderCompactAssetItem(asset, index)
            )}
            {worstPerformers.slice(0, 2).map((asset, index) => 
              renderCompactAssetItem(asset, index + topPerformers.length)
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            No performance data available
          </p>
        )}
      </CardContent>
    </Card>
  )
}
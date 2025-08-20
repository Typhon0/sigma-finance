import React, { Suspense, lazy } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AssetAllocationData } from '@/lib/types/dashboard.types'
import { formatCurrency } from '@/lib/utils/portfolio-calculations'

// Lazy load the chart component
const AssetAllocationChart = lazy(() => import('./asset-allocation-chart'))

interface LazyAssetAllocationChartProps {
  allocationData: AssetAllocationData[]
  isLoading?: boolean
  onAssetTypeClick?: (assetType: string) => void
  className?: string
}

// Fallback component for lazy loading
function ChartLoadingFallback({ totalValue }: { totalValue: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Asset Allocation</span>
          <Badge variant="secondary" className="text-sm">
            Total: {formatCurrency(totalValue)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-16 mb-1" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function LazyAssetAllocationChart({
  allocationData,
  isLoading = false,
  onAssetTypeClick,
  className,
}: LazyAssetAllocationChartProps) {
  // Calculate total value for fallback display
  const totalValue = React.useMemo(() => {
    return allocationData.reduce((sum, item) => sum + item.value, 0)
  }, [allocationData])

  // If loading or no data, show immediate feedback
  if (isLoading) {
    return <ChartLoadingFallback totalValue={totalValue} />
  }

  if (!allocationData || allocationData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <div className="text-muted-foreground mb-2">
              No asset data available
            </div>
            <div className="text-sm text-muted-foreground">
              Add some assets to your portfolios to see allocation breakdown
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Suspense fallback={<ChartLoadingFallback totalValue={totalValue} />}>
      <AssetAllocationChart
        allocationData={allocationData}
        isLoading={isLoading}
        onAssetTypeClick={onAssetTypeClick}
        className={className}
      />
    </Suspense>
  )
}

export default LazyAssetAllocationChart
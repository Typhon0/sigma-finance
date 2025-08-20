import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Chart } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AssetAllocationData } from '@/lib/types/dashboard.types'
import { formatCurrency } from '@/lib/utils/portfolio-calculations'
import { getAssetTypeColor } from '@/lib/chart-colors'
import * as echarts from 'echarts'

// Helper function to format asset type names for display
function formatAssetTypeName(assetType: string): string {
  return assetType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase())
}

interface AssetAllocationChartProps {
  allocationData: AssetAllocationData[]
  isLoading?: boolean
  onAssetTypeClick?: (assetType: string) => void
  className?: string
}

export function AssetAllocationChart({
  allocationData,
  isLoading = false,
  onAssetTypeClick,
  className,
}: AssetAllocationChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!allocationData || allocationData.length === 0) {
      return []
    }

    return allocationData
      .filter(item => item.value > 0) // Only show asset types with value
      .sort((a, b) => b.value - a.value) // Sort by value descending
      .map(item => ({
        name: formatAssetTypeName(item.assetType), // Format asset type name
        value: item.value,
        percentage: item.percentage,
        itemStyle: {
          color: getAssetTypeColor(item.assetType),
        },
      }))
  }, [allocationData])

  // Calculate total value for display
  const totalValue = useMemo(() => {
    return allocationData.reduce((sum, item) => sum + item.value, 0)
  }, [allocationData])

  // ECharts option configuration
  const chartOption: echarts.EChartsOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const data = params.data
          return `
            <div class="font-medium">${data.name}</div>
            <div class="text-sm">
              <div>Value: ${formatCurrency(data.value)}</div>
              <div>Percentage: ${data.percentage.toFixed(1)}%</div>
            </div>
          `
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: {
          color: '#374151',
        },
      },
      legend: {
        type: 'scroll',
        orient: 'horizontal',
        bottom: 0,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          fontSize: 12,
        },
        formatter: (name: string) => {
          const item = chartData.find(d => d.name === name)
          return item ? `${name} (${item.percentage.toFixed(1)}%)` : name
        },
      },
      series: [
        {
          name: 'Asset Allocation',
          type: 'pie',
          radius: ['40%', '70%'], // Donut chart
          center: ['50%', '45%'], // Adjust center to account for legend
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              formatter: '{b}\n{d}%',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          labelLine: {
            show: false,
          },
          data: chartData,
        },
      ],
    }
  }, [chartData])

  // Handle chart click events
  const handleChartClick = (params: any) => {
    if (onAssetTypeClick && params.data) {
      // Find the original asset type from the allocation data
      const originalItem = allocationData.find(data => 
        formatAssetTypeName(data.assetType) === params.data.name
      )
      if (originalItem) {
        onAssetTypeClick(originalItem.assetType)
      }
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[300px] w-full rounded-lg" />
            <div className="flex flex-wrap gap-2 justify-center">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-6 w-20" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (!chartData || chartData.length === 0) {
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
    <Card className={className}>
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
          {/* Chart */}
          <Chart
            option={chartOption}
            onClick={handleChartClick}
            className="h-[300px]"
          />
          
          {/* Asset type breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t">
            {chartData.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => {
                  // Find the original asset type from the allocation data
                  const originalItem = allocationData.find(data => 
                    formatAssetTypeName(data.assetType) === item.name
                  )
                  if (originalItem) {
                    onAssetTypeClick?.(originalItem.assetType)
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.itemStyle.color }}
                  />
                  <div>
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-sm">
                    {formatCurrency(item.value)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Export for testing
export { AssetAllocationChart as default }
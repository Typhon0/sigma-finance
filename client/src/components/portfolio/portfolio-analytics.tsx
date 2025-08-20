import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Chart } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Activity, PieChart, BarChart3, LineChart } from 'lucide-react'
import { formatCurrency, formatPercentage } from '@/lib/utils/portfolio-calculations'
import { getChartColors, getAssetTypeColor } from '@/lib/chart-colors'
import * as echarts from 'echarts'

// Types for portfolio analytics
export interface PortfolioAnalytics {
  portfolioId: string
  totalValue: number
  totalCost: number
  totalGainLoss: number
  totalGainLossPercent: number
  assetAllocation: AssetAllocation[]
  riskMetrics: RiskMetrics
  performanceHistory: PerformancePoint[]
}

export interface AssetAllocation {
  assetType: string
  value: number
  percentage: number
  count: number
}

export interface RiskMetrics {
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  diversification: number
}

export interface PerformancePoint {
  date: string
  value: number
}

interface PortfolioAnalyticsProps {
  analytics: PortfolioAnalytics | null
  isLoading?: boolean
  error?: Error | null
  className?: string
}

type TimePeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'

export function PortfolioAnalytics({
  analytics,
  isLoading = false,
  error = null,
  className,
}: PortfolioAnalyticsProps) {
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<TimePeriod>('1M')
  const [activeTab, setActiveTab] = useState('overview')

  // Filter performance history based on selected time period
  const filteredPerformanceHistory = useMemo(() => {
    if (!analytics?.performanceHistory) return []

    const now = new Date()
    let startDate = new Date()

    switch (selectedTimePeriod) {
      case '1D':
        startDate.setDate(now.getDate() - 1)
        break
      case '1W':
        startDate.setDate(now.getDate() - 7)
        break
      case '1M':
        startDate.setMonth(now.getMonth() - 1)
        break
      case '3M':
        startDate.setMonth(now.getMonth() - 3)
        break
      case '6M':
        startDate.setMonth(now.getMonth() - 6)
        break
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      case 'ALL':
        return analytics.performanceHistory
    }

    return analytics.performanceHistory.filter(point => 
      new Date(point.date) >= startDate
    )
  }, [analytics?.performanceHistory, selectedTimePeriod])

  // Asset allocation chart configuration
  const assetAllocationOption: echarts.EChartsOption = useMemo(() => {
    if (!analytics?.assetAllocation) return {}

    const data = analytics.assetAllocation.map(allocation => ({
      name: allocation.assetType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      value: allocation.value,
      percentage: allocation.percentage,
      itemStyle: {
        color: getAssetTypeColor(allocation.assetType),
      },
    }))

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
      },
      series: [
        {
          name: 'Asset Allocation',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
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
          },
          data,
        },
      ],
    }
  }, [analytics?.assetAllocation])

  // Performance history chart configuration
  const performanceHistoryOption: echarts.EChartsOption = useMemo(() => {
    if (!filteredPerformanceHistory.length) return {}

    const dates = filteredPerformanceHistory.map(point => point.date)
    const values = filteredPerformanceHistory.map(point => point.value)

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const point = params[0]
          return `
            <div class="font-medium">${point.axisValue}</div>
            <div class="text-sm">
              <div>Portfolio Value: ${formatCurrency(point.value)}</div>
            </div>
          `
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          formatter: (value: string) => {
            const date = new Date(value)
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series: [
        {
          name: 'Portfolio Value',
          type: 'line',
          data: values,
          smooth: true,
          lineStyle: {
            width: 3,
            color: analytics && analytics.totalGainLoss >= 0 ? '#22c55e' : '#ef4444',
          },
          areaStyle: {
            opacity: 0.1,
            color: analytics && analytics.totalGainLoss >= 0 ? '#22c55e' : '#ef4444',
          },
        },
      ],
    }
  }, [filteredPerformanceHistory, analytics])

  // Risk metrics visualization
  const riskMetricsOption: echarts.EChartsOption = useMemo(() => {
    if (!analytics?.riskMetrics) return {}

    const metrics = [
      { name: 'Volatility', value: analytics.riskMetrics.volatility * 100, max: 50 },
      { name: 'Sharpe Ratio', value: analytics.riskMetrics.sharpeRatio, max: 3 },
      { name: 'Max Drawdown', value: Math.abs(analytics.riskMetrics.maxDrawdown) * 100, max: 50 },
      { name: 'Diversification', value: analytics.riskMetrics.diversification, max: 100 },
    ]

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      xAxis: {
        type: 'category',
        data: metrics.map(m => m.name),
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: 'Risk Metrics',
          type: 'bar',
          data: metrics.map(m => ({
            value: m.value,
            itemStyle: {
              color: getChartColors()[0],
            },
          })),
          barWidth: '60%',
        },
      ],
    }
  }, [analytics?.riskMetrics])

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-[400px]" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <div className="text-lg font-medium text-destructive mb-2">
                Failed to Load Analytics
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                {error.message || 'Unable to calculate portfolio analytics'}
              </div>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Empty state
  if (!analytics) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <PieChart className="h-12 w-12 text-muted-foreground mb-4" />
              <div className="text-lg font-medium mb-2">
                No Analytics Available
              </div>
              <div className="text-sm text-muted-foreground">
                Add some assets to your portfolio to see analytics
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Portfolio Analytics</span>
            <div className="flex items-center gap-2">
              <Select value={selectedTimePeriod} onValueChange={(value: TimePeriod) => setSelectedTimePeriod(value)}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1D">1D</SelectItem>
                  <SelectItem value="1W">1W</SelectItem>
                  <SelectItem value="1M">1M</SelectItem>
                  <SelectItem value="3M">3M</SelectItem>
                  <SelectItem value="6M">6M</SelectItem>
                  <SelectItem value="1Y">1Y</SelectItem>
                  <SelectItem value="ALL">ALL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(analytics.totalValue)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
                    <p className={`text-2xl font-bold ${analytics.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(analytics.totalGainLoss)}
                    </p>
                  </div>
                  {analytics.totalGainLoss >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-600" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Performance</p>
                    <p className={`text-2xl font-bold ${analytics.totalGainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(analytics.totalGainLossPercent)}
                    </p>
                  </div>
                  <Badge variant={analytics.totalGainLossPercent >= 0 ? 'default' : 'destructive'}>
                    {analytics.totalGainLossPercent >= 0 ? 'Gain' : 'Loss'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Diversification</p>
                    <p className="text-2xl font-bold">{analytics.riskMetrics.diversification.toFixed(0)}%</p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Allocation
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-2">
                <LineChart className="h-4 w-4" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="risk" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Risk Metrics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Asset Allocation</h3>
                <Chart
                  option={assetAllocationOption}
                  className="h-[400px]"
                />
                
                {/* Asset allocation breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t">
                  {analytics.assetAllocation.map((allocation, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getAssetTypeColor(allocation.assetType) }}
                        />
                        <div>
                          <div className="font-medium text-sm">
                            {allocation.assetType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {allocation.count} asset{allocation.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">
                          {formatCurrency(allocation.value)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {allocation.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Performance History</h3>
                <Chart
                  option={performanceHistoryOption}
                  className="h-[400px]"
                />
              </div>
            </TabsContent>

            <TabsContent value="risk" className="mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Risk Analysis</h3>
                <Chart
                  option={riskMetricsOption}
                  className="h-[400px]"
                />
                
                {/* Risk metrics explanation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Volatility</span>
                      <span className="text-sm">{(analytics.riskMetrics.volatility * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Sharpe Ratio</span>
                      <span className="text-sm">{analytics.riskMetrics.sharpeRatio.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Max Drawdown</span>
                      <span className="text-sm">{(analytics.riskMetrics.maxDrawdown * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Diversification Score</span>
                      <span className="text-sm">{analytics.riskMetrics.diversification.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default PortfolioAnalytics
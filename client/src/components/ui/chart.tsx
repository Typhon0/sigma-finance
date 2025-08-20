import React, { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { getChartColors, getChartThemeColors } from '@/lib/chart-colors'

export interface ChartProps {
  option: echarts.EChartsOption
  className?: string
  style?: React.CSSProperties
  loading?: boolean
  onChartReady?: (chart: echarts.ECharts) => void
  onClick?: (params: any) => void
  onHover?: (params: any) => void
}

export const Chart = React.forwardRef<HTMLDivElement, ChartProps>(
  ({ option, className, style, loading = false, onChartReady, onClick, onHover }, ref) => {
    const chartRef = useRef<HTMLDivElement>(null)
    const chartInstanceRef = useRef<echarts.ECharts | null>(null)
    const { theme } = useTheme()
    const [isClient, setIsClient] = useState(false)

    // Ensure we're on the client side
    useEffect(() => {
      setIsClient(true)
    }, [])

    // Create themed ECharts option
    const createThemedOption = (baseOption: echarts.EChartsOption): echarts.EChartsOption => {
      const colors = getChartThemeColors()
      const chartColors = getChartColors()

      return {
        ...baseOption,
        color: chartColors,
        backgroundColor: colors.background,
        textStyle: {
          color: colors.foreground,
          fontFamily: 'inherit',
        },
        tooltip: {
          ...baseOption.tooltip,
          backgroundColor: colors.card,
          borderColor: colors.border,
          textStyle: {
            color: colors.cardForeground,
            fontFamily: 'inherit',
          },
        },
        legend: {
          ...baseOption.legend,
          textStyle: {
            color: colors.foreground,
            fontFamily: 'inherit',
          },
        },
      }
    }

    // Initialize chart
    useEffect(() => {
      if (!isClient || !chartRef.current) return

      const chartInstance = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
        useDirtyRect: false,
      })

      chartInstanceRef.current = chartInstance

      // Set up event listeners
      if (onClick) {
        chartInstance.on('click', onClick)
      }
      
      if (onHover) {
        chartInstance.on('mouseover', onHover)
      }

      // Notify parent component
      if (onChartReady) {
        onChartReady(chartInstance)
      }

      // Handle resize
      const handleResize = () => {
        chartInstance.resize()
      }

      window.addEventListener('resize', handleResize)

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize)
        chartInstance.dispose()
        chartInstanceRef.current = null
      }
    }, [isClient, onClick, onHover, onChartReady])

    // Update chart option when it changes or theme changes
    useEffect(() => {
      if (!chartInstanceRef.current || !isClient) return

      const themedOption = createThemedOption(option)
      chartInstanceRef.current.setOption(themedOption, true)
    }, [option, theme, isClient])

    // Handle loading state
    useEffect(() => {
      if (!chartInstanceRef.current) return

      if (loading) {
        const colors = getChartThemeColors()
        chartInstanceRef.current.showLoading('default', {
          text: 'Loading...',
          color: colors.foreground,
          textColor: colors.foreground,
          maskColor: 'rgba(0, 0, 0, 0.05)',
        })
      } else {
        chartInstanceRef.current.hideLoading()
      }
    }, [loading])

    // Handle container queries for responsive sizing
    useEffect(() => {
      if (!chartRef.current || !chartInstanceRef.current) return

      const resizeObserver = new ResizeObserver(() => {
        chartInstanceRef.current?.resize()
      })

      resizeObserver.observe(chartRef.current)

      return () => {
        resizeObserver.disconnect()
      }
    }, [])

    if (!isClient) {
      return (
        <div
          ref={ref}
          className={cn('h-[400px] w-full', className)}
          style={style}
        >
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Loading chart...
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn('h-[400px] w-full', className)}
        style={style}
      >
        <div
          ref={chartRef}
          className="h-full w-full"
        />
      </div>
    )
  }
)

Chart.displayName = 'Chart'

// Export chart colors hook for consistency
export const useChartColors = () => {
  const { theme } = useTheme()
  
  return React.useMemo(() => {
    return getChartColors()
  }, [theme])
}
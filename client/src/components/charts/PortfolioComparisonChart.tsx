import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Maximize2, Minimize2, Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  createPortfolioComparisonChart, 
  EChartsDataFormatter,
  EChartsPerformanceManager 
} from '@/lib/charts/echarts';
import { getChartColors } from '@/lib/chart-colors';
import { cn } from '@/lib/utils';

export interface PortfolioPerformanceData {
  date: string;
  value: number;
}

export interface PortfolioComparisonData {
  id: string;
  name: string;
  data: PortfolioPerformanceData[];
  color?: string;
  visible?: boolean;
}

export interface PortfolioComparisonChartProps {
  portfolios: PortfolioComparisonData[];
  title?: string;
  metric?: 'value' | 'return' | 'allocation';
  timeRange?: string;
  height?: number;
  className?: string;
  showHeader?: boolean;
  showExport?: boolean;
  showFullscreen?: boolean;
  showLegend?: boolean;
  compact?: boolean;
  yAxisFormatter?: (value: number) => string;
  onTimeRangeChange?: (range: string) => void;
  onPortfolioToggle?: (portfolioId: string, visible: boolean) => void;
  onExport?: (format: 'png' | 'svg') => void;
  loading?: boolean;
  error?: string;
}

const PortfolioComparisonChart: React.FC<PortfolioComparisonChartProps> = ({
  portfolios,
  title = 'Portfolio Comparison',
  metric = 'value',
  timeRange,
  height = 400,
  className,
  showHeader = true,
  showExport = true,
  showFullscreen = true,
  showLegend = true,
  compact = false,
  yAxisFormatter,
  onTimeRangeChange,
  onPortfolioToggle,
  onExport,
  loading = false,
  error,
}) => {
  const chartRef = useRef<ReactECharts>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [visiblePortfolios, setVisiblePortfolios] = React.useState<Set<string>>(
    new Set(portfolios.map(p => p.id))
  );

  // Get chart colors
  const chartColors = getChartColors();

  // Filter visible portfolios and optimize data
  const processedPortfolios = useMemo(() => {
    return portfolios
      .filter(portfolio => visiblePortfolios.has(portfolio.id))
      .map((portfolio, index) => ({
        ...portfolio,
        data: EChartsPerformanceManager.sampleData(portfolio.data),
        color: portfolio.color || chartColors[index % chartColors.length],
      }));
  }, [portfolios, visiblePortfolios, chartColors]);

  // Create chart configuration
  const chartOption = useMemo((): EChartsOption => {
    if (!processedPortfolios || processedPortfolios.length === 0) {
      return {};
    }

    const formatter = yAxisFormatter || ((value: number) => {
      switch (metric) {
        case 'return':
          return EChartsDataFormatter.formatPercentage(value);
        case 'value':
          return EChartsDataFormatter.formatCurrency(value);
        default:
          return EChartsDataFormatter.formatLargeNumber(value);
      }
    });

    const baseConfig = createPortfolioComparisonChart(processedPortfolios, {
      title: showHeader ? undefined : title,
      yAxisFormatter: formatter,
    });

    // Add performance optimizations for large datasets
    const totalDataPoints = processedPortfolios.reduce((sum, p) => sum + p.data.length, 0);
    if (totalDataPoints > 1000) {
      Object.assign(baseConfig, EChartsPerformanceManager.getPerformanceOptions());
    }

    // Compact mode adjustments
    if (compact) {
      return {
        ...baseConfig,
        grid: {
          ...baseConfig.grid,
          left: '5%',
          right: '5%',
          top: showLegend ? '15%' : '10%',
          bottom: '15%',
        },
        legend: showLegend ? {
          ...baseConfig.legend,
          top: 0,
          textStyle: {
            fontSize: 10,
          },
        } : undefined,
        xAxis: {
          ...baseConfig.xAxis,
          axisLabel: {
            ...baseConfig.xAxis?.axisLabel,
            fontSize: 10,
          },
        },
        yAxis: {
          ...baseConfig.yAxis,
          axisLabel: {
            ...baseConfig.yAxis?.axisLabel,
            fontSize: 10,
          },
        },
      };
    }

    // Add legend if not compact
    if (showLegend && !compact) {
      baseConfig.legend = {
        ...baseConfig.legend,
        show: true,
        top: 'top',
        left: 'center',
      };
    }

    return baseConfig;
  }, [processedPortfolios, title, showHeader, yAxisFormatter, metric, compact, showLegend]);

  // Handle portfolio visibility toggle
  const handlePortfolioToggle = (portfolioId: string) => {
    const newVisiblePortfolios = new Set(visiblePortfolios);
    if (newVisiblePortfolios.has(portfolioId)) {
      newVisiblePortfolios.delete(portfolioId);
    } else {
      newVisiblePortfolios.add(portfolioId);
    }
    setVisiblePortfolios(newVisiblePortfolios);
    onPortfolioToggle?.(portfolioId, newVisiblePortfolios.has(portfolioId));
  };

  // Handle export functionality
  const handleExport = (format: 'png' | 'svg') => {
    if (chartRef.current) {
      const chartInstance = chartRef.current.getEchartsInstance();
      const dataURL = chartInstance.getDataURL({
        type: format,
        pixelRatio: 2,
        backgroundColor: '#fff',
      });
      
      // Create download link
      const link = document.createElement('a');
      link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-chart.${format}`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    onExport?.(format);
  };

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Resize chart when fullscreen changes
  useEffect(() => {
    if (chartRef.current) {
      const chartInstance = chartRef.current.getEchartsInstance();
      setTimeout(() => chartInstance.resize(), 100);
    }
  }, [isFullscreen]);

  // Update visible portfolios when portfolios prop changes
  useEffect(() => {
    setVisiblePortfolios(new Set(portfolios.map(p => p.id)));
  }, [portfolios]);

  // Loading state
  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div 
            className="flex items-center justify-center bg-muted/50 rounded-lg"
            style={{ height }}
          >
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading comparison data...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('w-full', className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div 
            className="flex items-center justify-center bg-destructive/10 rounded-lg"
            style={{ height }}
          >
            <div className="text-center text-destructive">
              <p className="font-medium">Failed to load chart</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!portfolios || portfolios.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div 
            className="flex items-center justify-center bg-muted/50 rounded-lg"
            style={{ height }}
          >
            <div className="text-center text-muted-foreground">
              <p className="font-medium">No portfolios to compare</p>
              <p className="text-sm">Add multiple portfolios to see comparison charts</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartContent = (
    <ReactECharts
      ref={chartRef}
      option={chartOption}
      style={{ 
        height: isFullscreen ? '70vh' : height,
        width: '100%'
      }}
      opts={{
        renderer: 'canvas',
        useDirtyRect: true,
      }}
    />
  );

  if (!showHeader) {
    return (
      <div className={cn('w-full', className)}>
        {chartContent}
      </div>
    );
  }

  return (
    <Card className={cn('w-full', isFullscreen && 'fixed inset-4 z-50 bg-background', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {/* Time range selector */}
            {onTimeRangeChange && (
              <div className="flex items-center gap-1">
                {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onTimeRangeChange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            )}
            
            {/* Export button */}
            {showExport && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleExport('png')}
                title="Export chart"
              >
                <Download className="h-3 w-3" />
              </Button>
            )}
            
            {/* Fullscreen toggle */}
            {showFullscreen && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Portfolio visibility controls */}
        {portfolios.length > 1 && !compact && (
          <div className="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg">
            {portfolios.map((portfolio, index) => (
              <div key={portfolio.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`portfolio-${portfolio.id}`}
                  checked={visiblePortfolios.has(portfolio.id)}
                  onCheckedChange={() => handlePortfolioToggle(portfolio.id)}
                />
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: portfolio.color || chartColors[index % chartColors.length] 
                    }}
                  />
                  <label 
                    htmlFor={`portfolio-${portfolio.id}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {portfolio.name}
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Chart */}
        <div className="relative">
          {chartContent}
          
          {/* No visible portfolios overlay */}
          {visiblePortfolios.size === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
              <div className="text-center text-muted-foreground">
                <EyeOff className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">No portfolios visible</p>
                <p className="text-sm">Select portfolios to display in the chart</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Compact mode portfolio list */}
        {compact && portfolios.length > 1 && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {portfolios.slice(0, 4).map((portfolio, index) => (
              <div key={portfolio.id} className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ 
                    backgroundColor: portfolio.color || chartColors[index % chartColors.length] 
                  }}
                />
                <span className="truncate">{portfolio.name}</span>
                {visiblePortfolios.has(portfolio.id) ? (
                  <Eye className="h-3 w-3 text-muted-foreground ml-auto" />
                ) : (
                  <EyeOff className="h-3 w-3 text-muted-foreground ml-auto" />
                )}
              </div>
            ))}
            {portfolios.length > 4 && (
              <div className="text-muted-foreground col-span-2 text-center">
                +{portfolios.length - 4} more portfolios
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PortfolioComparisonChart;
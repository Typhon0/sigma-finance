import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Target, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import PerformanceChart from '@/components/charts/PerformanceChart';
import { formatCurrency, formatPercentage, getPerformanceColorClass } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

export interface BenchmarkData {
  id: string;
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  data: Array<{ date: string; value: number }>;
  color?: string;
}

export interface PortfolioPerformanceData {
  id: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  data: Array<{ date: string; value: number }>;
  color?: string;
}

export interface PerformanceComparisonProps {
  portfolioData: PortfolioPerformanceData[];
  benchmarks: BenchmarkData[];
  availableBenchmarks?: BenchmarkData[];
  timeRange?: string;
  isLoading?: boolean;
  className?: string;
  compact?: boolean;
  showChart?: boolean;
  onTimeRangeChange?: (range: string) => void;
  onBenchmarkAdd?: (benchmarkId: string) => void;
  onBenchmarkRemove?: (benchmarkId: string) => void;
  onPortfolioToggle?: (portfolioId: string) => void;
}

const defaultBenchmarks: BenchmarkData[] = [
  {
    id: 'sp500',
    name: 'S&P 500',
    symbol: 'SPY',
    value: 4500,
    change: 45.2,
    changePercent: 1.02,
    data: [],
    color: '#3b82f6'
  },
  {
    id: 'nasdaq',
    name: 'NASDAQ',
    symbol: 'QQQ',
    value: 380,
    change: -2.1,
    changePercent: -0.55,
    data: [],
    color: '#10b981'
  },
  {
    id: 'bonds',
    name: 'US Bonds',
    symbol: 'BND',
    value: 75.5,
    change: 0.15,
    changePercent: 0.20,
    data: [],
    color: '#f59e0b'
  }
];

const timeRanges = [
  { value: '1D', label: '1 Day' },
  { value: '1W', label: '1 Week' },
  { value: '1M', label: '1 Month' },
  { value: '3M', label: '3 Months' },
  { value: '6M', label: '6 Months' },
  { value: '1Y', label: '1 Year' },
  { value: 'ALL', label: 'All Time' }
];

const PerformanceTable: React.FC<{
  portfolios: PortfolioPerformanceData[];
  benchmarks: BenchmarkData[];
  compact?: boolean;
  onPortfolioToggle?: (portfolioId: string) => void;
  onBenchmarkRemove?: (benchmarkId: string) => void;
}> = ({ portfolios, benchmarks, compact = false, onPortfolioToggle, onBenchmarkRemove }) => {
  const allItems = [
    ...portfolios.map(p => ({ ...p, type: 'portfolio' as const })),
    ...benchmarks.map(b => ({ ...b, type: 'benchmark' as const }))
  ];

  return (
    <div className="space-y-2">
      <div className={cn(
        "grid grid-cols-5 gap-4 text-xs font-medium text-muted-foreground border-b pb-2",
        compact && "grid-cols-4"
      )}>
        <div>Name</div>
        <div className="text-right">Value</div>
        <div className="text-right">Change</div>
        <div className="text-right">Change %</div>
        {!compact && <div className="text-right">Actions</div>}
      </div>
      
      {allItems.map((item) => (
        <div
          key={`${item.type}-${item.id}`}
          className={cn(
            "grid grid-cols-5 gap-4 items-center py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors",
            compact && "grid-cols-4"
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div>
              <p className={cn("font-medium", compact && "text-sm")}>
                {item.name}
              </p>
              {item.type === 'benchmark' && 'symbol' in item && (
                <p className="text-xs text-muted-foreground">{item.symbol}</p>
              )}
            </div>
            <Badge variant={item.type === 'portfolio' ? 'default' : 'secondary'} className="text-xs">
              {item.type}
            </Badge>
          </div>
          
          <div className="text-right">
            <p className={cn("font-semibold", compact && "text-sm")}>
              {formatCurrency(item.value)}
            </p>
          </div>
          
          <div className="text-right">
            <p className={cn("font-medium", getPerformanceColorClass(item.change), compact && "text-sm")}>
              {formatCurrency(item.change)}
            </p>
          </div>
          
          <div className="text-right">
            <p className={cn("font-medium", getPerformanceColorClass(item.changePercent), compact && "text-sm")}>
              {formatPercentage(item.changePercent)}
            </p>
          </div>
          
          {!compact && (
            <div className="text-right">
              {item.type === 'portfolio' && onPortfolioToggle && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onPortfolioToggle(item.id)}
                  className="h-6 px-2 text-xs"
                >
                  Toggle
                </Button>
              )}
              {item.type === 'benchmark' && onBenchmarkRemove && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onBenchmarkRemove(item.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const PerformanceComparison: React.FC<PerformanceComparisonProps> = ({
  portfolioData,
  benchmarks,
  availableBenchmarks = defaultBenchmarks,
  timeRange = '1M',
  isLoading = false,
  className,
  compact = false,
  showChart = true,
  onTimeRangeChange,
  onBenchmarkAdd,
  onBenchmarkRemove,
  onPortfolioToggle,
}) => {
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>('');

  const chartData = useMemo(() => {
    const allData: Array<{ date: string; value: number; label?: string }> = [];
    
    // Combine portfolio and benchmark data for chart
    [...portfolioData, ...benchmarks].forEach(item => {
      item.data.forEach(point => {
        const existingPoint = allData.find(d => d.date === point.date);
        if (existingPoint) {
          (existingPoint as any)[item.name] = point.value;
        } else {
          allData.push({
            date: point.date,
            value: point.value,
            [item.name]: point.value,
          });
        }
      });
    });
    
    return allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [portfolioData, benchmarks]);

  const handleAddBenchmark = () => {
    if (selectedBenchmark && onBenchmarkAdd) {
      onBenchmarkAdd(selectedBenchmark);
      setSelectedBenchmark('');
    }
  };

  const availableToAdd = availableBenchmarks.filter(
    benchmark => !benchmarks.some(b => b.id === benchmark.id)
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Comparison
          </CardTitle>
          <div className="flex items-center gap-2">
            {onTimeRangeChange && (
              <Select value={timeRange} onValueChange={onTimeRangeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeRanges.map(range => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Benchmark Controls */}
        {onBenchmarkAdd && availableToAdd.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add benchmark..." />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map(benchmark => (
                  <SelectItem key={benchmark.id} value={benchmark.id}>
                    {benchmark.name} ({benchmark.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleAddBenchmark}
              disabled={!selectedBenchmark}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        )}

        {/* Performance Chart */}
        {showChart && chartData.length > 0 && (
          <PerformanceChart
            data={chartData}
            title=""
            height={compact ? 200 : 300}
            showHeader={false}
            compact={compact}
            timeRange={timeRange}
            onTimeRangeChange={onTimeRangeChange}
          />
        )}

        {/* Performance Table */}
        <PerformanceTable
          portfolios={portfolioData}
          benchmarks={benchmarks}
          compact={compact}
          onPortfolioToggle={onPortfolioToggle}
          onBenchmarkRemove={onBenchmarkRemove}
        />

        {/* Summary Statistics */}
        {!compact && (portfolioData.length > 0 || benchmarks.length > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Best Performer</p>
              <p className="font-semibold text-green-600">
                {(() => {
                  const best = [...portfolioData, ...benchmarks].reduce((prev, current) => 
                    current.changePercent > prev.changePercent ? current : prev
                  );
                  return `${best.name} (+${best.changePercent.toFixed(2)}%)`;
                })()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Worst Performer</p>
              <p className="font-semibold text-red-600">
                {(() => {
                  const worst = [...portfolioData, ...benchmarks].reduce((prev, current) => 
                    current.changePercent < prev.changePercent ? current : prev
                  );
                  return `${worst.name} (${worst.changePercent.toFixed(2)}%)`;
                })()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Avg Return</p>
              <p className="font-semibold">
                {(() => {
                  const avg = [...portfolioData, ...benchmarks].reduce((sum, item) => sum + item.changePercent, 0) / 
                           (portfolioData.length + benchmarks.length);
                  return formatPercentage(avg);
                })()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Outperforming</p>
              <p className="font-semibold text-green-600">
                {(() => {
                  const benchmarkAvg = benchmarks.reduce((sum, b) => sum + b.changePercent, 0) / benchmarks.length;
                  const outperforming = portfolioData.filter(p => p.changePercent > benchmarkAvg).length;
                  return `${outperforming}/${portfolioData.length}`;
                })()}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceComparison;
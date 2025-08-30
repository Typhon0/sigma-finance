# Chart Libraries Configuration

This directory contains the complete configuration and utilities for chart libraries used in the portfolio tracker application.

## Libraries Included

### Lightweight Charts™ (v5.0.8)
- **Purpose**: Interactive candlestick charts for market data (stocks and cryptocurrencies)
- **Features**: Real-time updates, high performance, touch-optimized
- **Use Cases**: Asset price charts, volume indicators, technical analysis

### Apache ECharts (via echarts-for-react v3.0.2)
- **Purpose**: Analytics and visualization charts
- **Features**: Rich chart types, animations, responsive design
- **Use Cases**: Portfolio performance, allocation charts, comparison visualizations

## File Structure

```
charts/
├── index.ts                 # Main exports and library manager
├── lightweight-charts.ts    # Lightweight Charts configuration
├── echarts.ts              # Apache ECharts configuration
├── config.ts               # Chart configuration utilities
├── data-formatters.ts      # Data transformation utilities
├── performance.ts          # Performance optimization utilities
└── README.md               # This documentation
```

## Quick Start

### 1. Import Chart Utilities

```typescript
import {
  ChartLibraryManager,
  createChartConfig,
  useChartTheme,
  LightweightChartsFormatter,
  EChartsFormatter,
} from '@/lib/charts';
```

### 2. Initialize Libraries

```typescript
// Libraries are auto-initialized, but you can check status
const status = ChartLibraryManager.getStatus();
console.log('Chart libraries ready:', status.initialized);
```

### 3. Create Chart Configuration

```typescript
// For candlestick charts (Lightweight Charts)
const candlestickConfig = createChartConfig('candlestick')
  .size('large')
  .responsive(true)
  .animation(false)
  .build();

// For performance charts (ECharts)
const performanceConfig = createChartConfig('line')
  .size('medium')
  .responsive(true)
  .legend(true)
  .build();
```

## Chart Types and Recommended Libraries

| Chart Type | Library | Use Case |
|------------|---------|----------|
| Candlestick | Lightweight Charts™ | Stock/crypto price data |
| Line | ECharts | Performance trends |
| Area | ECharts | Portfolio value over time |
| Pie/Donut | ECharts | Asset allocation |
| Bar/Column | ECharts | Metrics comparison |
| Treemap | ECharts | Hierarchical data |
| Histogram | Lightweight Charts™ | Volume data |

## Data Formatting

### Lightweight Charts Data

```typescript
import { LightweightChartsFormatter } from '@/lib/charts';

// Convert raw price data to candlestick format
const candlestickData = LightweightChartsFormatter.toCandlestickData(rawPriceData);

// Convert performance data to line format
const lineData = LightweightChartsFormatter.toLineData(performanceData);
```

### ECharts Data

```typescript
import { EChartsFormatter } from '@/lib/charts';

// Format performance data for line charts
const { dates, values, formattedData } = EChartsFormatter.formatPerformanceData(performanceData);

// Format allocation data for pie charts
const allocationData = EChartsFormatter.formatAllocationData(rawAllocationData);
```

## Theme Integration

### Using Chart Themes

```typescript
import { useChartTheme } from '@/lib/charts';

function MyChart() {
  const { isDark, lightweight, echarts } = useChartTheme();
  
  // Use theme colors in your charts
  const chartOptions = getDefaultChartOptions(lightweight);
  const echartsConfig = getDefaultEChartsConfig(echarts);
}
```

### Custom Colors

```typescript
import { getChartColors, getAssetTypeColor } from '@/lib/charts';

const chartColors = getChartColors(); // Gets theme-aware colors
const stockColor = getAssetTypeColor('STOCK'); // Gets asset-specific color
```

## Performance Optimization

### Data Sampling

```typescript
import { DataSampler } from '@/lib/charts';

// Sample large datasets for better performance
const sampledData = DataSampler.sampleData(largeDataset, 1000, 'lttb');
```

### Lazy Loading

```typescript
import { ChartLazyLoader } from '@/lib/charts';

// Create lazy-loaded chart component
const LazyChart = ChartLazyLoader.createLazyChart(
  () => import('./MyChart'),
  'MyChart'
);
```

### Performance Monitoring

```typescript
import { ChartPerformanceMonitor } from '@/lib/charts';

// Monitor chart performance
const endMeasurement = ChartPerformanceMonitor.startMeasurement('my-chart');
// ... render chart ...
const metrics = endMeasurement();
console.log('Render time:', metrics.renderTime);
```

## Chart Configuration Examples

### Candlestick Chart (Lightweight Charts™)

```typescript
import { 
  createChart, 
  getDefaultChartOptions, 
  getDefaultCandlestickOptions,
  useChartTheme 
} from '@/lib/charts';

function CandlestickChart({ data }: { data: CandlestickData[] }) {
  const { lightweight } = useChartTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    
    const chart = createChart(chartRef.current, getDefaultChartOptions(lightweight));
    const candlestickSeries = chart.addCandlestickSeries(getDefaultCandlestickOptions(lightweight));
    
    candlestickSeries.setData(data);
    
    return () => chart.remove();
  }, [data, lightweight]);
  
  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
}
```

### Performance Line Chart (ECharts)

```typescript
import ReactECharts from 'echarts-for-react';
import { createPerformanceLineChart, useChartTheme } from '@/lib/charts';

function PerformanceChart({ data }: { data: Array<{ date: string; value: number }> }) {
  const { echarts } = useChartTheme();
  
  const option = createPerformanceLineChart(data, {
    title: 'Portfolio Performance',
    yAxisFormatter: (value: number) => `$${value.toLocaleString()}`,
  });
  
  return (
    <ReactECharts
      option={option}
      style={{ width: '100%', height: '400px' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
```

### Asset Allocation Pie Chart (ECharts)

```typescript
import ReactECharts from 'echarts-for-react';
import { createAllocationPieChart } from '@/lib/charts';

function AllocationChart({ data }: { data: Array<{ name: string; value: number; assetType: string }> }) {
  const option = createAllocationPieChart(data, {
    title: 'Asset Allocation',
    showPercentage: true,
  });
  
  return (
    <ReactECharts
      option={option}
      style={{ width: '100%', height: '400px' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
```

## Error Handling

### Chart Error Boundary

```typescript
import { ChartErrorHandler } from '@/lib/charts';

const ChartErrorBoundary = ChartErrorHandler.createErrorBoundary(
  ({ error }) => <div>Chart failed to load: {error.message}</div>
);

function App() {
  return (
    <ChartErrorBoundary>
      <MyChart />
    </ChartErrorBoundary>
  );
}
```

## Accessibility

### Screen Reader Support

```typescript
import { ChartAccessibility } from '@/lib/charts';

function AccessibleChart({ data, type }: { data: any[]; type: string }) {
  const description = ChartAccessibility.generateDescription(data, type);
  const instructions = ChartAccessibility.generateKeyboardInstructions(type);
  
  return (
    <div>
      <div aria-label={description} aria-describedby="chart-instructions">
        {/* Chart component */}
      </div>
      <div id="chart-instructions" className="sr-only">
        {instructions}
      </div>
    </div>
  );
}
```

## Performance Guidelines

### Data Size Recommendations

- **Candlestick Charts**: Up to 10,000 data points
- **Line Charts**: Up to 5,000 data points  
- **Pie Charts**: Up to 20 segments
- **Bar Charts**: Up to 1,000 bars

### Optimization Strategies

1. **Use data sampling** for large datasets
2. **Enable virtualization** for very large datasets
3. **Disable animations** for performance-critical charts
4. **Use debounced updates** for real-time data
5. **Implement lazy loading** for charts below the fold

### Memory Management

```typescript
import { ChartMemoryManager } from '@/lib/charts';

// Register chart for cleanup
ChartMemoryManager.registerChart('my-chart', chartInstance, () => {
  // Custom cleanup logic
});

// Cleanup when component unmounts
useEffect(() => {
  return () => ChartMemoryManager.unregisterChart('my-chart');
}, []);
```

## Troubleshooting

### Common Issues

1. **Charts not rendering**: Check if libraries are initialized
2. **Performance issues**: Enable data sampling or reduce data points
3. **Theme not applied**: Ensure `useChartTheme` is called within theme provider
4. **Memory leaks**: Register charts with `ChartMemoryManager` for proper cleanup

### Debug Mode

```typescript
// Enable debug logging
localStorage.setItem('chart-debug', 'true');

// Check library status
console.log(ChartLibraryManager.getStatus());

// Monitor performance
ChartPerformanceMonitor.checkPerformanceThresholds('my-chart', {
  maxRenderTime: 100,
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB
});
```

## Future Enhancements

- WebGL renderer support for better performance
- Custom chart types and plugins
- Advanced data streaming capabilities
- Enhanced accessibility features
- Mobile-specific optimizations
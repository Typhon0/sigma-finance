# Apache ECharts Components for Portfolio Analytics

This directory contains Apache ECharts-based components optimized for inline analytics in the portfolio tracker dashboard. These components are designed to work seamlessly within the dashboard-centric architecture, providing interactive charts without requiring page navigation.

## Components Overview

### Core Chart Components

#### PerformanceChart
Interactive line/area chart for displaying portfolio performance over time.

```tsx
import { PerformanceChart } from '@/components/charts';

<PerformanceChart
  data={performanceData}
  title="Portfolio Performance"
  chartType="area"
  timeRange="1M"
  onTimeRangeChange={setTimeRange}
  height={350}
/>
```

**Features:**
- Line and area chart types
- Interactive time range selection
- Export functionality (PNG/SVG)
- Fullscreen mode
- Loading and error states
- Responsive design

#### AllocationChart
Pie, donut, and treemap charts for asset allocation visualization.

```tsx
import { AllocationChart } from '@/components/charts';

<AllocationChart
  data={allocationData}
  title="Asset Allocation"
  chartType="donut"
  onSegmentClick={handleAssetClick}
  height={350}
/>
```

**Features:**
- Pie, donut, and treemap chart types
- Interactive segment clicking
- Asset type color coding
- Percentage calculations
- Compact mode for dashboards

#### PortfolioComparisonChart
Multi-line chart for comparing multiple portfolios.

```tsx
import { PortfolioComparisonChart } from '@/components/charts';

<PortfolioComparisonChart
  portfolios={portfolioData}
  title="Portfolio Comparison"
  metric="value"
  onPortfolioToggle={handleToggle}
  height={400}
/>
```

**Features:**
- Multiple portfolio comparison
- Portfolio visibility toggles
- Color-coded lines
- Interactive legend
- Performance ranking

### Compact Chart Variants

Optimized for dashboard integration with minimal space usage.

#### CompactPerformanceChart
```tsx
import { CompactPerformanceChart } from '@/components/charts';

<CompactPerformanceChart
  data={performanceData}
  height={200}
  showTitle={false}
  color="#22c55e"
/>
```

#### CompactAllocationChart
```tsx
import { CompactAllocationChart } from '@/components/charts';

<CompactAllocationChart
  data={allocationData}
  height={200}
  chartType="donut"
  compact={true}
/>
```

### Mini Chart Components

Ultra-compact variants for cards and summaries.

#### MiniPerformanceSparkline
```tsx
import { MiniPerformanceSparkline } from '@/components/charts';

<MiniPerformanceSparkline
  data={weeklyData}
  height={60}
  color="#22c55e"
  showChange={true}
/>
```

#### MiniAllocationDonut
```tsx
import { MiniAllocationDonut } from '@/components/charts';

<MiniAllocationDonut
  data={topHoldings}
  size={80}
  showLegend={true}
/>
```

### Layout Components

#### DashboardChartGrid
Responsive grid layout for organizing multiple charts.

```tsx
import { DashboardChartGrid } from '@/components/charts';

<DashboardChartGrid columns={2} gap="lg">
  <PerformanceChart data={data1} />
  <AllocationChart data={data2} />
</DashboardChartGrid>
```

#### ChartCard
Consistent card wrapper for dashboard charts.

```tsx
import { ChartCard } from '@/components/charts';

<ChartCard 
  title="Performance" 
  subtitle="Last 30 days"
  actions={<TimeRangeSelector />}
>
  <CompactPerformanceChart data={data} />
</ChartCard>
```

## Data Formats

### Performance Data
```typescript
interface PerformanceDataPoint {
  date: string;        // ISO date string
  value: number;       // Portfolio value
  label?: string;      // Optional label
}
```

### Allocation Data
```typescript
interface AllocationDataPoint {
  name: string;        // Asset/category name
  value: number;       // Value in currency
  assetType?: string;  // Asset type for color coding
  percentage?: number; // Percentage (calculated if not provided)
  children?: AllocationDataPoint[]; // For treemap hierarchies
}
```

### Portfolio Comparison Data
```typescript
interface PortfolioComparisonData {
  id: string;          // Unique portfolio ID
  name: string;        // Portfolio display name
  data: PerformanceDataPoint[]; // Performance history
  color?: string;      // Custom color (optional)
  visible?: boolean;   // Visibility state
}
```

## Chart Interactions

### Tooltip Customization
Charts include customized tooltips with proper formatting:

```tsx
import { 
  performanceTooltipFormatter,
  allocationTooltipFormatter,
  comparisonTooltipFormatter 
} from '@/components/charts';

// Tooltips are automatically applied based on chart type
```

### Export Functionality
All charts support export to PNG and SVG formats:

```tsx
<PerformanceChart
  data={data}
  showExport={true}
  onExport={(format) => console.log(`Exported as ${format}`)}
/>
```

### Responsive Design
Charts automatically adapt to different screen sizes:

```tsx
import { useResponsiveChart } from '@/components/charts';

const { breakpoint, config } = useResponsiveChart();
// Returns 'mobile', 'tablet', or 'desktop' with appropriate config
```

## Dashboard Integration

### Inline Portfolio View
These components are designed for the dashboard-centric architecture where portfolio details are shown inline without navigation:

```tsx
import { DashboardIntegrationExample } from '@/components/charts';

// Complete example of dashboard integration
<DashboardIntegrationExample 
  portfolioId="portfolio-1"
  portfolioName="Growth Portfolio"
/>
```

### State Management
Charts work with the dashboard state management system:

```tsx
const [viewState, setViewState] = useState({
  viewMode: 'portfolio-detail',
  selectedPortfolio: portfolio,
});

// Charts update based on selected portfolio
<CompactPerformanceChart 
  data={viewState.selectedPortfolio?.performanceData}
/>
```

## Performance Optimizations

### Data Sampling
Large datasets are automatically sampled for performance:

```tsx
// Automatically samples data when > 1000 points
<PerformanceChart data={largeDataset} />
```

### Lazy Loading
Chart libraries are loaded on demand:

```tsx
// Charts use dynamic imports for better performance
const ReactECharts = lazy(() => import('echarts-for-react'));
```

### Caching
Chart configurations are memoized to prevent unnecessary re-renders:

```tsx
const chartOption = useMemo(() => {
  return createPerformanceLineChart(data, options);
}, [data, options]);
```

## Styling and Theming

Charts automatically adapt to the application theme:

```tsx
// Theme colors are automatically applied
const theme = getEChartsTheme();
const colors = getChartColors();
```

### Custom Colors
Asset types have consistent color mapping:

```tsx
import { getAssetTypeColor } from '@/lib/chart-colors';

const stockColor = getAssetTypeColor('STOCK'); // #e11d48
const cryptoColor = getAssetTypeColor('CRYPTO'); // #0ea5e9
```

## Testing

Components include comprehensive tests:

```bash
npm run test -- ChartComponents
```

Tests cover:
- Component rendering
- Data handling
- Loading states
- Error states
- User interactions
- Responsive behavior

## Examples

See `ChartExamples.tsx` for comprehensive usage examples and `DashboardIntegrationExample.tsx` for dashboard integration patterns.

## Requirements Covered

This implementation addresses the following requirements:

- **3.8, 3.9**: Performance charts with Apache ECharts for line and area charts
- **5.1, 5.2**: Asset allocation pie charts and treemap visualizations  
- **5.5, 5.6**: Portfolio comparison and analytics charts
- **11.10**: Chart export functionality and responsive design
- Dashboard integration with inline portfolio detail views
- Compact chart variants optimized for dashboard space constraints
- Interactive chart handlers and tooltip customization
- Real-time chart updates and smooth animations
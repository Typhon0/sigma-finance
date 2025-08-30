import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import {
  PerformanceChart,
  AllocationChart,
  PortfolioComparisonChart,
  CompactPerformanceChart,
  CompactAllocationChart,
  MiniPerformanceSparkline,
  MiniAllocationDonut,
  DashboardChartGrid,
  ChartCard,
} from './index';
import type {
  PerformanceDataPoint,
  AllocationDataPoint,
  PortfolioComparisonData,
} from './index';

/**
 * Example component showcasing Apache ECharts components
 * This demonstrates all the chart types and their usage patterns
 */

// Sample data generators
const generatePerformanceData = (days: number = 30): PerformanceDataPoint[] => {
  const data: PerformanceDataPoint[] = [];
  const startValue = 10000;
  let currentValue = startValue;
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    
    // Simulate some volatility
    const change = (Math.random() - 0.5) * 0.05; // ±2.5% daily change
    currentValue *= (1 + change);
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(currentValue * 100) / 100,
    });
  }
  
  return data;
};

const generateAllocationData = (): AllocationDataPoint[] => [
  { name: 'Stocks', value: 45000, assetType: 'STOCK', percentage: 45 },
  { name: 'Crypto', value: 25000, assetType: 'CRYPTO', percentage: 25 },
  { name: 'Real Estate', value: 20000, assetType: 'REAL_ESTATE', percentage: 20 },
  { name: 'Cash', value: 10000, assetType: 'BANK_ACCOUNT', percentage: 10 },
];

const generatePortfolioComparison = (): PortfolioComparisonData[] => [
  {
    id: '1',
    name: 'Growth Portfolio',
    data: generatePerformanceData(90),
    color: '#22c55e',
  },
  {
    id: '2',
    name: 'Conservative Portfolio',
    data: generatePerformanceData(90).map(d => ({ ...d, value: d.value * 0.8 })),
    color: '#3b82f6',
  },
  {
    id: '3',
    name: 'Aggressive Portfolio',
    data: generatePerformanceData(90).map(d => ({ ...d, value: d.value * 1.2 })),
    color: '#ef4444',
  },
];

const ChartExamples: React.FC = () => {
  const [performanceData, setPerformanceData] = React.useState(generatePerformanceData);
  const [allocationData, setAllocationData] = React.useState(generateAllocationData);
  const [comparisonData, setComparisonData] = React.useState(generatePortfolioComparison);
  const [timeRange, setTimeRange] = React.useState('1M');

  const refreshData = () => {
    setPerformanceData(generatePerformanceData());
    setAllocationData(generateAllocationData());
    setComparisonData(generatePortfolioComparison());
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Apache ECharts Components</h1>
          <p className="text-muted-foreground mt-2">
            Interactive analytics charts for portfolio management
          </p>
        </div>
        <Button onClick={refreshData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Full-size Charts */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Full-Size Charts</h2>
        
        <DashboardChartGrid columns={2} gap="lg">
          <PerformanceChart
            data={performanceData}
            title="Portfolio Performance"
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            chartType="area"
            height={350}
          />
          
          <AllocationChart
            data={allocationData}
            title="Asset Allocation"
            chartType="donut"
            height={350}
            onSegmentClick={(data) => console.log('Clicked:', data)}
          />
        </DashboardChartGrid>

        <PortfolioComparisonChart
          portfolios={comparisonData}
          title="Portfolio Comparison"
          metric="value"
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          height={400}
        />
      </section>

      {/* Compact Charts */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Compact Charts for Dashboard</h2>
        
        <DashboardChartGrid columns={3} gap="md">
          <ChartCard title="Performance" subtitle="Last 30 days">
            <CompactPerformanceChart
              data={performanceData}
              chartType="area"
              height={180}
            />
          </ChartCard>
          
          <ChartCard title="Allocation" subtitle="Current distribution">
            <CompactAllocationChart
              data={allocationData}
              chartType="donut"
              height={180}
            />
          </ChartCard>
          
          <ChartCard title="Comparison" subtitle="vs other portfolios">
            <CompactPerformanceChart
              data={comparisonData[0].data}
              chartType="line"
              height={180}
              color="#22c55e"
            />
          </ChartCard>
        </DashboardChartGrid>
      </section>

      {/* Mini Charts */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Mini Charts for Cards</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Growth Portfolio</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniPerformanceSparkline
                data={performanceData.slice(-7)}
                height={40}
                color="#22c55e"
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conservative Portfolio</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniPerformanceSparkline
                data={performanceData.slice(-7).map(d => ({ ...d, value: d.value * 0.8 }))}
                height={40}
                color="#3b82f6"
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Asset Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniAllocationDonut
                data={allocationData.slice(0, 3)}
                size={60}
                showLegend={false}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniAllocationDonut
                data={[
                  { name: 'AAPL', value: 15000 },
                  { name: 'GOOGL', value: 12000 },
                  { name: 'MSFT', value: 10000 },
                ]}
                size={60}
                showLegend={true}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Chart Variations */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Chart Variations</h2>
        
        <DashboardChartGrid columns={2} gap="lg">
          <Card>
            <CardHeader>
              <CardTitle>Line Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart
                data={performanceData}
                chartType="line"
                height={250}
                showHeader={false}
                color="#8b5cf6"
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Pie Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationChart
                data={allocationData}
                chartType="pie"
                height={250}
                showHeader={false}
              />
            </CardContent>
          </Card>
        </DashboardChartGrid>
        
        <Card>
          <CardHeader>
            <CardTitle>Treemap Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationChart
              data={[
                {
                  name: 'Technology',
                  value: 50000,
                  children: [
                    { name: 'AAPL', value: 20000 },
                    { name: 'GOOGL', value: 15000 },
                    { name: 'MSFT', value: 15000 },
                  ],
                },
                {
                  name: 'Finance',
                  value: 30000,
                  children: [
                    { name: 'JPM', value: 15000 },
                    { name: 'BAC', value: 15000 },
                  ],
                },
                { name: 'Healthcare', value: 20000 },
              ]}
              chartType="treemap"
              height={300}
              showHeader={false}
            />
          </CardContent>
        </Card>
      </section>

      {/* Interactive Features */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Interactive Features</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Zoomable Performance Chart</CardTitle>
              <p className="text-sm text-muted-foreground">
                Use mouse wheel to zoom, drag to pan
              </p>
            </CardHeader>
            <CardContent>
              <PerformanceChart
                data={generatePerformanceData(365)}
                height={300}
                showHeader={false}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Clickable Allocation Chart</CardTitle>
              <p className="text-sm text-muted-foreground">
                Click on segments to see details
              </p>
            </CardHeader>
            <CardContent>
              <AllocationChart
                data={allocationData}
                height={300}
                showHeader={false}
                onSegmentClick={(data) => {
                  alert(`Clicked on ${data.name}: $${data.value.toLocaleString()}`);
                }}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Loading and Error States */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Loading & Error States</h2>
        
        <DashboardChartGrid columns={3} gap="md">
          <PerformanceChart
            data={[]}
            title="Loading State"
            loading={true}
            height={200}
          />
          
          <PerformanceChart
            data={[]}
            title="Error State"
            error="Failed to load data"
            height={200}
          />
          
          <PerformanceChart
            data={[]}
            title="No Data State"
            height={200}
          />
        </DashboardChartGrid>
      </section>
    </div>
  );
};

export default ChartExamples;
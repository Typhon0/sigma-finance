import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TradingViewChart from './TradingViewChart';

interface ChartContainerProps {
  symbol: string;
  assetType: string;
  title?: string;
  height?: string;
  className?: string;
  showHeader?: boolean;
  fallbackToSimpleChart?: boolean;
  useLightweightCharts?: boolean;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
  symbol,
  assetType,
  title,
  height = '500px',
  className = '',
  showHeader = true,
  fallbackToSimpleChart = true,
  useLightweightCharts = true,
}) => {
  const chartTitle = title || `${symbol} Chart`;

  if (!showHeader) {
    return (
      <div className={`${className}`} style={{ height }}>
        <TradingViewChart
          symbol={symbol}
          assetType={assetType}
          theme="light" // TODO: Get from theme context
          fallbackToSimpleChart={fallbackToSimpleChart}
          useLightweightCharts={useLightweightCharts}
          height={parseInt(height)}
        />
      </div>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span>{chartTitle}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {assetType}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div style={{ height }}>
          <TradingViewChart
            symbol={symbol}
            assetType={assetType}
            theme="light" // TODO: Get from theme context
            fallbackToSimpleChart={fallbackToSimpleChart}
            useLightweightCharts={useLightweightCharts}
            height={parseInt(height)}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ChartContainer;
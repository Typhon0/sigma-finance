import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, ColorType, CandlestickSeries } from 'lightweight-charts';
import { useMarketData } from '@/hooks/useMarketData';

interface LightweightChartProps {
  symbol: string;
  assetType: string;
  height?: number;
  theme?: 'light' | 'dark';
  interval?: string;
  autoRefresh?: boolean;
}

const LightweightChart: React.FC<LightweightChartProps> = ({
  symbol,
  assetType,
  height = 400,
  theme = 'light',
  interval = '1D',
  autoRefresh = true,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const { data, loading, error, currentPrice } = useMarketData({
    symbol,
    assetType,
    interval,
    autoRefresh,
    refreshInterval: 30000,
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || isInitialized) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: theme === 'dark' ? '#1a1a1a' : '#ffffff' },
        textColor: theme === 'dark' ? '#ffffff' : '#333333',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#2a2a2a' : '#e1e1e1' },
        horzLines: { color: theme === 'dark' ? '#2a2a2a' : '#e1e1e1' },
      },
      crosshair: {
        mode: 1, // Normal crosshair mode
      },
      rightPriceScale: {
        borderColor: theme === 'dark' ? '#485158' : '#cccccc',
      },
      timeScale: {
        borderColor: theme === 'dark' ? '#485158' : '#cccccc',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries,{
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    setIsInitialized(true);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.remove();
      }
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      setIsInitialized(false);
    };
  }, [height, theme, isInitialized]);

  // Update chart data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !data.length) return;

    const chartData: CandlestickData[] = data.map(candle => ({
      time: (new Date(candle.timestamp).getTime() / 1000) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    // Sort by time to ensure proper order
    chartData.sort((a, b) => (a.time as number) - (b.time as number));

    candlestickSeriesRef.current.setData(chartData);

    // Fit content to show all data
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  // Update theme
  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme === 'dark' ? '#1a1a1a' : '#ffffff' },
        textColor: theme === 'dark' ? '#ffffff' : '#333333',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#2a2a2a' : '#e1e1e1' },
        horzLines: { color: theme === 'dark' ? '#2a2a2a' : '#e1e1e1' },
      },
      rightPriceScale: {
        borderColor: theme === 'dark' ? '#485158' : '#cccccc',
      },
      timeScale: {
        borderColor: theme === 'dark' ? '#485158' : '#cccccc',
      },
    });
  }, [theme]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center text-red-500">
          <div className="text-red-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      {/* Current price indicator */}
      {currentPrice && (
        <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 shadow-sm border">
          <div className="text-sm font-medium">
            ${currentPrice.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            Current Price
          </div>
        </div>
      )}
      
      {/* Asset type indicator */}
      <div className="absolute top-2 right-2 z-10">
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {assetType}
        </span>
      </div>

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        className="w-full h-full"
        style={{ height }}
      />
    </div>
  );
};

export default LightweightChart;
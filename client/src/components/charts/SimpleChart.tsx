import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMarketData } from '@/hooks/useMarketData';

interface SimpleChartProps {
  symbol: string;
  assetType: string;
  height?: number;
}

const SimpleChart: React.FC<SimpleChartProps> = ({
  symbol,
  assetType,
  height = 400,
}) => {
  const { data, loading, error, currentPrice } = useMarketData({
    symbol,
    assetType,
    interval: '1D',
    autoRefresh: true,
    refreshInterval: 30000,
  });

  const chartData = data.map(point => ({
    time: new Date(point.timestamp).toLocaleDateString(),
    price: point.close,
    volume: point.volume,
  }));

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
          <p>{error}</p>
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
      
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
            stroke="#666"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            domain={['dataMin - 100', 'dataMax + 100']}
            stroke="#666"
          />
          <Tooltip 
            formatter={(value: number) => [
              `$${value.toLocaleString()}`, 
              'Price'
            ]}
            labelFormatter={(label) => `Date: ${label}`}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#2563eb" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#2563eb' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleChart;
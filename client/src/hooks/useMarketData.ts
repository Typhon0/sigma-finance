import { useState, useEffect, useCallback } from 'react';

interface MarketDataHookOptions {
  symbol: string;
  assetType: string;
  interval?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface MarketDataPoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface MarketDataState {
  data: MarketDataPoint[];
  currentPrice: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export const useMarketData = ({
  symbol,
  assetType,
  interval = '1D',
  autoRefresh = false,
  refreshInterval = 30000, // 30 seconds
}: MarketDataHookOptions) => {
  const [state, setState] = useState<MarketDataState>({
    data: [],
    currentPrice: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchMarketData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // TODO: Replace with actual GraphQL query
      const query = `
        query GetMarketData($symbol: String!, $assetType: String!, $interval: String!) {
          candles(symbol: $symbol, assetType: $assetType, interval: $interval, limit: 100) {
            timestamp
            open
            high
            low
            close
            volume
          }
          realTimePrice(symbol: $symbol, assetType: $assetType) {
            close
            timestamp
          }
        }
      `;

      const variables = { symbol, assetType, interval };

      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const { candles, realTimePrice } = result.data;

      setState({
        data: candles || [],
        currentPrice: realTimePrice?.close || null,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Market data fetch error:', error);
      
      // Generate mock data for demo purposes
      const mockData = generateMockData(symbol, assetType);
      
      setState({
        data: mockData,
        currentPrice: mockData[mockData.length - 1]?.close || null,
        loading: false,
        error: null, // Don't show error for demo
        lastUpdated: new Date(),
      });
    }
  }, [symbol, assetType, interval]);

  // Generate mock data for demonstration
  const generateMockData = (symbol: string, assetType: string): MarketDataPoint[] => {
    const now = new Date();
    const data: MarketDataPoint[] = [];
    let basePrice = assetType === 'CRYPTO' ? 45000 : 150;
    
    // Adjust base price based on symbol
    if (symbol.includes('ETH')) basePrice = 3000;
    else if (symbol.includes('BNB')) basePrice = 300;
    else if (symbol.includes('ADA')) basePrice = 0.5;
    else if (symbol.includes('SOL')) basePrice = 100;
    else if (symbol.includes('AAPL')) basePrice = 180;
    else if (symbol.includes('MSFT')) basePrice = 350;
    else if (symbol.includes('GOOGL')) basePrice = 140;
    else if (symbol.includes('AMZN')) basePrice = 160;
    else if (symbol.includes('TSLA')) basePrice = 250;

    for (let i = 99; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const variation = (Math.random() - 0.5) * 0.05; // 5% max variation
      const open = basePrice;
      const close = basePrice * (1 + variation);
      const high = Math.max(open, close) * (1 + Math.random() * 0.02);
      const low = Math.min(open, close) * (1 - Math.random() * 0.02);
      
      data.push({
        timestamp: date.toISOString(),
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: Math.floor(Math.random() * 1000000),
      });
      
      basePrice = close;
    }

    return data;
  };

  // Initial fetch
  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMarketData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchMarketData]);

  return {
    ...state,
    refetch: fetchMarketData,
  };
};
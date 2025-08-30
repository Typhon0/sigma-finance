import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MarketDataTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [assetType, setAssetType] = useState('CRYPTO');
  const [interval, setInterval] = useState('1D');

  const testMarketData = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const query = `
        query TestMarketData($symbol: String!, $assetType: String!, $interval: String!) {
          supportedProviders(assetType: $assetType) {
            id
            name
            type
            requiresKey
            intervals
            supportsRealtime
            rateLimit {
              requestsPerMinute
              requestsPerDay
              burstLimit
            }
          }
          providerHealth {
            provider
            healthy
            lastChecked
          }
        }
      `;

      const variables = {
        symbol,
        assetType,
        interval,
      };

      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testCandles = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const now = new Date();
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const query = `
        query TestCandles($symbol: String!, $assetType: String!, $interval: String!, $from: Time!, $to: Time!) {
          candles(symbol: $symbol, assetType: $assetType, interval: $interval, from: $from, to: $to, limit: 10) {
            symbol
            assetType
            interval
            open
            high
            low
            close
            volume
            timestamp
            source
          }
        }
      `;

      const variables = {
        symbol,
        assetType,
        interval,
        from: from.toISOString(),
        to: now.toISOString(),
      };

      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Market Data System Test</h1>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Symbol</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="BTC/USDT"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Asset Type</label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRYPTO">Crypto</SelectItem>
                  <SelectItem value="STOCK">Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Interval</label>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 Minute</SelectItem>
                  <SelectItem value="5m">5 Minutes</SelectItem>
                  <SelectItem value="15m">15 Minutes</SelectItem>
                  <SelectItem value="1h">1 Hour</SelectItem>
                  <SelectItem value="4h">4 Hours</SelectItem>
                  <SelectItem value="1d">1 Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button onClick={testMarketData} disabled={loading}>
              {loading ? 'Testing...' : 'Test Providers & Health'}
            </Button>
            <Button onClick={testCandles} disabled={loading} variant="outline">
              {loading ? 'Testing...' : 'Test Candle Data'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {error && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>Market Data System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2">✅ Implemented Features</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Multi-provider system (Binance, Finnhub, CryptoCompare, Twelve Data)</li>
                <li>• Intelligent caching with gap detection</li>
                <li>• Rate limiting per user/provider</li>
                <li>• GraphQL API endpoints</li>
                <li>• TradingView chart integration</li>
                <li>• Fallback chart system</li>
                <li>• Provider health monitoring</li>
                <li>• Credential management</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">📊 Available Endpoints</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <code>candles</code> - Historical price data</li>
                <li>• <code>realTimePrice</code> - Current price</li>
                <li>• <code>supportedProviders</code> - Provider info</li>
                <li>• <code>providerHealth</code> - System status</li>
                <li>• <code>marketDataCredentials</code> - API keys</li>
                <li>• <code>validateProviderCredentials</code> - Test keys</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketDataTest;
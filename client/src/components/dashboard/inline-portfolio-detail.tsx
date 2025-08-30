import { ArrowLeft, Plus, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Portfolio } from '@/gql/graphql';
import type { Asset } from '@/hooks/use-dashboard-state';
import { formatCurrency, formatPercentage } from '@/lib/utils';

interface InlinePortfolioDetailProps {
  portfolio: Portfolio;
  onBack: () => void;
  onAssetSelect?: (asset: Asset) => void;
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changePercent?: number;
  icon?: React.ReactNode;
}

function MetricCard({ title, value, change, changePercent, icon }: MetricCardProps) {
  const getChangeDisplay = () => {
    if (change === undefined || change === 0) {
      return {
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        icon: Minus,
        show: false
      };
    }
    
    if (change > 0) {
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: TrendingUp,
        show: true
      };
    }
    
    return {
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      icon: TrendingDown,
      show: true
    };
  };

  const changeDisplay = getChangeDisplay();
  const ChangeIcon = changeDisplay.icon;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
          </div>
          {changeDisplay.show && (
            <div className={`flex items-center gap-1 ${changeDisplay.color}`}>
              <ChangeIcon className="h-3 w-3" />
              <span className="text-xs font-medium">
                {changePercent !== undefined ? formatPercentage(Math.abs(changePercent)) : ''}
              </span>
            </div>
          )}
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold">{value}</div>
          {changeDisplay.show && change !== undefined && (
            <p className={`text-xs ${changeDisplay.color}`}>
              {change > 0 ? '+' : ''}{formatCurrency(change)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface AssetListProps {
  assets: any[];
  onAssetClick?: (asset: Asset) => void;
  showInlineActions?: boolean;
}

function AssetList({ assets, onAssetClick, showInlineActions = false }: AssetListProps) {
  if (!assets || assets.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No assets in this portfolio yet.</p>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Your First Asset
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assets.map((position, index) => {
        const asset = position.asset;
        const quantity = position.quantity || 0;
        const averagePrice = position.averagePurchasePrice || 0;
        const currentValue = quantity * averagePrice; // Simplified calculation
        
        return (
          <div
            key={asset.id || index}
            className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
              onAssetClick ? 'hover:bg-muted/50 cursor-pointer' : ''
            }`}
            onClick={() => {
              if (onAssetClick) {
                onAssetClick({
                  id: asset.id,
                  name: asset.name,
                  symbol: asset.symbol,
                  type: asset.type || 'UNKNOWN'
                });
              }
            }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div>
                  <h4 className="font-medium">{asset.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {asset.symbol && (
                      <span className="font-mono">{asset.symbol}</span>
                    )}
                    {asset.type && (
                      <Badge variant="outline" className="text-xs">
                        {asset.type}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="font-medium">{formatCurrency(currentValue)}</div>
              <div className="text-sm text-muted-foreground">
                {quantity.toLocaleString()} @ {formatCurrency(averagePrice)}
              </div>
            </div>
            
            {showInlineActions && (
              <div className="ml-4 flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive">
                  Remove
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function InlinePortfolioDetail({ 
  portfolio, 
  onBack, 
  onAssetSelect 
}: InlinePortfolioDetailProps) {
  // Calculate portfolio metrics (simplified - in real app this would come from GraphQL)
  const assets = portfolio.assets || [];
  const totalValue = assets.reduce((sum, position) => {
    const quantity = position.quantity || 0;
    const price = position.averagePurchasePrice || 0;
    return sum + (quantity * price);
  }, 0);
  
  const totalCost = totalValue; // Simplified - would be actual cost basis
  const gainLoss = totalValue - totalCost;
  const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Portfolio Header with Back Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {/* Portfolio Title and Description */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{portfolio.name}</h1>
        {portfolio.description && (
          <p className="text-muted-foreground mt-2">{portfolio.description}</p>
        )}
      </div>

      {/* Portfolio Metrics Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Total Value" 
          value={formatCurrency(totalValue)}
          change={gainLoss}
          changePercent={gainLossPercent}
        />
        <MetricCard 
          title="Total Cost" 
          value={formatCurrency(totalCost)} 
        />
        <MetricCard 
          title="Gain/Loss" 
          value={formatCurrency(gainLoss)}
          changePercent={gainLossPercent}
        />
        <MetricCard 
          title="Assets" 
          value={assets.length.toString()} 
        />
      </div>

      {/* Assets Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Assets</CardTitle>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AssetList 
            assets={assets} 
            onAssetClick={onAssetSelect}
            showInlineActions={true}
          />
        </CardContent>
      </Card>

      {/* Performance Charts Placeholder */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">Performance chart will be implemented in task 15</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">Allocation chart will be implemented in task 15</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
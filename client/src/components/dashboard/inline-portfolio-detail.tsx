import { ArrowLeft, Plus, TrendingDown, TrendingUp, Minus, Calculator, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionManagement } from '@/components/transactions';
import { AlertDashboardIntegration } from './alert-dashboard-integration';
import { RealTimePortfolioValue, useOptimisticPortfolioUpdate } from './RealTimePortfolioValue';
import { RealTimeChart } from '@/components/charts/RealTimeChart';
import { RealTimeAlertNotifications } from '@/components/alerts/RealTimeAlertNotifications';
import { ConnectionStatus } from './ConnectionStatus';
import { useRealTimeDashboard } from '@/contexts/RealTimeDashboardContext';
import type { Portfolio, Transaction, Position } from '@/gql/graphql';
import type { Asset } from '@/hooks/use-dashboard-state';
import type { TransactionFormData, BulkTransactionData, TransactionFilterData } from '@/components/transactions';
import { formatCurrency, formatPercentage } from '@/lib/utils';

interface InlinePortfolioDetailProps {
  portfolio: Portfolio;
  onBack: () => void;
  onAssetSelect?: (asset: Asset) => void;
  transactions?: Transaction[];
  positions?: Position[];
  onAddTransaction?: (data: TransactionFormData) => Promise<void>;
  onEditTransaction?: (id: string, data: TransactionFormData) => Promise<void>;
  onDeleteTransaction?: (id: string) => Promise<void>;
  onBulkImport?: (data: BulkTransactionData) => Promise<void>;
  onExportTransactions?: (filters: TransactionFilterData) => Promise<void>;
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
  onAssetSelect,
  transactions = [],
  positions = [],
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onBulkImport,
  onExportTransactions,
}: InlinePortfolioDetailProps) {
  const { state, actions } = useRealTimeDashboard();
  const { updatePortfolioOptimistically } = useOptimisticPortfolioUpdate(portfolio.id);
  
  // Calculate portfolio metrics (simplified - in real app this would come from GraphQL)
  const assets = portfolio.assets || [];
  
  // Get real-time portfolio data if available
  const realTimePortfolioData = actions.getPortfolioValue(portfolio.id);
  
  // Use real-time data if available, otherwise calculate from assets
  const totalValue = realTimePortfolioData?.totalValue || assets.reduce((sum, position) => {
    const quantity = position.quantity || 0;
    const price = position.averagePurchasePrice || 0;
    return sum + (quantity * price);
  }, 0);
  
  const totalCost = realTimePortfolioData?.totalCost || totalValue; // Simplified - would be actual cost basis
  const gainLoss = realTimePortfolioData?.gainLoss || (totalValue - totalCost);
  const gainLossPercent = realTimePortfolioData?.gainLossPercent || (totalCost > 0 ? (gainLoss / totalCost) * 100 : 0);

  // Extract asset IDs for real-time price tracking
  const assetIds = assets.map(position => position.asset.id).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Portfolio Header with Back Navigation and Connection Status */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <ConnectionStatus variant="badge" />
      </div>

      {/* Portfolio Title and Description */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{portfolio.name}</h1>
        {portfolio.description && (
          <p className="text-muted-foreground mt-2">{portfolio.description}</p>
        )}
      </div>

      {/* Real-Time Portfolio Metrics */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <RealTimePortfolioValue
          portfolioId={portfolio.id}
          portfolioName={portfolio.name}
          showDetailedMetrics={true}
        />
        <div className="grid gap-4 grid-cols-2">
          <MetricCard 
            title="Total Cost" 
            value={formatCurrency(totalCost)} 
          />
          <MetricCard 
            title="Assets" 
            value={assets.length.toString()} 
          />
        </div>
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

      {/* Portfolio Management Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions
            {transactions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {transactions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="h-4 w-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Real-Time Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Show real-time charts for tradeable assets */}
            {assets.length > 0 && assets.some(position => position.asset.symbol) ? (
              assets
                .filter(position => position.asset.symbol)
                .slice(0, 2) // Show first 2 tradeable assets
                .map(position => (
                  <RealTimeChart
                    key={position.asset.id}
                    assetId={position.asset.id}
                    symbol={position.asset.symbol!}
                    chartType="line"
                    height={250}
                  />
                ))
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Chart</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
                      <p className="text-muted-foreground">Add tradeable assets to see real-time charts</p>
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
              </>
            )}
          </div>

          {/* Real-Time Alerts for this Portfolio */}
          <RealTimeAlertNotifications 
            showInline={true}
            maxVisible={3}
          />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          {/* Transaction Management */}
          {onAddTransaction && onEditTransaction && onDeleteTransaction ? (
            <TransactionManagement
              portfolio={portfolio}
              assets={assets.map(position => position.asset)}
              transactions={transactions}
              positions={positions}
              onAddTransaction={onAddTransaction}
              onEditTransaction={onEditTransaction}
              onDeleteTransaction={onDeleteTransaction}
              onBulkImport={onBulkImport || (async () => {})}
              onExportTransactions={onExportTransactions || (async () => {})}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Transaction Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    Transaction Management
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Transaction management functionality will be available once GraphQL resolvers are implemented.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          {/* Alert Management for Portfolio */}
          <AlertDashboardIntegration
            portfolios={[portfolio]}
            assets={assets.map(position => position.asset)}
            currentPortfolio={portfolio}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Advanced analytics and performance metrics will be available here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
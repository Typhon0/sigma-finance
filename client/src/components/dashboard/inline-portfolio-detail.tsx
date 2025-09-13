import { ArrowLeft, Plus, TrendingDown, TrendingUp, Minus, Calculator, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExportQuickActions, QuickExportButton } from '@/components/export/export-quick-actions';
import { TransactionManagement } from '@/components/transactions';
import { AlertDashboardIntegration } from './alert-dashboard-integration';
import { RealTimePortfolioValue, useOptimisticPortfolioUpdate } from './RealTimePortfolioValue';
import { RealTimeChart } from '@/components/charts/RealTimeChart';
import { RealTimeAlertNotifications } from '@/components/alerts/RealTimeAlertNotifications';
import { ConnectionStatus } from './ConnectionStatus';
import { useRealTimeDashboard } from '@/contexts/RealTimeDashboardContext';
import { useResponsiveDashboard, useResponsiveChartDimensions } from '@/hooks/use-responsive-dashboard';
import type { Portfolio, Transaction, Position } from '@/gql/graphql';
import type { Asset } from '@/hooks/use-dashboard-state';
import type { TransactionFormData, BulkTransactionData, TransactionFilterData } from '@/components/transactions';
import { formatCurrency, formatPercentage, cn } from '@/lib/utils';

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



import { ResponsiveAssetList } from './responsive-asset-list';

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
  const [responsiveState] = useResponsiveDashboard();
  const { getChartConfig } = useResponsiveChartDimensions();
  
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
    <div className={cn(
      "space-y-4 sm:space-y-6",
      // Add safe area padding on mobile
      responsiveState.isMobile && "pb-safe-area-inset-bottom"
    )}>
      {/* Portfolio Header with Back Navigation and Connection Status */}
      <div className={cn(
        "flex items-center justify-between",
        // Stack on mobile for better touch targets
        responsiveState.isMobile ? "flex-col gap-3 items-start" : "flex-row"
      )}>
        <Button 
          variant="ghost" 
          size={responsiveState.isMobile ? "default" : "sm"} 
          onClick={onBack} 
          className={cn(
            "gap-2 touch-manipulation",
            // Larger touch target on mobile
            responsiveState.isMobile && "h-11 px-4"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className={cn(
          "flex items-center gap-2",
          responsiveState.isMobile && "w-full justify-between"
        )}>
          <ExportQuickActions 
            portfolioId={portfolio.id}
            portfolioName={portfolio.name}
            variant="outline"
            size={responsiveState.isMobile ? "default" : "sm"}
          />
          <ConnectionStatus variant="badge" />
        </div>
      </div>

      {/* Portfolio Title and Description */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{portfolio.name}</h1>
        {portfolio.description && (
          <p className="text-muted-foreground mt-2">{portfolio.description}</p>
        )}
      </div>

      {/* Real-Time Portfolio Metrics */}
      <div className={cn(
        "grid gap-4",
        // Responsive grid: single column on mobile, two columns on larger screens
        "grid-cols-1 lg:grid-cols-2"
      )}>
        <RealTimePortfolioValue
          portfolioId={portfolio.id}
          portfolioName={portfolio.name}
          showDetailedMetrics={true}
        />
        <div className={cn(
          "grid gap-4",
          // Always two columns for metric cards, but smaller on mobile
          "grid-cols-2"
        )}>
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
          <div className={cn(
            "flex items-center",
            // Stack on mobile for better layout
            responsiveState.isMobile ? "flex-col gap-3 items-start" : "flex-row justify-between"
          )}>
            <CardTitle>Assets</CardTitle>
            <div className={cn(
              "flex items-center gap-2",
              responsiveState.isMobile && "w-full justify-between"
            )}>
              <QuickExportButton
                type="portfolio-data"
                portfolioId={portfolio.id}
                portfolioName={portfolio.name}
                variant="ghost"
                size={responsiveState.isMobile ? "default" : "sm"}
              />
              <Button 
                size={responsiveState.isMobile ? "default" : "sm"}
                className={cn(
                  "touch-manipulation",
                  responsiveState.isMobile && "h-11"
                )}
              >
                <Plus className="mr-2 h-4 w-4" />
                {responsiveState.isMobile ? "Add" : "Add Asset"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveAssetList 
            assets={assets} 
            onAssetClick={onAssetSelect}
            showInlineActions={!responsiveState.isMobile} // Hide inline actions on mobile for cleaner UI
            emptyAction={
              <Button className={cn(
                "touch-manipulation",
                responsiveState.isMobile && "h-11"
              )}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Asset
              </Button>
            }
          />
        </CardContent>
      </Card>

      {/* Portfolio Management Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={cn(
          "grid w-full",
          // Responsive tabs: 2x2 grid on mobile, single row on larger screens
          responsiveState.isMobile ? "grid-cols-2 grid-rows-2 h-auto" : "grid-cols-4"
        )}>
          <TabsTrigger 
            value="overview"
            className={cn(
              "touch-manipulation",
              responsiveState.isMobile && "h-11"
            )}
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="transactions"
            className={cn(
              "touch-manipulation",
              responsiveState.isMobile && "h-11"
            )}
          >
            {responsiveState.isMobile ? "Txns" : "Transactions"}
            {transactions.length > 0 && (
              <Badge variant="secondary" className={cn(
                responsiveState.isMobile ? "ml-1 text-xs" : "ml-2"
              )}>
                {transactions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="alerts"
            className={cn(
              "touch-manipulation",
              responsiveState.isMobile && "h-11"
            )}
          >
            <Bell className="h-4 w-4 mr-1 sm:mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger 
            value="analytics"
            className={cn(
              "touch-manipulation",
              responsiveState.isMobile && "h-11"
            )}
          >
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className={cn(
          responsiveState.isMobile ? "space-y-4" : "space-y-6"
        )}>
          {/* Real-Time Charts */}
          <div className={cn(
            "grid gap-4 sm:gap-6",
            // Single column on mobile/tablet, two columns on desktop
            "grid-cols-1 lg:grid-cols-2"
          )}>
            {/* Show real-time charts for tradeable assets */}
            {assets.length > 0 && assets.some(position => position.asset.symbol) ? (
              assets
                .filter(position => position.asset.symbol)
                .slice(0, responsiveState.isMobile ? 1 : 2) // Show only 1 chart on mobile
                .map(position => {
                  const chartConfig = getChartConfig(250);
                  return (
                    <RealTimeChart
                      key={position.asset.id}
                      assetId={position.asset.id}
                      symbol={position.asset.symbol!}
                      chartType="line"
                      height={chartConfig.height}
                    />
                  );
                })
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Chart</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={cn(
                      "flex items-center justify-center bg-muted/30 rounded-lg",
                      responsiveState.isMobile ? "h-48" : "h-64"
                    )}>
                      <p className="text-muted-foreground text-center text-sm">
                        Add tradeable assets to see real-time charts
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                {!responsiveState.isMobile && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Asset Allocation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground text-center text-sm">
                          Allocation chart will be implemented in task 15
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
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
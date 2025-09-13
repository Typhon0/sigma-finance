import { useState } from 'react';
import { Bell, Plus, Settings, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertManagement,
  AlertQuickSetup,
  type AlertFormData,
  type AlertQuickSetupData,
  type AlertTestData,
  type AlertFilterData,
  type Alert,
  type AlertNotificationData,
  type AlertHistoryData,
  type Portfolio,
  type Asset
} from '@/components/alerts';

interface AlertDashboardIntegrationProps {
  portfolios: Portfolio[];
  assets: Asset[];
  currentPortfolio?: Portfolio;
  currentAsset?: Asset;
  className?: string;
}

// Mock data for demonstration
const mockAlerts: Alert[] = [
  {
    id: '1',
    alertType: 'PRICE',
    conditionType: 'ABOVE',
    assetId: 'asset-1',
    thresholdValue: 150,
    notificationMethods: ['EMAIL', 'PUSH'],
    isActive: true,
    name: 'AAPL Price Alert',
    description: 'Alert when Apple stock goes above $150',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    triggerCount: 3,
    lastTriggered: new Date('2024-01-20'),
    asset: {
      id: 'asset-1',
      name: 'Apple Inc.',
      symbol: 'AAPL',
      type: 'STOCK',
      currentPrice: 145.50,
    },
  },
  {
    id: '2',
    alertType: 'PERCENTAGE_CHANGE',
    conditionType: 'DECREASE_BY',
    assetId: 'asset-2',
    thresholdPercentage: 10,
    notificationMethods: ['EMAIL'],
    isActive: true,
    name: 'BTC Drop Alert',
    description: 'Alert when Bitcoin drops by 10%',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    triggerCount: 1,
    lastTriggered: new Date('2024-01-18'),
    asset: {
      id: 'asset-2',
      name: 'Bitcoin',
      symbol: 'BTC',
      type: 'CRYPTO',
      currentPrice: 42000,
    },
  },
  {
    id: '3',
    alertType: 'PORTFOLIO_VALUE',
    conditionType: 'ABOVE',
    portfolioId: 'portfolio-1',
    thresholdValue: 100000,
    notificationMethods: ['EMAIL', 'PUSH', 'SMS'],
    isActive: true,
    name: 'Portfolio Milestone',
    description: 'Alert when portfolio reaches $100k',
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
    triggerCount: 0,
    portfolio: {
      id: 'portfolio-1',
      name: 'Main Portfolio',
    },
  },
];

const mockNotifications: AlertNotificationData[] = [
  {
    id: 'notif-1',
    alertId: '1',
    message: 'AAPL has reached $152.30, above your threshold of $150.00',
    triggeredAt: new Date('2024-01-20T10:30:00'),
    acknowledged: false,
    alertType: 'PRICE',
    assetName: 'Apple Inc.',
    currentValue: 152.30,
    thresholdValue: 150.00,
  },
  {
    id: 'notif-2',
    alertId: '2',
    message: 'BTC has dropped by 12.5%, exceeding your threshold of 10%',
    triggeredAt: new Date('2024-01-18T14:15:00'),
    acknowledged: true,
    alertType: 'PERCENTAGE_CHANGE',
    assetName: 'Bitcoin',
    currentValue: 37000,
    thresholdValue: 42000,
  },
];

const mockHistory: AlertHistoryData[] = [
  {
    id: 'hist-1',
    alertId: '1',
    alertName: 'AAPL Price Alert',
    alertType: 'PRICE',
    triggeredAt: new Date('2024-01-20T10:30:00'),
    acknowledgedAt: new Date('2024-01-20T11:00:00'),
    message: 'AAPL has reached $152.30, above your threshold of $150.00',
    assetName: 'Apple Inc.',
    currentValue: 152.30,
    thresholdValue: 150.00,
  },
  {
    id: 'hist-2',
    alertId: '2',
    alertName: 'BTC Drop Alert',
    alertType: 'PERCENTAGE_CHANGE',
    triggeredAt: new Date('2024-01-18T14:15:00'),
    acknowledgedAt: new Date('2024-01-18T15:30:00'),
    message: 'BTC has dropped by 12.5%, exceeding your threshold of 10%',
    assetName: 'Bitcoin',
    currentValue: 37000,
    thresholdValue: 42000,
  },
];

export function AlertDashboardIntegration({
  portfolios,
  assets,
  currentPortfolio,
  currentAsset,
  className,
}: AlertDashboardIntegrationProps) {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [notifications, setNotifications] = useState<AlertNotificationData[]>(mockNotifications);
  const [history, setHistory] = useState<AlertHistoryData[]>(mockHistory);
  const [showAlertManagement, setShowAlertManagement] = useState(false);

  const activeAlerts = alerts.filter(alert => alert.isActive);
  const unacknowledgedNotifications = notifications.filter(n => !n.acknowledged);

  const handleCreateAlert = async (data: AlertFormData) => {
    // Simulate API call
    const newAlert: Alert = {
      id: `alert-${Date.now()}`,
      alertType: data.alertType,
      conditionType: data.conditionType,
      assetId: data.assetId,
      portfolioId: data.portfolioId,
      thresholdValue: data.thresholdValue,
      thresholdPercentage: data.thresholdPercentage,
      notificationMethods: data.notificationMethods,
      isActive: data.isActive,
      name: data.name,
      description: data.description,
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      asset: data.assetId ? assets.find(a => a.id === data.assetId) : undefined,
      portfolio: data.portfolioId ? portfolios.find(p => p.id === data.portfolioId) : undefined,
    };

    setAlerts(prev => [...prev, newAlert]);
  };

  const handleUpdateAlert = async (id: string, data: AlertFormData) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id 
        ? { 
            ...alert, 
            ...data, 
            updatedAt: new Date(),
            asset: data.assetId ? assets.find(a => a.id === data.assetId) : undefined,
            portfolio: data.portfolioId ? portfolios.find(p => p.id === data.portfolioId) : undefined,
          }
        : alert
    ));
  };

  const handleDeleteAlert = async (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const handleAcknowledgeAlert = async (id: string) => {
    setNotifications(prev => prev.map(notif => 
      notif.id === id ? { ...notif, acknowledged: true } : notif
    ));
  };

  const handleQuickSetup = async (data: AlertQuickSetupData) => {
    const alertData: AlertFormData = {
      alertType: data.alertType,
      conditionType: data.alertType === 'PRICE' || data.alertType === 'PORTFOLIO_VALUE' ? 'ABOVE' : 'INCREASE_BY',
      assetId: data.assetId,
      portfolioId: data.portfolioId,
      thresholdValue: data.thresholdValue,
      thresholdPercentage: data.thresholdPercentage,
      notificationMethods: data.notificationMethods,
      isActive: true,
      name: `Quick Alert - ${data.alertType}`,
    };

    await handleCreateAlert(alertData);
  };

  const handleTestAlert = async (data: AlertTestData) => {
    // Simulate test execution
    console.log('Testing alert:', data);
  };

  const handleFilterAlerts = (filters: AlertFilterData) => {
    // Apply filters (in real app, this would filter the alerts)
    console.log('Filtering alerts:', filters);
  };

  if (showAlertManagement) {
    return (
      <div className={className}>
        <AlertManagement
          portfolios={portfolios}
          assets={assets}
          alerts={alerts}
          notifications={notifications}
          alertHistory={history}
          onCreateAlert={handleCreateAlert}
          onUpdateAlert={handleUpdateAlert}
          onDeleteAlert={handleDeleteAlert}
          onAcknowledgeAlert={handleAcknowledgeAlert}
          onTestAlert={handleTestAlert}
          onFilterAlerts={handleFilterAlerts}
        />
        
        <div className="mt-6 flex justify-center">
          <Button 
            variant="outline" 
            onClick={() => setShowAlertManagement(false)}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Alert Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                <div className="text-2xl font-bold">{activeAlerts.length}</div>
              </div>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Notifications</p>
                <div className="text-2xl font-bold">{unacknowledgedNotifications.length}</div>
              </div>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Triggered Today</p>
                <div className="text-2xl font-bold">
                  {history.filter(h => {
                    const today = new Date();
                    const triggerDate = new Date(h.triggeredAt);
                    return triggerDate.toDateString() === today.toDateString();
                  }).length}
                </div>
              </div>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Triggers</p>
                <div className="text-2xl font-bold">
                  {alerts.reduce((sum, alert) => sum + alert.triggerCount, 0)}
                </div>
              </div>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alert Management
            </CardTitle>
            <div className="flex items-center gap-2">
              {unacknowledgedNotifications.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <Bell className="h-3 w-3" />
                  {unacknowledgedNotifications.length}
                </Badge>
              )}
              <AlertQuickSetup
                portfolios={portfolios}
                assets={assets}
                preselectedAssetId={currentAsset?.id}
                preselectedPortfolioId={currentPortfolio?.id}
                onSubmit={handleQuickSetup}
              />
              <Button onClick={() => setShowAlertManagement(true)} className="gap-2">
                <Settings className="h-4 w-4" />
                Manage Alerts
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Recent Notifications */}
          {unacknowledgedNotifications.length > 0 && (
            <div className="space-y-3 mb-6">
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Recent Notifications
              </h4>
              {unacknowledgedNotifications.slice(0, 3).map((notification) => (
                <div key={notification.id} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <Bell className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {notification.triggeredAt.toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAcknowledgeAlert(notification.id)}
                  >
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Active Alerts Summary */}
          <div className="space-y-3">
            <h4 className="font-medium">Active Alerts</h4>
            {activeAlerts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active alerts configured</p>
                <p className="text-sm">Create your first alert to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {alert.alertType === 'PRICE' && 'Price'}
                        {alert.alertType === 'PERCENTAGE_CHANGE' && 'Percentage'}
                        {alert.alertType === 'PORTFOLIO_VALUE' && 'Portfolio'}
                        {alert.alertType === 'ALLOCATION' && 'Allocation'}
                      </Badge>
                      <span className="font-medium">{alert.name}</span>
                      {alert.triggerCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {alert.triggerCount} triggers
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {alert.notificationMethods.map((method) => (
                        <Badge key={method} variant="outline" className="text-xs">
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {activeAlerts.length > 5 && (
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => setShowAlertManagement(true)}
                  >
                    View all {activeAlerts.length} alerts
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Context-Specific Quick Setup */}
      {(currentAsset || currentPortfolio) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Alert Setup
              {currentAsset && (
                <Badge variant="outline">for {currentAsset.symbol || currentAsset.name}</Badge>
              )}
              {currentPortfolio && (
                <Badge variant="outline">for {currentPortfolio.name}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {currentAsset && (
                <>
                  <Button
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2"
                    onClick={() => handleQuickSetup({
                      assetId: currentAsset.id,
                      alertType: 'PRICE',
                      thresholdValue: currentAsset.currentPrice ? currentAsset.currentPrice * 1.1 : 100,
                      notificationMethods: ['EMAIL'],
                    })}
                  >
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-sm">Price Above</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2"
                    onClick={() => handleQuickSetup({
                      assetId: currentAsset.id,
                      alertType: 'PERCENTAGE_CHANGE',
                      thresholdPercentage: 10,
                      notificationMethods: ['EMAIL'],
                    })}
                  >
                    <Percent className="h-5 w-5" />
                    <span className="text-sm">10% Change</span>
                  </Button>
                </>
              )}
              
              {currentPortfolio && (
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => handleQuickSetup({
                    portfolioId: currentPortfolio.id,
                    alertType: 'PORTFOLIO_VALUE',
                    thresholdValue: 100000,
                    notificationMethods: ['EMAIL'],
                  })}
                >
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm">Value Milestone</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
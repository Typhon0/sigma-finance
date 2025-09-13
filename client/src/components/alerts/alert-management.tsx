import { useState } from 'react';
import { Bell, Plus, Settings, History, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertConfigurationForm } from './alert-configuration-form';
import { AlertList } from './alert-list';
import { AlertNotifications } from './alert-notifications';
import { AlertHistory } from './alert-history';
import { AlertTesting } from './alert-testing';
import type { 
  Alert, 
  AlertFormData, 
  AlertFilterData, 
  AlertNotificationData, 
  AlertHistoryData,
  AlertTestData,
  Portfolio,
  Asset 
} from './types';

interface AlertManagementProps {
  portfolios: Portfolio[];
  assets: Asset[];
  alerts?: Alert[];
  notifications?: AlertNotificationData[];
  alertHistory?: AlertHistoryData[];
  onCreateAlert?: (data: AlertFormData) => Promise<void>;
  onUpdateAlert?: (id: string, data: AlertFormData) => Promise<void>;
  onDeleteAlert?: (id: string) => Promise<void>;
  onAcknowledgeAlert?: (id: string) => Promise<void>;
  onTestAlert?: (data: AlertTestData) => Promise<void>;
  onFilterAlerts?: (filters: AlertFilterData) => void;
  className?: string;
}

export function AlertManagement({
  portfolios = [],
  assets = [],
  alerts = [],
  notifications = [],
  alertHistory = [],
  onCreateAlert,
  onUpdateAlert,
  onDeleteAlert,
  onAcknowledgeAlert,
  onTestAlert,
  onFilterAlerts,
  className,
}: AlertManagementProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [activeTab, setActiveTab] = useState('active');

  const activeAlerts = alerts.filter(alert => alert.isActive);
  const inactiveAlerts = alerts.filter(alert => !alert.isActive);
  const unacknowledgedNotifications = notifications.filter(n => !n.acknowledged);

  const handleCreateAlert = async (data: AlertFormData) => {
    if (onCreateAlert) {
      await onCreateAlert(data);
      setShowCreateForm(false);
    }
  };

  const handleUpdateAlert = async (data: AlertFormData) => {
    if (onUpdateAlert && editingAlert) {
      await onUpdateAlert(editingAlert.id, data);
      setEditingAlert(null);
    }
  };

  const handleEditAlert = (alert: Alert) => {
    setEditingAlert(alert);
  };

  const handleCancelEdit = () => {
    setEditingAlert(null);
    setShowCreateForm(false);
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Alert Management Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Alert Management</h2>
              <p className="text-muted-foreground">
                Configure and manage alerts for your portfolio and assets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unacknowledgedNotifications.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <Bell className="h-3 w-3" />
                {unacknowledgedNotifications.length}
              </Badge>
            )}
            <Button onClick={() => setShowCreateForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Alert
            </Button>
          </div>
        </div>

        {/* Alert Statistics Cards */}
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
                    {alertHistory.filter(h => {
                      const today = new Date();
                      const triggerDate = new Date(h.triggeredAt);
                      return triggerDate.toDateString() === today.toDateString();
                    }).length}
                  </div>
                </div>
                <History className="h-4 w-4 text-muted-foreground" />
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
                <TestTube className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alert Management Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="active" className="gap-2">
              Active Alerts
              {activeAlerts.length > 0 && (
                <Badge variant="secondary">{activeAlerts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              Notifications
              {unacknowledgedNotifications.length > 0 && (
                <Badge variant="destructive">{unacknowledgedNotifications.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {/* Create/Edit Alert Form */}
            {(showCreateForm || editingAlert) && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingAlert ? 'Edit Alert' : 'Create New Alert'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AlertConfigurationForm
                    portfolios={portfolios}
                    assets={assets}
                    initialData={editingAlert ? {
                      id: editingAlert.id,
                      alertType: editingAlert.alertType,
                      conditionType: editingAlert.conditionType,
                      assetId: editingAlert.assetId,
                      portfolioId: editingAlert.portfolioId,
                      thresholdValue: editingAlert.thresholdValue,
                      thresholdPercentage: editingAlert.thresholdPercentage,
                      notificationMethods: editingAlert.notificationMethods,
                      isActive: editingAlert.isActive,
                      name: editingAlert.name,
                      description: editingAlert.description,
                    } : undefined}
                    onSubmit={editingAlert ? handleUpdateAlert : handleCreateAlert}
                    onCancel={handleCancelEdit}
                  />
                </CardContent>
              </Card>
            )}

            {/* Active Alerts List */}
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <AlertList
                  alerts={activeAlerts}
                  onEdit={handleEditAlert}
                  onDelete={onDeleteAlert}
                  onToggleActive={onUpdateAlert}
                  onFilter={onFilterAlerts}
                  showFilters={true}
                />
              </CardContent>
            </Card>

            {/* Inactive Alerts */}
            {inactiveAlerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Inactive Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <AlertList
                    alerts={inactiveAlerts}
                    onEdit={handleEditAlert}
                    onDelete={onDeleteAlert}
                    onToggleActive={onUpdateAlert}
                    showFilters={false}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Alert Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <AlertNotifications
                  notifications={notifications}
                  onAcknowledge={onAcknowledgeAlert}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Alert History</CardTitle>
              </CardHeader>
              <CardContent>
                <AlertHistory
                  history={alertHistory}
                  onFilter={onFilterAlerts}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="testing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Alert Testing & Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <AlertTesting
                  alerts={activeAlerts}
                  onTest={onTestAlert}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
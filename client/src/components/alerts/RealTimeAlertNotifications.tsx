import React, { useState, useEffect } from 'react';
import { useRealTimeDashboard } from '@/contexts/RealTimeDashboardContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  BellRing, 
  X, 
  Check, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealTimeAlertNotificationsProps {
  className?: string;
  maxVisible?: number;
  showInline?: boolean;
}

export function RealTimeAlertNotifications({ 
  className = '',
  maxVisible = 5,
  showInline = false
}: RealTimeAlertNotificationsProps) {
  const { state, actions } = useRealTimeDashboard();
  const [isExpanded, setIsExpanded] = useState(false);
  const [newAlertCount, setNewAlertCount] = useState(0);

  // Track new alerts for animation
  useEffect(() => {
    if (state.unreadAlertCount > newAlertCount) {
      setNewAlertCount(state.unreadAlertCount);
      
      // Reset after animation
      const timer = setTimeout(() => {
        setNewAlertCount(0);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [state.unreadAlertCount, newAlertCount]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'PRICE':
        return <DollarSign className="h-4 w-4" />;
      case 'PERCENTAGE_CHANGE':
        return <TrendingUp className="h-4 w-4" />;
      case 'PORTFOLIO_VALUE':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'PRICE':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'PERCENTAGE_CHANGE':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'PORTFOLIO_VALUE':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      default:
        return 'text-orange-600 bg-orange-50 border-orange-200';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const visibleAlerts = isExpanded ? state.alerts : state.alerts.slice(0, maxVisible);

  if (showInline) {
    return (
      <div className={cn('space-y-2', className)}>
        {visibleAlerts.map((alert, index) => (
          <Card 
            key={alert.id}
            className={cn(
              'transition-all duration-300 transform',
              !alert.acknowledged && 'ring-2 ring-blue-200 shadow-md',
              index === 0 && newAlertCount > 0 && 'animate-pulse scale-105'
            )}
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'p-2 rounded-full',
                  getAlertColor(alert.type)
                )}>
                  {getAlertIcon(alert.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm truncate">{alert.title}</h4>
                    {!alert.acknowledged && (
                      <Badge variant="destructive" className="text-xs">New</Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(alert.timestamp)}
                    </span>
                    
                    {!alert.acknowledged && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => actions.acknowledgeAlert(alert.id)}
                        className="h-6 px-2 text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {state.alerts.length > maxVisible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full"
          >
            {isExpanded ? 'Show Less' : `Show ${state.alerts.length - maxVisible} More`}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {state.unreadAlertCount > 0 ? (
              <BellRing className={cn(
                'h-5 w-5 text-blue-600',
                newAlertCount > 0 && 'animate-bounce'
              )} />
            ) : (
              <Bell className="h-5 w-5 text-gray-500" />
            )}
            Alerts
            {state.unreadAlertCount > 0 && (
              <Badge 
                variant="destructive" 
                className={cn(
                  'ml-1',
                  newAlertCount > 0 && 'animate-pulse'
                )}
              >
                {state.unreadAlertCount}
              </Badge>
            )}
          </CardTitle>
          
          {state.alerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                state.alerts.forEach(alert => {
                  if (!alert.acknowledged) {
                    actions.acknowledgeAlert(alert.id);
                  }
                });
              }}
              className="text-xs"
            >
              Mark All Read
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {state.alerts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No alerts yet</p>
            <p className="text-xs text-gray-400">You'll see notifications here when alerts are triggered</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="p-4 space-y-3">
              {visibleAlerts.map((alert, index) => (
                <div
                  key={alert.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border transition-all duration-300',
                    alert.acknowledged 
                      ? 'bg-gray-50 border-gray-200' 
                      : 'bg-white border-blue-200 shadow-sm',
                    index === 0 && newAlertCount > 0 && 'ring-2 ring-blue-300 scale-105'
                  )}
                >
                  <div className={cn(
                    'p-2 rounded-full flex-shrink-0',
                    alert.acknowledged 
                      ? 'bg-gray-100 text-gray-500'
                      : getAlertColor(alert.type)
                  )}>
                    {getAlertIcon(alert.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={cn(
                        'font-medium text-sm truncate',
                        alert.acknowledged ? 'text-gray-600' : 'text-gray-900'
                      )}>
                        {alert.title}
                      </h4>
                      {!alert.acknowledged && (
                        <Badge variant="destructive" className="text-xs">New</Badge>
                      )}
                    </div>
                    
                    <p className={cn(
                      'text-sm mb-2',
                      alert.acknowledged ? 'text-gray-500' : 'text-gray-600'
                    )}>
                      {alert.message}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(alert.timestamp)}
                      </span>
                      
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => actions.acknowledgeAlert(alert.id)}
                          className="h-6 px-2 text-xs hover:bg-blue-50"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Floating alert notification component for immediate alerts
 */
export function FloatingAlertNotification() {
  const { state } = useRealTimeDashboard();
  const [visibleAlert, setVisibleAlert] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const latestUnacknowledgedAlert = state.alerts.find(alert => !alert.acknowledged);
    
    if (latestUnacknowledgedAlert && latestUnacknowledgedAlert !== visibleAlert) {
      setVisibleAlert(latestUnacknowledgedAlert);
      setIsVisible(true);
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [state.alerts, visibleAlert]);

  if (!isVisible || !visibleAlert) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <Card className="w-80 shadow-lg border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-full flex-shrink-0',
              getAlertColor(visibleAlert.type)
            )}>
              {getAlertIcon(visibleAlert.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-sm">{visibleAlert.title}</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsVisible(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">{visibleAlert.message}</p>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    actions.acknowledgeAlert(visibleAlert.id);
                    setIsVisible(false);
                  }}
                  className="h-6 px-2 text-xs"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Acknowledge
                </Button>
                
                <span className="text-xs text-gray-500">
                  {formatTimestamp(visibleAlert.timestamp)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
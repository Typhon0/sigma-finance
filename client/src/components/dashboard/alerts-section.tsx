import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert } from "@/lib/types/dashboard.types"
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock,
  ExternalLink,
  Bell
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface AlertsSectionProps {
  alerts: Alert[]
  isLoading?: boolean
  onAlertClick?: (alertId: string, assetId: string, portfolioId: string) => void
  onViewAllAlerts?: () => void
}

// Alert type icon mapping
const getAlertIcon = (alertType: string) => {
  switch (alertType.toLowerCase()) {
    case 'price_increase':
    case 'price_above':
      return <TrendingUp className="h-4 w-4 text-green-600" />
    case 'price_decrease':
    case 'price_below':
      return <TrendingDown className="h-4 w-4 text-red-600" />
    case 'portfolio_value':
    case 'value_change':
      return <DollarSign className="h-4 w-4 text-blue-600" />
    default:
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />
  }
}

// Alert type badge variant mapping
const getAlertBadgeVariant = (alertType: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (alertType.toLowerCase()) {
    case 'price_increase':
    case 'price_above':
      return "default"
    case 'price_decrease':
    case 'price_below':
      return "destructive"
    case 'portfolio_value':
    case 'value_change':
      return "secondary"
    default:
      return "outline"
  }
}

// Format alert type for display
const formatAlertType = (alertType: string): string => {
  return alertType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Format alert condition for display
const formatAlertCondition = (condition: string, threshold: number): string => {
  switch (condition.toLowerCase()) {
    case 'above':
      return `Above $${threshold.toLocaleString('en-US')}`
    case 'below':
      return `Below $${threshold.toLocaleString('en-US')}`
    case 'increase':
      return `Increased by ${threshold}%`
    case 'decrease':
      return `Decreased by ${threshold}%`
    default:
      return condition
  }
}

// Individual alert item component
function AlertItem({ 
  alert, 
  onClick 
}: { 
  alert: Alert
  onClick?: (alertId: string, assetId: string, portfolioId: string) => void 
}) {
  const handleClick = () => {
    if (onClick) {
      onClick(alert.id, alert.asset.id, alert.portfolio.id)
    }
  }

  return (
    <div 
      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {/* Alert type icon */}
      <div className="mt-0.5">
        {getAlertIcon(alert.alertType)}
      </div>
      
      {/* Alert content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={getAlertBadgeVariant(alert.alertType)} className="text-xs">
            {formatAlertType(alert.alertType)}
          </Badge>
          <span className="text-sm font-medium truncate">
            {alert.asset.name}
          </span>
        </div>
        
        <p className="text-sm text-muted-foreground">
          {formatAlertCondition(alert.condition, alert.threshold)}
        </p>
        
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {alert.portfolio.name}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {(() => {
                try {
                  return formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })
                } catch (error) {
                  return 'Unknown time'
                }
              })()}
            </span>
          </div>
        </div>
      </div>
      
      {/* Navigation indicator */}
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

// Empty state component
function EmptyAlertsState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground mb-2">
        No Active Alerts
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        You don't have any active alerts at the moment. Set up alerts to stay informed about important changes to your portfolio.
      </p>
    </div>
  )
}

// Loading skeleton for alerts
function AlertsLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
          <Skeleton className="h-4 w-4 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-3 w-32 mb-1" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  )
}

// Main alerts section component
export function AlertsSection({ 
  alerts, 
  isLoading = false, 
  onAlertClick,
  onViewAllAlerts 
}: AlertsSectionProps) {
  // Show loading skeleton
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts & Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AlertsLoadingSkeleton />
        </CardContent>
      </Card>
    )
  }

  // Show empty state if no alerts
  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts & Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyAlertsState />
        </CardContent>
      </Card>
    )
  }

  // Show alerts (limit to 3 most recent)
  const displayAlerts = alerts.slice(0, 3)
  const hasMoreAlerts = alerts.length > 3

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alerts & Notifications
        </CardTitle>
        {alerts.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {alerts.length} active
          </Badge>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {displayAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onClick={onAlertClick}
            />
          ))}
        </div>
        
        {/* View All Alerts button */}
        {hasMoreAlerts && onViewAllAlerts && (
          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onViewAllAlerts}
              className="w-full gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View All Alerts ({alerts.length})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
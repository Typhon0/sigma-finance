# Alert Management System UI Components

This directory contains the complete alert management system UI components for the portfolio tracker dashboard. The system provides comprehensive alert configuration, management, and monitoring capabilities integrated seamlessly with the dashboard-centric architecture.

## Components Overview

### Core Components

#### `AlertManagement`
The main alert management component that provides a complete interface for managing alerts within the dashboard context.

**Features:**
- Alert statistics dashboard
- Tabbed interface for active alerts, notifications, history, and testing
- Create/edit alert forms
- Alert list with filtering and search
- Notification management
- Alert history tracking
- Testing and validation interface

**Props:**
- `portfolios`: Available portfolios for alert configuration
- `assets`: Available assets for alert configuration
- `alerts`: Current user alerts
- `notifications`: Alert notifications
- `alertHistory`: Historical alert trigger data
- Event handlers for CRUD operations

#### `AlertConfigurationForm`
Comprehensive form component for creating and editing alerts with validation.

**Features:**
- Alert type selection (Price, Percentage Change, Portfolio Value, Allocation)
- Condition configuration (Above/Below, Increase/Decrease)
- Asset/Portfolio selection based on alert type
- Threshold value/percentage configuration
- Notification method selection (Email, Push, SMS)
- Form validation with Zod schema
- Real-time form updates based on selections

#### `AlertList`
Displays and manages lists of alerts with filtering, search, and actions.

**Features:**
- Search functionality across alert names and targets
- Filter by alert type and status
- Inline actions (edit, delete, activate/deactivate)
- Alert status indicators
- Trigger count display
- Responsive design with mobile optimization

#### `AlertNotifications`
Manages alert notifications with acknowledgment functionality.

**Features:**
- Unacknowledged notifications display
- Bulk acknowledgment actions
- Notification history
- Visual priority indicators
- Time-based grouping
- Real-time notification updates

#### `AlertHistory`
Comprehensive alert history tracking and analysis.

**Features:**
- Timeline-based history display
- Date range filtering
- Search across alert history
- Export functionality
- Statistics and metrics
- Acknowledgment tracking

#### `AlertQuickSetup`
Streamlined alert creation using predefined templates.

**Features:**
- Template-based alert creation
- Context-aware suggestions
- Quick threshold calculations
- Simplified configuration flow
- Integration with portfolio/asset context

#### `AlertTesting`
Testing and validation interface for alert functionality.

**Features:**
- Manual alert testing
- Condition simulation
- Notification delivery testing
- Quick test actions
- Test result tracking
- Mock value configuration

### Integration Components

#### `AlertDashboardIntegration`
Demonstrates how alerts integrate with the dashboard-centric architecture.

**Features:**
- Alert summary cards
- Quick action buttons
- Context-specific alert setup
- Notification display
- Seamless dashboard integration

## Usage Examples

### Basic Alert Management

```tsx
import { AlertManagement } from '@/components/alerts';

function MyDashboard() {
  const [alerts, setAlerts] = useState([]);
  
  const handleCreateAlert = async (data) => {
    // Create alert via GraphQL mutation
    const result = await createAlert(data);
    setAlerts(prev => [...prev, result]);
  };

  return (
    <AlertManagement
      portfolios={portfolios}
      assets={assets}
      alerts={alerts}
      onCreateAlert={handleCreateAlert}
      onUpdateAlert={handleUpdateAlert}
      onDeleteAlert={handleDeleteAlert}
    />
  );
}
```

### Quick Alert Setup

```tsx
import { AlertQuickSetup } from '@/components/alerts';

function PortfolioView({ portfolio, assets }) {
  return (
    <div>
      <AlertQuickSetup
        portfolios={[portfolio]}
        assets={assets}
        preselectedPortfolioId={portfolio.id}
        onSubmit={handleQuickAlert}
      />
    </div>
  );
}
```

### Dashboard Integration

```tsx
import { AlertDashboardIntegration } from '@/components/dashboard/alert-dashboard-integration';

function DashboardHome() {
  return (
    <AlertDashboardIntegration
      portfolios={portfolios}
      assets={assets}
      currentPortfolio={selectedPortfolio}
      currentAsset={selectedAsset}
    />
  );
}
```

## Alert Types and Configuration

### Supported Alert Types

1. **Price Alerts** (`PRICE`)
   - Trigger when asset price goes above/below threshold
   - Requires: Asset selection, threshold value
   - Conditions: ABOVE, BELOW

2. **Percentage Change Alerts** (`PERCENTAGE_CHANGE`)
   - Trigger on percentage price changes
   - Requires: Asset selection, threshold percentage
   - Conditions: INCREASE_BY, DECREASE_BY

3. **Portfolio Value Alerts** (`PORTFOLIO_VALUE`)
   - Trigger when portfolio reaches value milestones
   - Requires: Portfolio selection, threshold value
   - Conditions: ABOVE, BELOW

4. **Allocation Alerts** (`ALLOCATION`)
   - Trigger on asset allocation changes
   - Requires: Portfolio selection, threshold percentage
   - Conditions: INCREASE_BY, DECREASE_BY

### Notification Methods

- **Email**: Traditional email notifications
- **Push**: Browser/app push notifications
- **SMS**: Text message alerts (requires phone number)

## Data Flow and State Management

### Alert Data Structure

```typescript
interface Alert {
  id: string;
  alertType: 'PRICE' | 'PERCENTAGE_CHANGE' | 'PORTFOLIO_VALUE' | 'ALLOCATION';
  conditionType: 'ABOVE' | 'BELOW' | 'INCREASE_BY' | 'DECREASE_BY';
  assetId?: string;
  portfolioId?: string;
  thresholdValue?: number;
  thresholdPercentage?: number;
  notificationMethods: ('EMAIL' | 'PUSH' | 'SMS')[];
  isActive: boolean;
  name?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}
```

### Event Handlers

All components use consistent event handler patterns:

```typescript
// CRUD Operations
onCreateAlert: (data: AlertFormData) => Promise<void>;
onUpdateAlert: (id: string, data: AlertFormData) => Promise<void>;
onDeleteAlert: (id: string) => Promise<void>;

// Notification Management
onAcknowledgeAlert: (id: string) => Promise<void>;

// Testing and Validation
onTestAlert: (data: AlertTestData) => Promise<void>;

// Filtering and Search
onFilterAlerts: (filters: AlertFilterData) => void;
```

## Dashboard Integration

### Context-Aware Alert Setup

The alert system is designed to work seamlessly with the dashboard-centric architecture:

1. **Portfolio Context**: When viewing a portfolio, alerts can be created specifically for that portfolio
2. **Asset Context**: When viewing an asset, price and percentage alerts can be quickly configured
3. **Dashboard Overview**: Summary cards show alert statistics and recent notifications
4. **Inline Management**: Full alert management without leaving the dashboard context

### Navigation Preservation

The alert system maintains the dashboard's navigation structure:
- Sidebar remains accessible during alert management
- Breadcrumb navigation shows current context
- Modal dialogs for quick actions
- Inline forms for detailed configuration

## Styling and Theming

### Design System Integration

- Uses Radix UI primitives with Tailwind CSS
- Consistent with dashboard component styling
- Responsive design for mobile and desktop
- Dark/light theme support
- Accessible color schemes for alert priorities

### Visual Indicators

- **Active Alerts**: Green indicators and badges
- **Inactive Alerts**: Gray/muted styling
- **Notifications**: Orange/red for unacknowledged
- **Success States**: Green checkmarks and badges
- **Error States**: Red indicators and messages

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Heavy components loaded on demand
2. **Virtualization**: Large alert lists use virtual scrolling
3. **Debounced Search**: Search inputs debounced for performance
4. **Memoization**: Expensive calculations memoized
5. **Efficient Filtering**: Client-side filtering for small datasets

### Real-time Updates

- WebSocket integration for live notifications
- Optimistic UI updates for better UX
- Background sync for alert status changes
- Efficient re-rendering with React keys

## Testing Strategy

### Component Testing

```typescript
// Example test structure
describe('AlertManagement', () => {
  it('should create new alerts', async () => {
    // Test alert creation flow
  });
  
  it('should filter alerts by type', () => {
    // Test filtering functionality
  });
  
  it('should acknowledge notifications', async () => {
    // Test notification acknowledgment
  });
});
```

### Integration Testing

- Test alert creation workflow end-to-end
- Verify notification delivery simulation
- Test dashboard integration points
- Validate form submission and validation

## Future Enhancements

### Planned Features

1. **Advanced Conditions**: Complex alert conditions with multiple criteria
2. **Alert Templates**: Predefined alert templates for common scenarios
3. **Batch Operations**: Bulk alert creation and management
4. **Alert Analytics**: Performance metrics and trigger analysis
5. **Smart Suggestions**: AI-powered alert recommendations
6. **Integration APIs**: Third-party notification services
7. **Mobile App**: Native mobile alert management
8. **Voice Alerts**: Voice-based notification delivery

### Technical Improvements

1. **GraphQL Subscriptions**: Real-time alert updates
2. **Service Workers**: Offline alert management
3. **Push API**: Native browser push notifications
4. **WebRTC**: Real-time communication for urgent alerts
5. **Machine Learning**: Predictive alert suggestions
6. **Blockchain Integration**: Crypto-specific alert conditions

## Requirements Compliance

This implementation addresses all requirements from Requirement 6:

- ✅ 6.1: Price threshold alerts (above/below specific values)
- ✅ 6.2: Percentage change alerts (daily/weekly gains/losses)
- ✅ 6.3: Multi-channel notifications (email, push, SMS)
- ✅ 6.4: Alert management dashboard with status display
- ✅ 6.5: Alert acknowledgment and event logging
- ✅ 6.6: Alert editing with threshold validation
- ✅ 6.7: Alert deletion with confirmation
- ✅ 6.8: Alert activation/deactivation controls

The system is fully integrated with the dashboard-centric architecture and provides efficient alert creation from portfolio views as specified in the task requirements.
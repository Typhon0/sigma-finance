# Asset Management UI Components

This directory contains comprehensive UI components for managing assets within the dashboard-centric portfolio tracker. These components are optimized for inline views and dashboard integration.

## Components Overview

### Core Components

#### `AssetTypeSelector`
Interactive grid for selecting asset types with icons and descriptions.
- Supports all asset types: STOCK, CRYPTO, BANK_ACCOUNT, REAL_ESTATE, LIFE_INSURANCE, WATCH, OTHER_VALUABLE
- Visual feedback for selection state
- Loading states and responsive design

#### `AssetManagementDialog`
Complete asset creation workflow with type selection and forms.
- Multi-step dialog (type selection → form)
- Integrates all asset-specific forms
- Handles form submission and error states

### Asset-Specific Forms

#### `StockAssetForm`
Form for adding stock assets with validation.
- Fields: ticker, company name, quantity, purchase price, purchase date
- Real-time ticker symbol validation
- Automatic uppercase conversion for tickers

#### `CryptoAssetForm`
Form for cryptocurrency assets.
- Fields: symbol, name, blockchain network, quantity, purchase price, wallet address
- Blockchain network selection dropdown
- Wallet address validation

#### `BankAccountForm`
Form for bank accounts and deposits.
- Fields: account name, institution, account type, balance, currency
- Account type selection (checking, savings, term deposit, etc.)
- Multi-currency support

#### `RealEstateForm`
Form for real estate properties.
- Fields: property name, type, address, location, ownership percentage
- Property type selection
- Ownership percentage validation (0.01% - 100%)

#### `WatchForm`
Form for luxury watches and timepieces.
- Fields: brand, model, condition, serial number, materials, movement
- Comprehensive watch metadata
- Condition and material dropdowns

### Position Management

#### `PositionList`
Advanced list component with filtering, sorting, and grouping.
- Multiple view modes (grid/list)
- Grouping by type, allocation, or performance
- Real-time search and filtering
- Sort by name, value, performance, allocation
- Responsive design with mobile optimization

#### `PositionCard`
Individual position display with performance metrics.
- Supports both grid and list view modes
- Performance indicators with color coding
- Inline actions (edit, delete)
- Asset type icons and badges

### Search and Filtering

#### `AssetSearch`
Debounced search with advanced filtering capabilities.
- Real-time search with 300ms debounce
- Asset type filtering
- Value range filtering
- Selected assets display
- Popover-based results with command palette

### Compact Charts

#### `CompactPerformanceChart`
Lightweight performance visualization for dashboard.
- Line chart with area fill
- Performance metrics display
- Trend indicators (up/down/neutral)
- Configurable height and grid options

#### `CompactAllocationChart`
Asset allocation visualization with horizontal bars.
- Percentage-based horizontal bar chart
- Color-coded asset types
- Legend with values and percentages
- Summary statistics

#### `CompactPriceChart`
Simplified candlestick chart for price data.
- SVG-based candlestick rendering
- Price change indicators
- Normalized price ranges
- Volume display option

## Usage Examples

### Basic Asset Type Selection
```tsx
import { AssetTypeSelector } from '@/components/assets';

function MyComponent() {
  const [selectedType, setSelectedType] = useState(null);
  
  return (
    <AssetTypeSelector
      selectedType={selectedType}
      onTypeSelect={setSelectedType}
    />
  );
}
```

### Position Management
```tsx
import { PositionList } from '@/components/assets';

function PortfolioView({ positions }) {
  return (
    <PositionList
      positions={positions}
      groupBy="type"
      onPositionClick={handlePositionClick}
      onEditPosition={handleEditPosition}
      onDeletePosition={handleDeletePosition}
    />
  );
}
```

### Asset Search
```tsx
import { AssetSearch } from '@/components/assets';

function AssetSelector() {
  const [selectedAssets, setSelectedAssets] = useState([]);
  
  const handleAssetSelect = (asset) => {
    setSelectedAssets(prev => [...prev, asset]);
  };
  
  return (
    <AssetSearch
      onAssetSelect={handleAssetSelect}
      selectedAssets={selectedAssets}
      showFilters={true}
    />
  );
}
```

### Compact Charts
```tsx
import { 
  CompactPerformanceChart,
  CompactAllocationChart,
  CompactPriceChart 
} from '@/components/assets';

function DashboardCharts({ performanceData, allocationData, priceData }) {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
      <CompactPerformanceChart
        data={performanceData}
        currentValue={107000}
        previousValue={100000}
      />
      
      <CompactAllocationChart
        data={allocationData}
        totalValue={37500}
      />
      
      <CompactPriceChart
        data={priceData}
        symbol="AAPL"
        currentPrice={155}
        previousClose={148}
      />
    </div>
  );
}
```

## Design Principles

### Dashboard-Centric Architecture
- All components are optimized for inline dashboard display
- No navigation away from dashboard context
- Consistent with sidebar navigation preservation
- Smooth transitions and context switching

### Responsive Design
- Mobile-first approach with touch-optimized interactions
- Adaptive layouts for different screen sizes
- Collapsible elements for space efficiency
- Accessible keyboard navigation

### Performance Optimization
- Debounced search inputs (300ms)
- Lazy loading for heavy components
- Efficient re-rendering with React.memo where appropriate
- Optimized chart rendering for large datasets

### User Experience
- Clear visual hierarchy with consistent spacing
- Color-coded performance indicators
- Loading states and error handling
- Intuitive form validation with helpful error messages

## Integration with Backend

### GraphQL Integration
- Uses existing `useAssets` and `useAssetTypes` hooks
- Optimistic updates for better UX
- Error handling with user-friendly messages
- Cache invalidation for data consistency

### Asset Type Support
The components support all asset types defined in the GraphQL schema:
- `STOCK` - Publicly traded securities
- `CRYPTO` - Cryptocurrencies and digital assets
- `BANK_ACCOUNT` - Bank accounts and deposits
- `REAL_ESTATE` - Properties and real estate investments
- `LIFE_INSURANCE` - Life insurance policies
- `WATCH` - Luxury watches and timepieces
- `OTHER_VALUABLE` - Other valuable assets

### Form Validation
- Client-side validation using Zod schemas
- Server-side validation error display
- Real-time field validation feedback
- Accessibility-compliant error messages

## Testing

### Component Testing
- Unit tests for individual components
- Integration tests for form workflows
- Visual regression tests for chart components
- Accessibility testing with screen readers

### Mock Data
- Comprehensive mock data for development
- Realistic test scenarios for edge cases
- Performance testing with large datasets
- Cross-browser compatibility testing

## Future Enhancements

### Planned Features
- Bulk asset import functionality
- Advanced filtering with saved filters
- Asset comparison tools
- Export functionality for asset data
- Real-time price updates via WebSocket
- Asset performance analytics
- Tax reporting integration
- Asset tagging and categorization

### Performance Improvements
- Virtual scrolling for large position lists
- Chart data sampling for performance
- Background data synchronization
- Progressive loading for heavy forms
- Caching strategies for frequently accessed data
# Data Export and Reporting System

This module provides comprehensive data export and reporting functionality for the portfolio tracker dashboard, enabling users to export their financial data in various formats for analysis, tax reporting, and compliance purposes.

## Features

### Export Types
- **Portfolio Data**: Complete portfolio information including positions, assets, and summary metrics
- **Transaction History**: Detailed transaction records with filtering options
- **Performance Analytics**: Performance metrics, charts, and analytical reports
- **Tax Reports**: Tax-ready reports with realized gains/losses and dividend income
- **Audit Trail**: Complete activity logs for compliance and security auditing
- **Data Backup**: Complete user data backup for restoration purposes

### Export Formats
- **CSV**: Spreadsheet-compatible format for data analysis
- **PDF**: Professional reports with charts and formatting
- **JSON**: Complete data preservation with metadata

### Dashboard Integration

#### Quick Export Actions
```tsx
import { ExportQuickActions } from '@/components/export/export-quick-actions';

// Full export dropdown menu
<ExportQuickActions 
  portfolioId={portfolio.id}
  portfolioName={portfolio.name}
  variant="outline"
  showLabel={true}
/>

// Single export button
<QuickExportButton
  type="portfolio-data"
  portfolioId={portfolio.id}
  portfolioName={portfolio.name}
/>
```

#### Export Dialog
```tsx
import { ExportDialog } from '@/components/export/export-dialog';

<ExportDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  portfolioId={portfolio.id}
  portfolioName={portfolio.name}
  defaultType="portfolio-data"
/>
```

#### Data Backup & Restore
```tsx
import { DataBackupRestore } from '@/components/export/data-backup-restore';

<DataBackupRestore userId={currentUser.id} />
```

## Implementation Details

### Export Service
The `ExportService` class handles all export operations:

```typescript
// Export portfolio data
const result = await ExportService.exportPortfolioData(portfolioId, 'csv');

// Export transaction history with date range
const result = await ExportService.exportTransactionHistory(
  portfolioId,
  { start: new Date('2024-01-01'), end: new Date('2024-12-31') },
  'csv'
);

// Create tax report
const result = await ExportService.exportTaxReport(userId, 2024, 'pdf');

// Export audit trail
const result = await ExportService.exportAuditTrail(
  userId,
  { start: new Date('2024-01-01'), end: new Date('2024-12-31') },
  'csv'
);

// Create complete backup
const result = await ExportService.createDataBackup(userId);
```

### CSV Export Format

#### Portfolio Data CSV Structure
```csv
PORTFOLIO SUMMARY
Name,Total Value,Total Cost,Gain/Loss,Return %,Created Date
My Portfolio,150000,120000,30000,25.0,2024-01-01

POSITIONS
Asset Name,Asset Type,Symbol,Quantity,Current Price,Current Value,Cost Basis,Gain/Loss,Return %,Ownership %
Apple Inc.,STOCK,AAPL,100,150.00,15000,12000,3000,25.0,100

TRANSACTIONS
Date,Type,Asset Name,Quantity,Amount,Price,Fee,Notes
2024-01-01,BUY,Apple Inc.,100,12000,120.00,10,Initial purchase
```

#### Transaction History CSV Structure
```csv
Date,Type,Asset Name,Quantity,Amount,Price,Fee,Notes
2024-01-01,BUY,Apple Inc.,100,12000,120.00,10,Initial purchase
2024-06-01,SELL,Apple Inc.,50,7500,150.00,10,Partial sale
```

#### Tax Report CSV Structure
```csv
TAX REPORT - 2024
SUMMARY
Tax Year,Total Realized Gains,Total Realized Losses,Net Gain/Loss,Total Dividends
2024,5000,-1000,4000,500

REALIZED GAINS/LOSSES
Asset Name,Symbol,Sale Date,Purchase Date,Quantity,Sale Price,Cost Basis,Gain/Loss,Term Type
Apple Inc.,AAPL,2024-06-01,2024-01-01,50,7500,6000,1500,short

DIVIDEND INCOME
Asset Name,Symbol,Date,Amount
Apple Inc.,AAPL,2024-03-15,100
```

### PDF Report Generation

PDF reports include:
- Professional formatting with company branding
- Portfolio summary with key metrics
- Asset allocation charts and tables
- Performance analytics with visual indicators
- Transaction history (recent transactions)
- Proper styling for printing and sharing

### Data Backup Format

Complete JSON backup includes:
```json
{
  "userId": "user-123",
  "exportDate": "2024-01-01T00:00:00Z",
  "portfolios": [...],
  "transactions": [...],
  "alerts": [...],
  "preferences": {...}
}
```

## Security Considerations

### Data Protection
- All exports include sensitive financial data
- Files are generated client-side and downloaded directly
- No temporary storage on servers
- User authentication required for all export operations

### Audit Trail
- All export operations are logged for security auditing
- Export logs include user ID, timestamp, export type, and IP address
- Audit trail exports themselves are also logged

### File Handling
- Generated files are automatically downloaded to user's device
- No server-side file storage for exported data
- Temporary blob URLs are cleaned up after download

## Error Handling

### Export Failures
```typescript
const result = await ExportService.exportPortfolioData(portfolioId, 'csv');

if (!result.success) {
  // Handle error
  console.error('Export failed:', result.error);
  showErrorMessage(result.error);
}
```

### Common Error Scenarios
- **Portfolio Not Found**: Invalid portfolio ID provided
- **Insufficient Data**: Not enough data for meaningful export
- **Format Not Supported**: Requested format not available for export type
- **Date Range Invalid**: Invalid or missing date range for time-based exports
- **Permission Denied**: User lacks permission to export requested data

## Performance Considerations

### Large Dataset Handling
- Progress indicators for long-running exports
- Data sampling for very large datasets
- Chunked processing for memory efficiency
- Background processing for complex reports

### Caching Strategy
- Calculated metrics cached for repeated exports
- Price data cached to avoid redundant API calls
- Export templates cached for faster generation

## Future Enhancements

### Planned Features
- **Scheduled Exports**: Automatic periodic exports
- **Email Delivery**: Send exports via email
- **Cloud Storage**: Direct upload to cloud storage services
- **Custom Templates**: User-defined export templates
- **Batch Processing**: Export multiple portfolios simultaneously

### Integration Opportunities
- **Tax Software**: Direct integration with tax preparation software
- **Accounting Systems**: Export to QuickBooks, Xero, etc.
- **Analytics Platforms**: Export to business intelligence tools
- **Compliance Systems**: Automated regulatory reporting

## Testing

### Unit Tests
- Export service functionality
- CSV generation accuracy
- PDF report formatting
- Data validation and sanitization

### Integration Tests
- End-to-end export workflows
- File download functionality
- Error handling scenarios
- Performance with large datasets

### User Acceptance Tests
- Export accuracy verification
- File format compatibility
- User interface usability
- Mobile device compatibility

## Usage Examples

### Basic Portfolio Export
```tsx
function PortfolioExportButton({ portfolio }) {
  return (
    <QuickExportButton
      type="portfolio-data"
      portfolioId={portfolio.id}
      portfolioName={portfolio.name}
      variant="outline"
    >
      Export Portfolio
    </QuickExportButton>
  );
}
```

### Advanced Export with Options
```tsx
function AdvancedExportDialog({ portfolio }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        Advanced Export
      </Button>
      
      <ExportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        portfolioId={portfolio.id}
        portfolioName={portfolio.name}
        defaultType="performance-analytics"
      />
    </>
  );
}
```

### Dashboard Integration
```tsx
function DashboardWithExports({ portfolios, selectedPortfolio, userId }) {
  return (
    <div>
      {/* Portfolio header with export actions */}
      <div className="flex justify-between items-center">
        <h1>{selectedPortfolio?.name}</h1>
        <ExportQuickActions 
          portfolioId={selectedPortfolio?.id}
          portfolioName={selectedPortfolio?.name}
        />
      </div>
      
      {/* Settings page with backup/restore */}
      <DashboardSettings userId={userId} />
    </div>
  );
}
```
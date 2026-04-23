# Chart System Setup

This guide explains the chart system implementation for the portfolio tracker.

## Chart Options

We provide multiple chart implementations to ensure compatibility and performance:

### 1. TradingView Lightweight Charts (Default)
- **Free and open source** - No licensing required
- **Lightweight** - Small bundle size and fast performance  
- **Professional** - High-quality candlestick charts
- **Easy integration** - Available as npm package

### 2. ECharts Fallback
- **Reliable fallback** - Always works without external dependencies
- **Simple line charts** - Good for basic price visualization
- **Responsive** - Works well on all devices

### 3. TradingView Full Library (Optional)
- **Advanced features** - Professional trading tools
- **Requires license** - Commercial license needed for production
- **Large bundle** - Heavier implementation

## Current Implementation

The system automatically uses **TradingView Lightweight Charts** by default, which provides the best balance of features, performance, and licensing simplicity.

### Installation

The Lightweight Charts library is already installed via npm:

```json
{
  "dependencies": {
    "lightweight-charts": "^5.0.8"
  }
}
```

No additional setup is required!

## Usage

### Basic Chart Usage

```tsx
import ChartContainer from '@/components/charts/ChartContainer';

function MyComponent() {
  return (
    <ChartContainer
      symbol="BTC/USDT:CRYPTO"
      assetType="CRYPTO"
      height="600px"
      title="Bitcoin Price Chart"
    />
  );
}
```

### Advanced Usage

```tsx
import TradingViewChart from '@/components/charts/TradingViewChart';

function AdvancedChart() {
  return (
    <TradingViewChart
      symbol="BTC/USDT:CRYPTO"
      assetType="CRYPTO"
      interval="1D"
      theme="light"
      height={600}
      useLightweightCharts={true}
      fallbackToSimpleChart={true}
      onChartReady={() => console.log('Chart ready!')}
    />
  );
}
```

## Configuration Options

The TradingViewChart component accepts these props:

- `symbol`: Trading symbol (e.g., "BTC/USDT:CRYPTO", "AAPL:STOCK")
- `assetType`: Asset type for display ("CRYPTO", "STOCK", etc.)
- `interval`: Chart interval ("1", "5", "15", "30", "60", "240", "1D")
- `theme`: Chart theme ("light" or "dark")
- `locale`: Language code ("en", "es", "fr", etc.)
- `timezone`: Timezone ("Etc/UTC", "America/New_York", etc.)
- `onChartReady`: Callback when chart is initialized

## Troubleshooting

### Library Not Found Error
If you see "Failed to load TradingView library", ensure:
1. Library files are in `client/public/charting_library/`
2. The `charting_library.js` file is accessible
3. Your web server serves static files from the public directory

### CORS Issues
If you encounter CORS errors:
1. Ensure your development server serves files from the public directory
2. Check that the library files have proper permissions
3. Verify the library path configuration

### Chart Not Displaying
If the chart container is empty:
1. Ensure the container has a defined height
2. Check browser console for JavaScript errors
3. Verify the datafeed is returning data correctly

## License

The TradingView Charting Library requires a commercial license for production use.
Please review TradingView's licensing terms before deployment.

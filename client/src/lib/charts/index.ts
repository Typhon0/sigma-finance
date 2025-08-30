/**
 * Chart libraries configuration and utilities
 * Centralized exports for Lightweight Charts™ and Apache ECharts integration
 */

// Lightweight Charts exports
export * from './lightweight-charts';

// ECharts exports
export * from './echarts';

// Configuration utilities
export * from './config';

// Theming utilities
export * from './theming';

// Data formatting utilities
export * from './data-formatters';

// Performance optimization utilities
export * from './performance';
export * from './performance-optimization';

// Real-time updates
export * from './real-time-updates';

// Chart color utilities (re-export from existing file)
export {
  getChartColors,
  getChartThemeColors,
  getAssetTypeColor,
  ASSET_TYPE_COLORS,
  oklchToRgb,
} from '../chart-colors';

/**
 * Chart library initialization
 */
export class ChartLibraryManager {
  private static initialized = false;
  private static lightweightChartsLoaded = false;
  private static echartsLoaded = false;

  /**
   * Initialize chart libraries
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Preload chart libraries
      await Promise.all([
        this.loadLightweightCharts(),
        this.loadECharts(),
      ]);

      this.initialized = true;
      console.log('Chart libraries initialized successfully');
    } catch (error) {
      console.error('Failed to initialize chart libraries:', error);
      throw error;
    }
  }

  /**
   * Load Lightweight Charts library
   */
  private static async loadLightweightCharts(): Promise<void> {
    if (this.lightweightChartsLoaded) return;

    try {
      await import('lightweight-charts');
      this.lightweightChartsLoaded = true;
    } catch (error) {
      console.error('Failed to load Lightweight Charts:', error);
      throw error;
    }
  }

  /**
   * Load ECharts library
   */
  private static async loadECharts(): Promise<void> {
    if (this.echartsLoaded) return;

    try {
      await import('echarts-for-react');
      this.echartsLoaded = true;
    } catch (error) {
      console.error('Failed to load ECharts:', error);
      throw error;
    }
  }

  /**
   * Check if libraries are loaded
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get library status
   */
  static getStatus(): {
    initialized: boolean;
    lightweightCharts: boolean;
    echarts: boolean;
  } {
    return {
      initialized: this.initialized,
      lightweightCharts: this.lightweightChartsLoaded,
      echarts: this.echartsLoaded,
    };
  }
}

/**
 * Chart library feature detection
 */
export class ChartFeatureDetection {
  /**
   * Check if WebGL is supported
   */
  static isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if Canvas is supported
   */
  static isCanvasSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if SVG is supported
   */
  static isSVGSupported(): boolean {
    return !!(
      document.createElementNS &&
      document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect
    );
  }

  /**
   * Check device capabilities
   */
  static getDeviceCapabilities(): {
    webgl: boolean;
    canvas: boolean;
    svg: boolean;
    touchSupport: boolean;
    highDPI: boolean;
    performanceAPI: boolean;
  } {
    return {
      webgl: this.isWebGLSupported(),
      canvas: this.isCanvasSupported(),
      svg: this.isSVGSupported(),
      touchSupport: 'ontouchstart' in window,
      highDPI: window.devicePixelRatio > 1,
      performanceAPI: 'performance' in window,
    };
  }

  /**
   * Get recommended chart library based on capabilities
   */
  static getRecommendedLibrary(chartType: string): 'lightweight' | 'echarts' {
    const capabilities = this.getDeviceCapabilities();

    // Lightweight Charts is better for candlestick and real-time data
    if (['candlestick', 'line', 'area'].includes(chartType) && capabilities.canvas) {
      return 'lightweight';
    }

    // ECharts is better for complex visualizations
    return 'echarts';
  }
}

/**
 * Chart error handling utilities
 */
export class ChartErrorHandler {
  private static errorCallbacks = new Map<string, (error: Error) => void>();

  /**
   * Register error callback for chart
   */
  static registerErrorCallback(chartId: string, callback: (error: Error) => void): void {
    this.errorCallbacks.set(chartId, callback);
  }

  /**
   * Handle chart error
   */
  static handleError(chartId: string, error: Error): void {
    console.error(`Chart error in ${chartId}:`, error);

    const callback = this.errorCallbacks.get(chartId);
    if (callback) {
      callback(error);
    }

    // Log to analytics or error reporting service
    this.logError(chartId, error);
  }

  /**
   * Log error to external service
   */
  private static logError(chartId: string, error: Error): void {
    // Implementation would depend on your error reporting service
    // Example: Sentry, LogRocket, etc.
    console.log('Logging chart error:', { chartId, error: error.message, stack: error.stack });
  }

  /**
   * Create error boundary for charts
   */
  static createErrorBoundary(fallbackComponent: React.ComponentType<{ error: Error }>): React.ComponentType {
    return class ChartErrorBoundary extends React.Component<
      { children: React.ReactNode },
      { hasError: boolean; error?: Error }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
      }

      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        ChartErrorHandler.logError('chart-boundary', error);
      }

      render() {
        if (this.state.hasError && this.state.error) {
          return React.createElement(fallbackComponent, { error: this.state.error });
        }

        return this.props.children;
      }
    };
  }
}

/**
 * Chart accessibility utilities
 */
export class ChartAccessibility {
  /**
   * Generate accessible description for chart data
   */
  static generateDescription(data: any[], chartType: string): string {
    const dataLength = data.length;
    
    switch (chartType) {
      case 'line':
      case 'area':
        const values = data.map(d => d.value).filter(v => typeof v === 'number');
        const min = Math.min(...values);
        const max = Math.max(...values);
        const trend = values[values.length - 1] > values[0] ? 'increasing' : 'decreasing';
        return `Line chart with ${dataLength} data points, ranging from ${min} to ${max}, showing an ${trend} trend.`;

      case 'pie':
      case 'donut':
        const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
        const segments = data.length;
        return `Pie chart with ${segments} segments, total value of ${total}.`;

      case 'bar':
      case 'column':
        const barValues = data.map(d => d.value).filter(v => typeof v === 'number');
        const barMax = Math.max(...barValues);
        return `Bar chart with ${dataLength} bars, maximum value of ${barMax}.`;

      case 'candlestick':
        return `Candlestick chart with ${dataLength} price points showing market data over time.`;

      default:
        return `Chart with ${dataLength} data points.`;
    }
  }

  /**
   * Generate keyboard navigation instructions
   */
  static generateKeyboardInstructions(chartType: string): string {
    const baseInstructions = 'Use arrow keys to navigate data points, Enter to select, Escape to exit.';
    
    switch (chartType) {
      case 'candlestick':
        return `${baseInstructions} Use + and - to zoom in and out.`;
      case 'pie':
      case 'donut':
        return `${baseInstructions} Use Tab to cycle through segments.`;
      default:
        return baseInstructions;
    }
  }
}

// Initialize chart libraries on module load
if (typeof window !== 'undefined') {
  ChartLibraryManager.initialize().catch(console.error);
}
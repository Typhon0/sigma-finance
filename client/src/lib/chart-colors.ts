/**
 * Chart color utilities for ECharts integration with shadcn/ui theme
 */

// Fallback color mappings for OKLCH to RGB conversion
const CHART_COLOR_FALLBACKS: Record<string, string> = {
  // Light theme colors
  'oklch(0.646 0.222 41.116)': '#e11d48', // chart-1 red
  'oklch(0.6 0.118 184.704)': '#0ea5e9',   // chart-2 blue  
  'oklch(0.398 0.07 227.392)': '#8b5cf6',  // chart-3 purple
  'oklch(0.828 0.189 84.429)': '#22c55e',  // chart-4 green
  'oklch(0.769 0.188 70.08)': '#f59e0b',   // chart-5 orange
  
  // Dark theme colors
  'oklch(0.488 0.243 264.376)': '#8b5cf6', // chart-1 purple
  'oklch(0.696 0.17 162.48)': '#10b981',   // chart-2 emerald
  'oklch(0.769 0.188 70.08)': '#f59e0b',   // chart-3 orange
  'oklch(0.627 0.265 303.9)': '#ec4899',   // chart-4 pink
  'oklch(0.645 0.246 16.439)': '#ef4444',  // chart-5 red
}

/**
 * Convert OKLCH color to RGB hex string
 * Uses fallback mapping for now - in production you'd want a proper converter
 */
export function oklchToRgb(oklch: string): string {
  if (!oklch || !oklch.includes('oklch')) {
    return oklch
  }
  
  return CHART_COLOR_FALLBACKS[oklch] || oklch
}

/**
 * Get chart colors from CSS variables
 */
export function getChartColors(): string[] {
  if (typeof window === 'undefined') {
    return ['#e11d48', '#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b']
  }
  
  const root = document.documentElement
  const computedStyle = getComputedStyle(root)
  
  return [
    oklchToRgb(computedStyle.getPropertyValue('--chart-1').trim()),
    oklchToRgb(computedStyle.getPropertyValue('--chart-2').trim()),
    oklchToRgb(computedStyle.getPropertyValue('--chart-3').trim()),
    oklchToRgb(computedStyle.getPropertyValue('--chart-4').trim()),
    oklchToRgb(computedStyle.getPropertyValue('--chart-5').trim()),
  ]
}

/**
 * Get theme colors for chart styling
 */
export function getChartThemeColors() {
  if (typeof window === 'undefined') {
    return {
      background: 'transparent',
      foreground: '#000000',
      card: '#ffffff',
      cardForeground: '#000000',
      border: '#e5e7eb',
      mutedForeground: '#6b7280',
    }
  }
  
  const root = document.documentElement
  const computedStyle = getComputedStyle(root)
  
  return {
    background: 'transparent',
    foreground: oklchToRgb(computedStyle.getPropertyValue('--foreground').trim()),
    card: oklchToRgb(computedStyle.getPropertyValue('--card').trim()),
    cardForeground: oklchToRgb(computedStyle.getPropertyValue('--card-foreground').trim()),
    border: oklchToRgb(computedStyle.getPropertyValue('--border').trim()),
    mutedForeground: oklchToRgb(computedStyle.getPropertyValue('--muted-foreground').trim()),
  }
}

/**
 * Asset type color mapping for consistent visualization
 */
export const ASSET_TYPE_COLORS: Record<string, string> = {
  STOCK: '#e11d48',       // Red
  CRYPTO: '#0ea5e9',      // Blue
  BANK_ACCOUNT: '#22c55e', // Green
  REAL_ESTATE: '#8b5cf6', // Purple
  LIFE_INSURANCE: '#f59e0b', // Orange
  WATCH: '#ec4899',       // Pink
  OTHER: '#6b7280',       // Gray
}

/**
 * Get color for asset type
 */
export function getAssetTypeColor(assetType: string): string {
  return ASSET_TYPE_COLORS[assetType] || ASSET_TYPE_COLORS.OTHER
}
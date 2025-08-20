import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssetPerformanceComponent, CompactAssetPerformance } from '../asset-performance'
import { AssetPerformance as AssetPerformanceType } from '@/lib/types/dashboard.types'

// Mock TanStack Router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate
}))

// Mock asset performance data for testing
const mockTopPerformers: AssetPerformanceType[] = [
  {
    asset: {
      id: 'asset-1',
      name: 'Apple Inc.',
      symbol: 'AAPL',
      currentValue: 150,
      purchasePrice: 100,
      assetType: { id: 'type-1', name: 'STOCK' }
    },
    currentValue: 15000, // 100 shares * $150
    changeAmount: 5000, // $15000 - $10000
    changePercent: 50, // 50% gain
    positions: []
  },
  {
    asset: {
      id: 'asset-2',
      name: 'Microsoft Corp.',
      symbol: 'MSFT',
      currentValue: 300,
      purchasePrice: 250,
      assetType: { id: 'type-1', name: 'STOCK' }
    },
    currentValue: 30000, // 100 shares * $300
    changeAmount: 5000, // $30000 - $25000
    changePercent: 20, // 20% gain
    positions: []
  },
  {
    asset: {
      id: 'asset-3',
      name: 'Tesla Inc.',
      symbol: 'TSLA',
      currentValue: 200,
      purchasePrice: 180,
      assetType: { id: 'type-1', name: 'STOCK' }
    },
    currentValue: 20000, // 100 shares * $200
    changeAmount: 2000, // $20000 - $18000
    changePercent: 11.11, // 11.11% gain
    positions: []
  }
]

const mockWorstPerformers: AssetPerformanceType[] = [
  {
    asset: {
      id: 'asset-4',
      name: 'Meta Platforms',
      symbol: 'META',
      currentValue: 80,
      purchasePrice: 120,
      assetType: { id: 'type-1', name: 'STOCK' }
    },
    currentValue: 8000, // 100 shares * $80
    changeAmount: -4000, // $8000 - $12000
    changePercent: -33.33, // -33.33% loss
    positions: []
  },
  {
    asset: {
      id: 'asset-5',
      name: 'Netflix Inc.',
      symbol: 'NFLX',
      currentValue: 350,
      purchasePrice: 400,
      assetType: { id: 'type-1', name: 'STOCK' }
    },
    currentValue: 35000, // 100 shares * $350
    changeAmount: -5000, // $35000 - $40000
    changePercent: -12.5, // -12.5% loss
    positions: []
  },
  {
    asset: {
      id: 'asset-6',
      name: 'Crypto Asset',
      currentValue: 45000,
      purchasePrice: 50000,
      assetType: { id: 'type-2', name: 'CRYPTO' }
    },
    currentValue: 45000,
    changeAmount: -5000, // $45000 - $50000
    changePercent: -10, // -10% loss
    positions: []
  }
]

// Default props for testing
const defaultProps = {
  topPerformers: mockTopPerformers,
  worstPerformers: mockWorstPerformers,
  isLoading: false
}

describe('AssetPerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Asset performance calculations and sorting', () => {
    it('renders top performers section with correct data', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      // Check section title
      expect(screen.getByText('Top Performers')).toBeInTheDocument()

      // Check asset names and symbols
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('Microsoft Corp.')).toBeInTheDocument()
      expect(screen.getByText('MSFT')).toBeInTheDocument()
      expect(screen.getByText('Tesla Inc.')).toBeInTheDocument()
      expect(screen.getByText('TSLA')).toBeInTheDocument()
    })

    it('renders worst performers section with correct data', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      // Check section title
      expect(screen.getByText('Worst Performers')).toBeInTheDocument()

      // Check asset names and symbols
      expect(screen.getByText('Meta Platforms')).toBeInTheDocument()
      expect(screen.getByText('META')).toBeInTheDocument()
      expect(screen.getByText('Netflix Inc.')).toBeInTheDocument()
      expect(screen.getByText('NFLX')).toBeInTheDocument()
      expect(screen.getByText('Crypto Asset')).toBeInTheDocument()
    })

    it('displays current values formatted as currency', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      expect(screen.getByText('$15,000.00')).toBeInTheDocument() // Apple
      expect(screen.getByText('$30,000.00')).toBeInTheDocument() // Microsoft
      expect(screen.getByText('$8,000.00')).toBeInTheDocument() // Meta
      expect(screen.getByText('$35,000.00')).toBeInTheDocument() // Netflix
    })

    it('displays percentage changes with correct formatting', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      expect(screen.getByText('+50.00%')).toBeInTheDocument() // Apple
      expect(screen.getByText('+20.00%')).toBeInTheDocument() // Microsoft
      expect(screen.getByText('-33.33%')).toBeInTheDocument() // Meta
      expect(screen.getByText('-12.50%')).toBeInTheDocument() // Netflix
    })

    it('displays absolute change amounts with correct formatting', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      // Use getAllByText for duplicate amounts
      const positiveAmounts = screen.getAllByText('+$5,000.00')
      expect(positiveAmounts).toHaveLength(2) // Apple and Microsoft
      
      expect(screen.getByText('-$4,000.00')).toBeInTheDocument() // Meta
      
      const negativeAmounts = screen.getAllByText('-$5,000.00')
      expect(negativeAmounts).toHaveLength(2) // Netflix and Crypto
    })

    it('handles assets without symbols correctly', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      // Crypto Asset doesn't have a symbol, so no badge should be shown
      const cryptoAssetElement = screen.getByText('Crypto Asset')
      const parentElement = cryptoAssetElement.closest('div')
      
      // Should not have a symbol badge for crypto asset
      expect(parentElement?.querySelector('[class*="badge"]')).toBeNull()
    })
  })

  describe('Color coding for gains and losses', () => {
    it('applies green color to positive performance indicators', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      // Check for green color classes on positive performers
      const applePercentage = screen.getByText('+50.00%')
      expect(applePercentage).toHaveClass('text-green-600')

      const appleAmounts = screen.getAllByText('+$5,000.00')
      expect(appleAmounts[0]).toHaveClass('text-green-600')
    })

    it('applies red color to negative performance indicators', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      // Check for red color classes on negative performers
      const metaPercentage = screen.getByText('-33.33%')
      expect(metaPercentage).toHaveClass('text-red-600')

      const metaAmount = screen.getByText('-$4,000.00')
      expect(metaAmount).toHaveClass('text-red-600')
    })

    it('displays correct trending icons for performance', () => {
      const { container } = render(<AssetPerformanceComponent {...defaultProps} />)

      // Should have TrendingUp icons for positive performers
      const trendingUpIcons = container.querySelectorAll('[class*="text-green-600"]')
      expect(trendingUpIcons.length).toBeGreaterThan(0)

      // Should have TrendingDown icons for negative performers
      const trendingDownIcons = container.querySelectorAll('[class*="text-red-600"]')
      expect(trendingDownIcons.length).toBeGreaterThan(0)
    })

    it('handles zero performance correctly', () => {
      const zeroPerformanceAsset: AssetPerformanceType = {
        asset: {
          id: 'asset-zero',
          name: 'Stable Asset',
          symbol: 'STABLE',
          currentValue: 100,
          purchasePrice: 100,
          assetType: { id: 'type-1', name: 'STOCK' }
        },
        currentValue: 10000,
        changeAmount: 0,
        changePercent: 0,
        positions: []
      }

      render(
        <AssetPerformanceComponent
          topPerformers={[zeroPerformanceAsset]}
          worstPerformers={[]}
          isLoading={false}
        />
      )

      const zeroPercentage = screen.getByText('+0.00%')
      expect(zeroPercentage).toHaveClass('text-gray-600')
    })
  })

  describe('Navigation to asset details', () => {
    it('navigates to asset detail when asset item is clicked', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      const appleAsset = screen.getByText('Apple Inc.').closest('div[role="button"]')
      expect(appleAsset).toBeInTheDocument()

      fireEvent.click(appleAsset!)
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/assets/asset-1' })
    })

    it('handles keyboard navigation for asset items', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      const microsoftAsset = screen.getByText('Microsoft Corp.').closest('div[role="button"]')
      expect(microsoftAsset).toBeInTheDocument()

      // Test Enter key
      fireEvent.keyDown(microsoftAsset!, { key: 'Enter' })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/assets/asset-2' })

      // Test Space key
      fireEvent.keyDown(microsoftAsset!, { key: ' ' })
      expect(mockNavigate).toHaveBeenCalledTimes(2)
    })

    it('has proper accessibility attributes for clickable items', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      // Get the actual asset item divs, not the "View All" buttons
      const assetItems = document.querySelectorAll('div[role="button"]')
      assetItems.forEach(item => {
        expect(item).toHaveAttribute('tabindex', '0')
        expect(item).toHaveClass('cursor-pointer')
      })
    })

    it('shows external link indicators for navigation', () => {
      const { container } = render(<AssetPerformanceComponent {...defaultProps} />)

      // Should have external link icons
      const externalLinkIcons = container.querySelectorAll('svg[class*="text-muted-foreground"]')
      expect(externalLinkIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Loading states and empty states', () => {
    it('displays loading skeleton when isLoading is true', () => {
      render(<AssetPerformanceComponent {...defaultProps} isLoading={true} />)

      // Should not show actual asset data
      expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument()
      expect(screen.queryByText('Meta Platforms')).not.toBeInTheDocument()

      // Should show skeleton elements
      const skeletonElements = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('shows empty state when no top performers are available', () => {
      render(
        <AssetPerformanceComponent
          topPerformers={[]}
          worstPerformers={mockWorstPerformers}
          isLoading={false}
        />
      )

      expect(screen.getByText('No Top Performers')).toBeInTheDocument()
      expect(screen.getByText('No assets with positive performance found')).toBeInTheDocument()
    })

    it('shows empty state when no worst performers are available', () => {
      render(
        <AssetPerformanceComponent
          topPerformers={mockTopPerformers}
          worstPerformers={[]}
          isLoading={false}
        />
      )

      expect(screen.getByText('No Poor Performers')).toBeInTheDocument()
      expect(screen.getByText('No assets with negative performance found')).toBeInTheDocument()
    })

    it('shows both empty states when no data is available', () => {
      render(
        <AssetPerformanceComponent
          topPerformers={[]}
          worstPerformers={[]}
          isLoading={false}
        />
      )

      expect(screen.getByText('No Top Performers')).toBeInTheDocument()
      expect(screen.getByText('No Poor Performers')).toBeInTheDocument()
    })
  })

  describe('Responsive layout and grid behavior', () => {
    it('has responsive grid layout classes', () => {
      const { container } = render(<AssetPerformanceComponent {...defaultProps} />)

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('gap-6', 'md:grid-cols-2')
    })

    it('handles long asset names with truncation', () => {
      const longNameAsset: AssetPerformanceType = {
        asset: {
          id: 'asset-long',
          name: 'This is a very long asset name that should be truncated properly',
          symbol: 'LONG',
          currentValue: 100,
          purchasePrice: 90,
          assetType: { id: 'type-1', name: 'STOCK' }
        },
        currentValue: 10000,
        changeAmount: 1000,
        changePercent: 10,
        positions: []
      }

      render(
        <AssetPerformanceComponent
          topPerformers={[longNameAsset]}
          worstPerformers={[]}
          isLoading={false}
        />
      )

      const nameElement = screen.getByText('This is a very long asset name that should be truncated properly')
      expect(nameElement).toHaveClass('truncate')
    })

    it('maintains proper spacing and layout structure', () => {
      const { container } = render(<AssetPerformanceComponent {...defaultProps} />)

      // Check card structure
      const cards = container.querySelectorAll('[class*="rounded-lg border"]')
      expect(cards.length).toBeGreaterThan(0)

      // Check spacing between items
      const spaceContainers = container.querySelectorAll('.space-y-2')
      expect(spaceContainers.length).toBe(2) // One for each section
    })
  })

  describe('View All functionality', () => {
    it('shows View All button when there are performers', () => {
      render(<AssetPerformanceComponent {...defaultProps} />)

      const viewAllButtons = screen.getAllByText('View All')
      expect(viewAllButtons).toHaveLength(2) // One for each section
    })

    it('does not show View All button when loading', () => {
      render(<AssetPerformanceComponent {...defaultProps} isLoading={true} />)

      expect(screen.queryByText('View All')).not.toBeInTheDocument()
    })

    it('does not show View All button when no data is available', () => {
      render(
        <AssetPerformanceComponent
          topPerformers={[]}
          worstPerformers={[]}
          isLoading={false}
        />
      )

      expect(screen.queryByText('View All')).not.toBeInTheDocument()
    })
  })
})

describe('CompactAssetPerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Compact layout rendering', () => {
    it('renders in compact format with limited items', () => {
      render(<CompactAssetPerformance {...defaultProps} />)

      expect(screen.getByText('Asset Performance')).toBeInTheDocument()
      
      // Should show only top 2 from each category
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
      expect(screen.getByText('Microsoft Corp.')).toBeInTheDocument()
      expect(screen.getByText('Meta Platforms')).toBeInTheDocument()
      expect(screen.getByText('Netflix Inc.')).toBeInTheDocument()
      
      // Should not show the third item from top performers
      expect(screen.queryByText('Tesla Inc.')).not.toBeInTheDocument()
    })

    it('displays performance indicators in compact format', () => {
      render(<CompactAssetPerformance {...defaultProps} />)

      expect(screen.getByText('+50.00%')).toBeInTheDocument()
      expect(screen.getByText('+20.00%')).toBeInTheDocument()
      expect(screen.getByText('-33.33%')).toBeInTheDocument()
      expect(screen.getByText('-12.50%')).toBeInTheDocument()
    })

    it('handles navigation in compact mode', () => {
      render(<CompactAssetPerformance {...defaultProps} />)

      const appleAsset = screen.getByText('Apple Inc.').closest('div[class*="cursor-pointer"]')
      fireEvent.click(appleAsset!)

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/assets/asset-1' })
    })

    it('shows loading state in compact format', () => {
      render(<CompactAssetPerformance {...defaultProps} isLoading={true} />)

      expect(screen.getByText('Asset Performance')).toBeInTheDocument()
      expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument()

      // Should show skeleton elements
      const skeletonElements = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('shows no data message when no performance data is available', () => {
      render(
        <CompactAssetPerformance
          topPerformers={[]}
          worstPerformers={[]}
          isLoading={false}
        />
      )

      expect(screen.getByText('No performance data available')).toBeInTheDocument()
    })
  })
})

describe('Accessibility and keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has proper semantic structure', () => {
    render(<AssetPerformanceComponent {...defaultProps} />)

    // Should have proper headings
    expect(screen.getByText('Top Performers')).toBeInTheDocument()
    expect(screen.getByText('Worst Performers')).toBeInTheDocument()

    // Should have clickable elements with proper roles
    const clickableElements = screen.getAllByRole('button')
    expect(clickableElements.length).toBeGreaterThan(0)
  })

  it('supports keyboard navigation', () => {
    render(<AssetPerformanceComponent {...defaultProps} />)

    const assetItems = document.querySelectorAll('div[role="button"]')
    assetItems.forEach(item => {
      expect(item).toHaveAttribute('tabindex', '0')
    })
  })

  it('handles keyboard navigation correctly', () => {
    render(<AssetPerformanceComponent {...defaultProps} />)

    const assetItem = screen.getByText('Apple Inc.').closest('div[role="button"]')
    
    // Test that keyboard navigation triggers the navigation function
    fireEvent.keyDown(assetItem!, { key: ' ' })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/assets/asset-1' })
    
    // Test Enter key as well
    fireEvent.keyDown(assetItem!, { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledTimes(2)
  })

  it('has proper hover states for interactive elements', () => {
    render(<AssetPerformanceComponent {...defaultProps} />)

    // Get the actual asset item divs, not the "View All" buttons
    const assetItems = document.querySelectorAll('div[role="button"]')
    assetItems.forEach(item => {
      expect(item).toHaveClass('hover:bg-muted/50', 'transition-colors')
    })
  })
})
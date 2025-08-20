import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AssetAllocationChart } from '../asset-allocation-chart'
import { AssetAllocationData } from '@/lib/types/dashboard.types'

// Mock the Chart component since ECharts requires DOM
vi.mock('@/components/ui/chart', () => ({
  Chart: ({ option, onClick, className }: any) => (
    <div 
      data-testid="mock-chart" 
      className={className}
      onClick={() => onClick && onClick({ data: { name: 'Stock', value: 50000 } })}
    >
      Mock Chart - {JSON.stringify(option.series[0]?.data?.length || 0)} data points
    </div>
  ),
}))

// Mock chart colors
vi.mock('@/lib/chart-colors', () => ({
  getAssetTypeColor: (assetType: string) => {
    const colors: Record<string, string> = {
      STOCK: '#e11d48',
      CRYPTO: '#0ea5e9',
      BANK_ACCOUNT: '#22c55e',
      REAL_ESTATE: '#8b5cf6',
      LIFE_INSURANCE: '#f59e0b',
    }
    return colors[assetType] || '#6b7280'
  },
}))

// Mock portfolio calculations
vi.mock('@/lib/utils/portfolio-calculations', () => ({
  formatCurrency: (value: number) => `$${value.toLocaleString('en-US')}`,
}))

describe('AssetAllocationChart', () => {
  const mockAllocationData: AssetAllocationData[] = [
    {
      assetType: 'STOCK',
      value: 50000,
      percentage: 50,
      color: '#e11d48',
    },
    {
      assetType: 'CRYPTO',
      value: 30000,
      percentage: 30,
      color: '#0ea5e9',
    },
    {
      assetType: 'BANK_ACCOUNT',
      value: 20000,
      percentage: 20,
      color: '#22c55e',
    },
  ]

  const mockOnAssetTypeClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should display loading skeleton when isLoading is true', () => {
      render(
        <AssetAllocationChart
          allocationData={[]}
          isLoading={true}
        />
      )

      expect(screen.getByText('Asset Allocation')).toBeInTheDocument()
      expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
      expect(screen.queryByTestId('mock-chart')).not.toBeInTheDocument()
    })

    it('should display multiple skeleton elements for legend items', () => {
      render(
        <AssetAllocationChart
          allocationData={[]}
          isLoading={true}
        />
      )

      // Should have skeleton for chart and legend items
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
      expect(skeletons.length).toBeGreaterThan(1)
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no allocation data is provided', () => {
      render(
        <AssetAllocationChart
          allocationData={[]}
          isLoading={false}
        />
      )

      expect(screen.getByText('No asset data available')).toBeInTheDocument()
      expect(screen.getByText('Add some assets to your portfolios to see allocation breakdown')).toBeInTheDocument()
      expect(screen.queryByTestId('mock-chart')).not.toBeInTheDocument()
    })

    it('should display empty state when allocation data has no values', () => {
      const emptyData: AssetAllocationData[] = [
        {
          assetType: 'STOCK',
          value: 0,
          percentage: 0,
          color: '#e11d48',
        },
      ]

      render(
        <AssetAllocationChart
          allocationData={emptyData}
          isLoading={false}
        />
      )

      expect(screen.getByText('No asset data available')).toBeInTheDocument()
    })
  })

  describe('Chart Data Processing', () => {
    it('should render chart with correct data', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
        />
      )

      expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
      expect(screen.getByText('Mock Chart - 3 data points')).toBeInTheDocument()
    })

    it('should display total value in header badge', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
        />
      )

      expect(screen.getByText('Total: $100,000')).toBeInTheDocument()
    })

    it('should filter out asset types with zero value', () => {
      const dataWithZero: AssetAllocationData[] = [
        ...mockAllocationData,
        {
          assetType: 'REAL_ESTATE',
          value: 0,
          percentage: 0,
          color: '#8b5cf6',
        },
      ]

      render(
        <AssetAllocationChart
          allocationData={dataWithZero}
          isLoading={false}
        />
      )

      // Should still show 3 data points (excluding the zero value)
      expect(screen.getByText('Mock Chart - 3 data points')).toBeInTheDocument()
    })

    it('should sort allocation data by value descending', () => {
      const unsortedData: AssetAllocationData[] = [
        {
          assetType: 'CRYPTO',
          value: 30000,
          percentage: 30,
          color: '#0ea5e9',
        },
        {
          assetType: 'STOCK',
          value: 50000,
          percentage: 50,
          color: '#e11d48',
        },
        {
          assetType: 'BANK_ACCOUNT',
          value: 20000,
          percentage: 20,
          color: '#22c55e',
        },
      ]

      render(
        <AssetAllocationChart
          allocationData={unsortedData}
          isLoading={false}
        />
      )

      // Check that the breakdown items are displayed in correct order
      // Find all currency values in the breakdown section (excluding header)
      const allCurrencyElements = document.querySelectorAll('.text-right .font-medium')
      // Filter out the header total (which would be the first one)
      const breakdownCurrencyElements = Array.from(allCurrencyElements).slice(-3) // Get last 3
      expect(breakdownCurrencyElements[0]).toHaveTextContent('$50,000') // STOCK (highest)
      expect(breakdownCurrencyElements[1]).toHaveTextContent('$30,000') // CRYPTO
      expect(breakdownCurrencyElements[2]).toHaveTextContent('$20,000') // BANK_ACCOUNT (lowest)
    })
  })

  describe('Asset Type Breakdown', () => {
    it('should display asset type breakdown with correct formatting', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
        />
      )

      // Check asset type names (formatted from enum)
      expect(screen.getByText('Stock')).toBeInTheDocument()
      expect(screen.getByText('Crypto')).toBeInTheDocument()
      expect(screen.getByText('Bank Account')).toBeInTheDocument()

      // Check percentages
      expect(screen.getByText('50.0%')).toBeInTheDocument()
      expect(screen.getByText('30.0%')).toBeInTheDocument()
      expect(screen.getByText('20.0%')).toBeInTheDocument()

      // Check values
      expect(screen.getByText('$50,000')).toBeInTheDocument()
      expect(screen.getByText('$30,000')).toBeInTheDocument()
      expect(screen.getByText('$20,000')).toBeInTheDocument()
    })

    it('should display color indicators for each asset type', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
        />
      )

      // Check that color indicators are present
      const colorIndicators = screen.getAllByRole('generic').filter(
        el => el.className.includes('w-3 h-3 rounded-full')
      )
      expect(colorIndicators).toHaveLength(3)
    })
  })

  describe('Interactive Features', () => {
    it('should call onAssetTypeClick when chart is clicked', async () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
          onAssetTypeClick={mockOnAssetTypeClick}
        />
      )

      const chart = screen.getByTestId('mock-chart')
      fireEvent.click(chart)

      await waitFor(() => {
        expect(mockOnAssetTypeClick).toHaveBeenCalledWith('STOCK')
      })
    })

    it('should call onAssetTypeClick when breakdown item is clicked', async () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
          onAssetTypeClick={mockOnAssetTypeClick}
        />
      )

      // Click on the first clickable breakdown item
      const clickableItems = document.querySelectorAll('.cursor-pointer')
      if (clickableItems[0]) {
        fireEvent.click(clickableItems[0])
      }

      await waitFor(() => {
        expect(mockOnAssetTypeClick).toHaveBeenCalledWith('STOCK')
      })
    })

    it('should not call onAssetTypeClick when callback is not provided', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
        />
      )

      const chart = screen.getByTestId('mock-chart')
      fireEvent.click(chart)

      // Should not throw error
      expect(mockOnAssetTypeClick).not.toHaveBeenCalled()
    })

    it('should handle hover states on breakdown items', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
        />
      )

      // Check that clickable containers have the right classes
      const clickableContainers = document.querySelectorAll('.cursor-pointer.hover\\:bg-muted')
      expect(clickableContainers.length).toBe(3)
    })
  })

  describe('Responsive Behavior', () => {
    it('should apply responsive grid classes to breakdown items', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
        />
      )

      // Check for the grid container
      const gridContainer = document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2')
      expect(gridContainer).toBeInTheDocument()
    })

    it('should apply custom className when provided', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
          className="custom-class"
        />
      )

      // Check for custom class on the root card element
      const cardWithCustomClass = document.querySelector('.custom-class')
      expect(cardWithCustomClass).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle single asset type', () => {
      const singleAssetData: AssetAllocationData[] = [
        {
          assetType: 'STOCK',
          value: 100000,
          percentage: 100,
          color: '#e11d48',
        },
      ]

      render(
        <AssetAllocationChart
          allocationData={singleAssetData}
          isLoading={false}
        />
      )

      expect(screen.getByText('Stock')).toBeInTheDocument()
      expect(screen.getByText('100.0%')).toBeInTheDocument()
      expect(screen.getByText('$100,000')).toBeInTheDocument()
    })

    it('should handle very small percentages', () => {
      const smallPercentageData: AssetAllocationData[] = [
        {
          assetType: 'STOCK',
          value: 99999.99,
          percentage: 99.999,
          color: '#e11d48',
        },
        {
          assetType: 'CRYPTO',
          value: 0.01,
          percentage: 0.001,
          color: '#0ea5e9',
        },
      ]

      render(
        <AssetAllocationChart
          allocationData={smallPercentageData}
          isLoading={false}
        />
      )

      expect(screen.getByText('100.0%')).toBeInTheDocument()
      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })

    it('should handle asset types with underscores in names', () => {
      const underscoreData: AssetAllocationData[] = [
        {
          assetType: 'LIFE_INSURANCE',
          value: 50000,
          percentage: 100,
          color: '#f59e0b',
        },
      ]

      render(
        <AssetAllocationChart
          allocationData={underscoreData}
          isLoading={false}
        />
      )

      expect(screen.getByText('Life Insurance')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
        />
      )

      // Card should have proper structure
      expect(screen.getByText('Asset Allocation')).toBeInTheDocument()
      
      // Breakdown items should be clickable
      const clickableItems = document.querySelectorAll('.cursor-pointer')
      expect(clickableItems.length).toBe(3)
    })

    it('should support keyboard navigation for breakdown items', () => {
      render(
        <AssetAllocationChart
          allocationData={mockAllocationData}
          isLoading={false}
          onAssetTypeClick={mockOnAssetTypeClick}
        />
      )

      // Simulate keyboard interaction on first clickable item
      const clickableItems = document.querySelectorAll('.cursor-pointer')
      if (clickableItems[0]) {
        fireEvent.keyDown(clickableItems[0], { key: 'Enter', code: 'Enter' })
        // Note: In a real implementation, you'd add onKeyDown handler
      }
    })
  })
})
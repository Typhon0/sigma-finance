import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PortfolioOverview } from '../portfolio-overview'
import { PortfolioSummaryCards } from '../portfolio-summary-cards'
import { AssetPerformanceComponent } from '../asset-performance'
import { RecentTransactions } from '../recent-transactions'
import { AssetAllocationChart } from '../asset-allocation-chart'
import { AlertsSection } from '../alerts-section'
import { QuickActions } from '../quick-actions'
import { DashboardSkeleton } from '../dashboard-skeleton'

// Mock ResizeObserver for chart components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ECharts for chart components
vi.mock('echarts-for-react', () => ({
  default: ({ option, onEvents }: any) => (
    <div 
      data-testid="echarts-integration" 
      data-option={JSON.stringify(option)}
      onClick={() => onEvents?.click?.({ data: { name: 'Stocks' } })}
    >
      ECharts Integration Mock
    </div>
  )
}))

// Test data for integration tests
const mockPortfolios = [
  {
    id: 'portfolio-1',
    name: 'Growth Portfolio',
    value: 75000,
    change: 1500,
    changePercent: 2.04,
    allocation: 60,
    assets: [
      { id: 'asset-1', name: 'AAPL', symbol: 'AAPL' },
      { id: 'asset-2', name: 'GOOGL', symbol: 'GOOGL' }
    ]
  },
  {
    id: 'portfolio-2',
    name: 'Conservative Portfolio',
    value: 50000,
    change: 1000,
    changePercent: 2.04,
    allocation: 40,
    assets: [
      { id: 'asset-3', name: 'BND', symbol: 'BND' }
    ]
  }
]

const mockPortfolioAllocation = [
  { portfolioId: 'portfolio-1', name: 'Growth Portfolio', percentage: 60 },
  { portfolioId: 'portfolio-2', name: 'Conservative Portfolio', percentage: 40 }
]

const mockTopPerformers = [
  {
    asset: { id: 'asset-1', name: 'Apple Inc.', symbol: 'AAPL' },
    currentValue: 15000,
    changePercent: 5.2,
    changeAmount: 742.50
  },
  {
    asset: { id: 'asset-4', name: 'Microsoft Corp.', symbol: 'MSFT' },
    currentValue: 18000,
    changePercent: 3.8,
    changeAmount: 658.32
  }
]

const mockWorstPerformers = [
  {
    asset: { id: 'asset-2', name: 'Alphabet Inc.', symbol: 'GOOGL' },
    currentValue: 12000,
    changePercent: -2.1,
    changeAmount: -257.14
  },
  {
    asset: { id: 'asset-5', name: 'Tesla Inc.', symbol: 'TSLA' },
    currentValue: 8000,
    changePercent: -4.5,
    changeAmount: -378.95
  }
]

const mockTransactions = [
  {
    id: 'transaction-1',
    transactionType: 'BUY',
    quantity: 10,
    pricePerUnit: 155.00,
    transactionDate: '2024-01-15T10:30:00Z',
    asset: { name: 'Apple Inc.' },
    portfolio: { name: 'Growth Portfolio' }
  },
  {
    id: 'transaction-2',
    transactionType: 'SELL',
    quantity: 5,
    pricePerUnit: 2450.00,
    transactionDate: '2024-01-14T14:20:00Z',
    asset: { name: 'Alphabet Inc.' },
    portfolio: { name: 'Growth Portfolio' }
  }
]

const mockAssetAllocation = [
  { assetType: 'Stocks', value: 100000, percentage: 80, color: '#3b82f6' },
  { assetType: 'Bonds', value: 25000, percentage: 20, color: '#10b981' }
]

const mockAlerts = [
  {
    id: 'alert-1',
    type: 'PRICE_CHANGE',
    message: 'AAPL increased by 5%',
    assetId: 'asset-1',
    portfolioId: 'portfolio-1',
    timestamp: '2024-01-15T09:00:00Z'
  }
]

describe('Dashboard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Integration and Data Flow', () => {
    it('should integrate portfolio overview with performance data', () => {
      render(
        <PortfolioOverview
          totalValue={125000}
          totalChange={2500}
          totalChangePercent={2.04}
          isLoading={false}
        />
      )

      // Verify portfolio overview displays correctly
      expect(screen.getByText('$125,000.00')).toBeInTheDocument()
      expect(screen.getByText('+2.04%')).toBeInTheDocument()
      expect(screen.getByText('+$2,500.00')).toBeInTheDocument()

      // Verify color coding
      const percentageBadge = screen.getByText('+2.04%')
      expect(percentageBadge.closest('.bg-green-500')).toBeInTheDocument()
    })

    it('should integrate portfolio summary cards with allocation data', () => {
      const mockHandlers = {
        onCreatePortfolio: vi.fn(),
        onPortfolioClick: vi.fn(),
        onViewAllPortfolios: vi.fn()
      }

      render(
        <PortfolioSummaryCards
          portfolios={mockPortfolios}
          portfolioAllocation={mockPortfolioAllocation}
          isLoading={false}
          {...mockHandlers}
        />
      )

      // Verify portfolios are displayed
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Conservative Portfolio')).toBeInTheDocument()

      // Test interaction
      fireEvent.click(screen.getByText('Growth Portfolio'))
      expect(mockHandlers.onPortfolioClick).toHaveBeenCalledWith('portfolio-1')
    })

    it('should integrate asset performance components with market data', () => {
      render(
        <AssetPerformanceComponent
          topPerformers={mockTopPerformers}
          worstPerformers={mockWorstPerformers}
          isLoading={false}
        />
      )

      // Verify top performers
      expect(screen.getByText('Top Performers')).toBeInTheDocument()
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
      expect(screen.getByText('Microsoft Corp.')).toBeInTheDocument()

      // Verify worst performers
      expect(screen.getByText('Worst Performers')).toBeInTheDocument()
      expect(screen.getByText('Alphabet Inc.')).toBeInTheDocument()
      expect(screen.getByText('Tesla Inc.')).toBeInTheDocument()

      // Verify performance indicators
      expect(screen.getByText('+5.20%')).toBeInTheDocument()
      expect(screen.getByText('-2.10%')).toBeInTheDocument()
    })

    it('should integrate recent transactions with portfolio data', () => {
      const mockHandlers = {
        onTransactionClick: vi.fn(),
        onViewAllTransactions: vi.fn()
      }

      render(
        <RecentTransactions
          transactions={mockTransactions}
          isLoading={false}
          {...mockHandlers}
        />
      )

      // Verify transactions are displayed
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
      expect(screen.getByText('Alphabet Inc.')).toBeInTheDocument()

      // Verify transaction types
      expect(screen.getByText('BUY')).toBeInTheDocument()
      expect(screen.getByText('SELL')).toBeInTheDocument()

      // Test interaction
      fireEvent.click(screen.getByText('Apple Inc.'))
      expect(mockHandlers.onTransactionClick).toHaveBeenCalledWith('transaction-1')
    })

    it('should integrate asset allocation chart with portfolio data', () => {
      const mockHandler = vi.fn()

      render(
        <AssetAllocationChart
          allocationData={mockAssetAllocation}
          isLoading={false}
          onAssetTypeClick={mockHandler}
        />
      )

      // Verify chart is rendered
      expect(screen.getByTestId('echarts-integration')).toBeInTheDocument()

      // Test chart interaction
      fireEvent.click(screen.getByTestId('echarts-integration'))
      expect(mockHandler).toHaveBeenCalledWith('Stocks')
    })

    it('should integrate alerts section with notification data', () => {
      const mockHandlers = {
        onAlertClick: vi.fn(),
        onViewAllAlerts: vi.fn()
      }

      render(
        <AlertsSection
          alerts={mockAlerts}
          isLoading={false}
          {...mockHandlers}
        />
      )

      // Verify alerts are displayed
      expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument()
      expect(screen.getByText('AAPL increased by 5%')).toBeInTheDocument()

      // Test interaction
      const alertElement = screen.getByText('AAPL increased by 5%')
      fireEvent.click(alertElement)
      expect(mockHandlers.onAlertClick).toHaveBeenCalledWith('alert-1', 'asset-1', 'portfolio-1')
    })

    it('should integrate quick actions with dashboard functionality', () => {
      render(<QuickActions isLoading={false} />)

      // Verify quick actions are displayed
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      expect(screen.getByText('Add Transaction')).toBeInTheDocument()
      expect(screen.getByText('Add Asset')).toBeInTheDocument()
      expect(screen.getByText('Create Portfolio')).toBeInTheDocument()

      // Test button interactions
      const addTransactionButton = screen.getByText('Add Transaction')
      expect(addTransactionButton).toBeInTheDocument()
      fireEvent.click(addTransactionButton)
      // Note: Actual modal/navigation would be tested in full integration
    })
  })

  describe('Loading States Integration', () => {
    it('should show coordinated loading states across components', () => {
      render(
        <div>
          <PortfolioOverview
            totalValue={0}
            totalChange={0}
            totalChangePercent={0}
            isLoading={true}
          />
          <PortfolioSummaryCards
            portfolios={[]}
            portfolioAllocation={[]}
            isLoading={true}
            onCreatePortfolio={() => {}}
            onPortfolioClick={() => {}}
            onViewAllPortfolios={() => {}}
          />
          <AssetPerformanceComponent
            topPerformers={[]}
            worstPerformers={[]}
            isLoading={true}
          />
        </div>
      )

      // All components should show loading states
      expect(screen.queryByText('$125,000.00')).not.toBeInTheDocument()
      expect(screen.queryByText('Growth Portfolio')).not.toBeInTheDocument()
      expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument()
    })

    it('should show dashboard skeleton for full page loading', () => {
      render(<DashboardSkeleton />)

      // Verify skeleton is displayed
      expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument()
      
      // Should show skeleton placeholders for all sections
      const skeletonElements = screen.getAllByTestId(/skeleton/)
      expect(skeletonElements.length).toBeGreaterThan(5)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle partial data loading gracefully', () => {
      render(
        <div>
          <PortfolioOverview
            totalValue={125000}
            totalChange={2500}
            totalChangePercent={2.04}
            isLoading={false}
          />
          <PortfolioSummaryCards
            portfolios={[]} // Empty due to error
            portfolioAllocation={[]}
            isLoading={false}
            onCreatePortfolio={() => {}}
            onPortfolioClick={() => {}}
            onViewAllPortfolios={() => {}}
          />
        </div>
      )

      // Portfolio overview should still work
      expect(screen.getByText('$125,000.00')).toBeInTheDocument()
      
      // Portfolio cards should show empty state
      expect(screen.getByText('No portfolios found')).toBeInTheDocument()
    })

    it('should handle empty data states across components', () => {
      render(
        <div>
          <AssetPerformanceComponent
            topPerformers={[]}
            worstPerformers={[]}
            isLoading={false}
          />
          <RecentTransactions
            transactions={[]}
            isLoading={false}
            onTransactionClick={() => {}}
            onViewAllTransactions={() => {}}
          />
          <AlertsSection
            alerts={[]}
            isLoading={false}
            onAlertClick={() => {}}
            onViewAllAlerts={() => {}}
          />
        </div>
      )

      // Should show appropriate empty states
      expect(screen.getByText('No recent performance data')).toBeInTheDocument()
      expect(screen.getByText('No recent transactions')).toBeInTheDocument()
      expect(screen.getByText('No active alerts')).toBeInTheDocument()
    })
  })

  describe('Performance with Large Datasets', () => {
    it('should handle large portfolio datasets efficiently', () => {
      const largePortfolioSet = Array.from({ length: 50 }, (_, i) => ({
        id: `portfolio-${i + 1}`,
        name: `Portfolio ${i + 1}`,
        value: 75000 + i * 1000,
        change: 1500 + i * 100,
        changePercent: 2.04 + i * 0.1,
        allocation: 60 - i * 0.5,
        assets: [
          { id: `asset-${i}-1`, name: `Asset ${i}-1`, symbol: `SYM${i}1` }
        ]
      }))

      const startTime = performance.now()
      
      render(
        <PortfolioSummaryCards
          portfolios={largePortfolioSet}
          portfolioAllocation={[]}
          isLoading={false}
          onCreatePortfolio={() => {}}
          onPortfolioClick={() => {}}
          onViewAllPortfolios={() => {}}
        />
      )

      const endTime = performance.now()
      
      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(1000) // 1 second

      // Should limit displayed items for performance
      const portfolioElements = screen.getAllByText(/Portfolio \d+/)
      expect(portfolioElements.length).toBeLessThanOrEqual(10)
    })

    it('should handle large transaction datasets efficiently', () => {
      const largeTransactionSet = Array.from({ length: 100 }, (_, i) => ({
        id: `transaction-${i + 1}`,
        transactionType: i % 2 === 0 ? 'BUY' : 'SELL',
        quantity: 10 + i,
        pricePerUnit: 155.00 + i * 2,
        transactionDate: new Date(Date.now() - i * 86400000).toISOString(),
        asset: { name: `Asset ${i}` },
        portfolio: { name: `Portfolio ${i % 5}` }
      }))

      const startTime = performance.now()
      
      render(
        <RecentTransactions
          transactions={largeTransactionSet}
          isLoading={false}
          onTransactionClick={() => {}}
          onViewAllTransactions={() => {}}
        />
      )

      const endTime = performance.now()
      
      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(500) // 500ms

      // Should only show recent transactions (limited)
      const transactionElements = screen.getAllByText(/Asset \d+/)
      expect(transactionElements.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Responsive Behavior Integration', () => {
    it('should coordinate responsive behavior across components', () => {
      // Mock different screen sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320, // Mobile size
      })

      render(
        <div>
          <PortfolioOverview
            totalValue={125000}
            totalChange={2500}
            totalChangePercent={2.04}
            isLoading={false}
          />
          <QuickActions isLoading={false} />
        </div>
      )

      // Components should adapt to mobile layout
      const portfolioValue = screen.getByText('$125,000.00')
      expect(portfolioValue).toHaveClass('text-3xl') // Mobile text size

      // Quick actions should be stacked on mobile
      const quickActionsContainer = screen.getByText('Add Transaction').closest('div')
      expect(quickActionsContainer).toBeInTheDocument()
    })
  })
})
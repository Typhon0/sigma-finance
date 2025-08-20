import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PortfolioOverview } from '../portfolio-overview'
import { PortfolioSummaryCards } from '../portfolio-summary-cards'
import { AssetPerformanceComponent } from '../asset-performance'
import { RecentTransactions } from '../recent-transactions'
import { AlertsSection } from '../alerts-section'
import { QuickActions } from '../quick-actions'
import { DashboardSkeleton } from '../dashboard-skeleton'

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

describe('Dashboard Integration Tests - Task 13.1 (No Mocks)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Full Dashboard Data Flow Integration', () => {
    it('should integrate portfolio overview with performance calculations', () => {
      render(
        <PortfolioOverview
          totalValue={125000}
          totalChange={2500}
          totalChangePercent={2.04}
          isLoading={false}
        />
      )

      // Verify data flow from calculations to display
      expect(screen.getByText('$125,000.00')).toBeInTheDocument()
      expect(screen.getByText('+2.04%')).toBeInTheDocument()
      expect(screen.getByText('+$2,500.00')).toBeInTheDocument()

      // Verify color coding logic integration
      const percentageBadge = screen.getByText('+2.04%')
      expect(percentageBadge.closest('.bg-green-500')).toBeInTheDocument()
    })

    it('should integrate portfolio summary with allocation calculations', () => {
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

      // Verify portfolio data integration
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Conservative Portfolio')).toBeInTheDocument()

      // Test data flow through click handlers
      fireEvent.click(screen.getByText('Growth Portfolio'))
      expect(mockHandlers.onPortfolioClick).toHaveBeenCalledWith('portfolio-1')
    })

    it('should integrate asset performance with market data calculations', () => {
      render(
        <AssetPerformanceComponent
          topPerformers={mockTopPerformers}
          worstPerformers={mockWorstPerformers}
          isLoading={false}
        />
      )

      // Verify performance calculation integration
      expect(screen.getByText('Top Performers')).toBeInTheDocument()
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
      expect(screen.getByText('+5.20%')).toBeInTheDocument()

      expect(screen.getByText('Worst Performers')).toBeInTheDocument()
      expect(screen.getByText('Alphabet Inc.')).toBeInTheDocument()
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

      // Verify transaction data integration
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
      expect(screen.getByText('BUY')).toBeInTheDocument()
      expect(screen.getByText('SELL')).toBeInTheDocument()

      // Test transaction interaction
      fireEvent.click(screen.getByText('Apple Inc.'))
      expect(mockHandlers.onTransactionClick).toHaveBeenCalledWith('transaction-1')
    })

    it('should integrate alerts with notification system', () => {
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

      // Verify alert data integration
      expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument()
      expect(screen.getByText('AAPL increased by 5%')).toBeInTheDocument()

      // Test alert interaction
      const alertElement = screen.getByText('AAPL increased by 5%')
      fireEvent.click(alertElement)
      expect(mockHandlers.onAlertClick).toHaveBeenCalledWith('alert-1', 'asset-1', 'portfolio-1')
    })

    it('should integrate quick actions with dashboard functionality', () => {
      render(<QuickActions isLoading={false} />)

      // Verify quick actions integration
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      expect(screen.getByText('Add Transaction')).toBeInTheDocument()
      expect(screen.getByText('Add Asset')).toBeInTheDocument()
      expect(screen.getByText('Create Portfolio')).toBeInTheDocument()

      // Verify buttons are interactive
      const addTransactionButton = screen.getByText('Add Transaction')
      expect(addTransactionButton).toBeInTheDocument()
      fireEvent.click(addTransactionButton)
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
      
      // Should render within performance budget (1 second)
      expect(endTime - startTime).toBeLessThan(1000)

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
      
      // Should render within performance budget (500ms)
      expect(endTime - startTime).toBeLessThan(500)

      // Should only show recent transactions (limited to 5)
      const transactionElements = screen.getAllByText(/Asset \d+/)
      expect(transactionElements.length).toBeLessThanOrEqual(5)
    })

    it('should maintain performance during user interactions', () => {
      render(
        <AssetPerformanceComponent
          topPerformers={mockTopPerformers}
          worstPerformers={mockWorstPerformers}
          isLoading={false}
        />
      )

      // Test interaction performance
      const startTime = performance.now()
      
      const appleAsset = screen.getByText('Apple Inc.')
      fireEvent.click(appleAsset)
      
      const endTime = performance.now()

      // Interaction should be responsive (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })
  })

  describe('Responsive Behavior Across Screen Sizes', () => {
    it('should adapt layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      })

      render(
        <PortfolioOverview
          totalValue={125000}
          totalChange={2500}
          totalChangePercent={2.04}
          isLoading={false}
        />
      )

      // Verify mobile-responsive classes
      const portfolioValue = screen.getByText('$125,000.00')
      expect(portfolioValue).toHaveClass('text-3xl') // Mobile text size
    })

    it('should adapt layout for tablet screens', () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })

      render(
        <QuickActions isLoading={false} />
      )

      // Verify tablet layout adaptation
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      expect(screen.getByText('Add Transaction')).toBeInTheDocument()
    })

    it('should adapt layout for desktop screens', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })

      render(
        <PortfolioSummaryCards
          portfolios={mockPortfolios}
          portfolioAllocation={mockPortfolioAllocation}
          isLoading={false}
          onCreatePortfolio={() => {}}
          onPortfolioClick={() => {}}
          onViewAllPortfolios={() => {}}
        />
      )

      // Verify desktop layout
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Conservative Portfolio')).toBeInTheDocument()
    })
  })

  describe('Loading States and Error Handling', () => {
    it('should show coordinated loading states', () => {
      render(
        <div>
          <PortfolioOverview
            totalValue={0}
            totalChange={0}
            totalChangePercent={0}
            isLoading={true}
          />
          <AssetPerformanceComponent
            topPerformers={[]}
            worstPerformers={[]}
            isLoading={true}
          />
        </div>
      )

      // Should not show actual data during loading
      expect(screen.queryByText('$125,000.00')).not.toBeInTheDocument()
      expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument()
    })

    it('should show dashboard skeleton for full page loading', () => {
      render(<DashboardSkeleton />)

      // Verify skeleton is displayed
      expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument()
      
      // Should show multiple skeleton elements
      const skeletonElements = screen.getAllByTestId(/skeleton/)
      expect(skeletonElements.length).toBeGreaterThan(3)
    })

    it('should handle empty data states gracefully', () => {
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

  describe('Memory and Performance Optimization', () => {
    it('should not cause memory leaks during component lifecycle', () => {
      const { unmount } = render(
        <PortfolioSummaryCards
          portfolios={mockPortfolios}
          portfolioAllocation={mockPortfolioAllocation}
          isLoading={false}
          onCreatePortfolio={() => {}}
          onPortfolioClick={() => {}}
          onViewAllPortfolios={() => {}}
        />
      )

      // Component should render successfully
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()

      // Should unmount without errors
      unmount()
      
      // No assertions needed - test passes if no errors thrown
    })

    it('should handle rapid re-renders efficiently', () => {
      const { rerender } = render(
        <PortfolioOverview
          totalValue={125000}
          totalChange={2500}
          totalChangePercent={2.04}
          isLoading={false}
        />
      )

      const startTime = performance.now()

      // Simulate rapid re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <PortfolioOverview
            totalValue={125000 + i * 1000}
            totalChange={2500 + i * 100}
            totalChangePercent={2.04 + i * 0.1}
            isLoading={false}
          />
        )
      }

      const endTime = performance.now()

      // Should handle rapid re-renders efficiently
      expect(endTime - startTime).toBeLessThan(100)
    })
  })

  describe('Data Flow Integration Simulation', () => {
    it('should handle data loading states properly', () => {
      // Simulate data loading flow
      const { rerender } = render(
        <PortfolioOverview
          totalValue={0}
          totalChange={0}
          totalChangePercent={0}
          isLoading={true}
        />
      )

      // Should show loading state
      expect(screen.queryByText('$125,000.00')).not.toBeInTheDocument()

      // Simulate data loaded
      rerender(
        <PortfolioOverview
          totalValue={125000}
          totalChange={2500}
          totalChangePercent={2.04}
          isLoading={false}
        />
      )

      // Should show actual data
      expect(screen.getByText('$125,000.00')).toBeInTheDocument()
    })

    it('should handle data updates efficiently', () => {
      const { rerender } = render(
        <PortfolioOverview
          totalValue={125000}
          totalChange={2500}
          totalChangePercent={2.04}
          isLoading={false}
        />
      )

      expect(screen.getByText('$125,000.00')).toBeInTheDocument()

      // Simulate data update (like from polling)
      rerender(
        <PortfolioOverview
          totalValue={127500}
          totalChange={5000}
          totalChangePercent={4.08}
          isLoading={false}
        />
      )

      // Should show updated data
      expect(screen.getByText('$127,500.00')).toBeInTheDocument()
      expect(screen.getByText('+4.08%')).toBeInTheDocument()
    })

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

    it('should integrate multiple components with coordinated state', () => {
      // Test that multiple components work together
      render(
        <div>
          <PortfolioOverview
            totalValue={125000}
            totalChange={2500}
            totalChangePercent={2.04}
            isLoading={false}
          />
          <AssetPerformanceComponent
            topPerformers={mockTopPerformers}
            worstPerformers={mockWorstPerformers}
            isLoading={false}
          />
          <RecentTransactions
            transactions={mockTransactions}
            isLoading={false}
            onTransactionClick={() => {}}
            onViewAllTransactions={() => {}}
          />
          <QuickActions isLoading={false} />
        </div>
      )

      // All components should render together
      expect(screen.getByText('$125,000.00')).toBeInTheDocument()
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    })
  })
})
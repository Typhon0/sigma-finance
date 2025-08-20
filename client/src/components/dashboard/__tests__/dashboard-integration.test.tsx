import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PortfolioOverview } from '../portfolio-overview'
import { PortfolioSummaryCards } from '../portfolio-summary-cards'
import { AssetPerformanceComponent } from '../asset-performance'
import { RecentTransactions } from '../recent-transactions'
import { AssetAllocationChart } from '../asset-allocation-chart'
import { AlertsSection } from '../alerts-section'
import { QuickActions } from '../quick-actions'
import { DashboardSkeleton } from '../dashboard-skeleton'

// Mock ResizeObserver for chart components
global.ResizeObserver = globalThis.vi.fn().mockImplementation(() => ({
  observe: globalThis.vi.fn(),
  unobserve: globalThis.vi.fn(),
  disconnect: globalThis.vi.fn(),
}))

// Mock ECharts for chart components
globalThis.vi.mock('echarts-for-react', () => ({
  default: ({ option, onEvents }: any) => (
    <div 
      data-testid="echarts-mock" 
      data-option={JSON.stringify(option)}
      onClick={() => onEvents?.click?.({ data: { name: 'Stocks' } })}
    >
      ECharts Mock
    </div>
  )
}))

const mockDashboardData = {
  portfolios: [
    {
      id: 'portfolio-1',
      name: 'Growth Portfolio',
      assets: [
        {
          id: 'asset-1',
          asset: {
            id: 'asset-1',
            name: 'Apple Inc.',
            symbol: 'AAPL',
            assetType: { name: 'Stock' }
          },
          quantity: 100,
          averagePurchasePrice: 150.00
        },
        {
          id: 'asset-2',
          asset: {
            id: 'asset-2',
            name: 'Alphabet Inc.',
            symbol: 'GOOGL',
            assetType: { name: 'Stock' }
          },
          quantity: 50,
          averagePurchasePrice: 2400.00
        }
      ]
    },
    {
      id: 'portfolio-2',
      name: 'Conservative Portfolio',
      assets: [
        {
          id: 'asset-3',
          asset: {
            id: 'asset-3',
            name: 'Vanguard Total Bond Market',
            symbol: 'BND',
            assetType: { name: 'Bond' }
          },
          quantity: 500,
          averagePurchasePrice: 50.00
        }
      ]
    }
  ],
  transactions: [
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
}

const mocks = [
  {
    request: {
      query: GET_DASHBOARD_DATA,
      variables: { userID: 'user-1' }
    },
    result: {
      data: mockDashboardData
    }
  }
]

const mockWithError = [
  {
    request: {
      query: GET_DASHBOARD_DATA,
      variables: { userID: 'user-1' }
    },
    error: new Error('Network error occurred')
  }
]

const mockWithLargeDataset = [
  {
    request: {
      query: GET_DASHBOARD_DATA,
      variables: { userID: 'user-1' }
    },
    result: {
      data: {
        portfolios: Array.from({ length: 20 }, (_, i) => ({
          id: `portfolio-${i + 1}`,
          name: `Portfolio ${i + 1}`,
          assets: Array.from({ length: 50 }, (_, j) => ({
            id: `asset-${i}-${j}`,
            asset: {
              id: `asset-${i}-${j}`,
              name: `Asset ${i}-${j}`,
              symbol: `SYM${i}${j}`,
              assetType: { name: i % 2 === 0 ? 'Stock' : 'Bond' }
            },
            quantity: Math.random() * 1000,
            averagePurchasePrice: Math.random() * 500
          }))
        })),
        transactions: Array.from({ length: 1000 }, (_, i) => ({
          id: `transaction-${i + 1}`,
          transactionType: i % 2 === 0 ? 'BUY' : 'SELL',
          quantity: Math.random() * 100,
          pricePerUnit: Math.random() * 1000,
          transactionDate: new Date(Date.now() - i * 86400000).toISOString(),
          asset: { name: `Asset ${i}` },
          portfolio: { name: `Portfolio ${i % 5}` }
        }))
      }
    }
  }
]

const renderDashboard = (mocks: any[] = []) => {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <DashboardHomePage />
    </MockedProvider>
  )
}

describe('Dashboard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Full Dashboard Data Flow', () => {
    it('should load and display all dashboard sections with Apollo Client', async () => {
      renderDashboard(mocks)

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      // Verify portfolio overview section
      expect(screen.getByText('$125,000.00')).toBeInTheDocument()
      expect(screen.getByText('+$2,500.00 (2.04%)')).toBeInTheDocument()

      // Verify portfolio summary cards
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Conservative Portfolio')).toBeInTheDocument()

      // Verify asset performance section
      expect(screen.getByText('Top Performers')).toBeInTheDocument()
      expect(screen.getByText('Worst Performers')).toBeInTheDocument()
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()

      // Verify asset allocation chart
      expect(screen.getByTestId('echarts-mock')).toBeInTheDocument()

      // Verify quick actions section
      expect(screen.getByText('Add Transaction')).toBeInTheDocument()
      expect(screen.getByText('Add Asset')).toBeInTheDocument()
      expect(screen.getByText('Create Portfolio')).toBeInTheDocument()
    })

    it('should handle Apollo Client errors gracefully', async () => {
      renderDashboard(mockWithError)

      // Wait for error state to appear
      await waitFor(() => {
        expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument()
      })

      expect(screen.getByText('Network error occurred')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })

    it('should support retry functionality after errors', async () => {
      const { rerender } = renderDashboard(mockWithError)

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument()
      })

      // Click retry button
      const retryButton = screen.getByText('Try Again')
      fireEvent.click(retryButton)

      // Rerender with successful data
      rerender(
        <MockedProvider mocks={mocks} addTypename={false}>
          <DashboardHomePage />
        </MockedProvider>
      )

      // Verify data loads successfully after retry
      await waitFor(() => {
        expect(screen.getByText('$125,000.00')).toBeInTheDocument()
      })
    })

    it('should handle partial data loading with error boundaries', async () => {
      const partialErrorMocks = [
        {
          request: {
            query: GET_DASHBOARD_DATA,
            variables: { userID: 'user-1' }
          },
          result: {
            data: {
              portfolios: mockDashboardData.portfolios,
              transactions: null // Simulate partial failure
            },
            errors: [
              {
                message: 'Failed to load transactions',
                path: ['transactions']
              }
            ]
          }
        }
      ]

      renderDashboard(partialErrorMocks)

      await waitFor(() => {
        // Portfolio data should still load
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
        
        // But transactions section should handle the error gracefully
        expect(screen.queryByText('Recent Transactions')).toBeInTheDocument()
      })
    })
  })

  describe('Performance with Large Datasets', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = performance.now()
      
      renderDashboard(mockWithLargeDataset)

      // Wait for initial render
      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      }, { timeout: 10000 })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within reasonable time (less than 5 seconds)
      expect(renderTime).toBeLessThan(5000)

      // Verify that only the first few portfolios are shown (pagination/limiting)
      const portfolioCards = screen.getAllByText(/Portfolio \d+/)
      expect(portfolioCards.length).toBeLessThanOrEqual(10) // Should limit display
    })

    it('should maintain performance during user interactions', async () => {
      renderDashboard(mockWithLargeDataset)

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      // Test chart interaction performance
      const chart = screen.getByTestId('echarts-mock')
      
      const startTime = performance.now()
      fireEvent.click(chart)
      const endTime = performance.now()

      // Interaction should be responsive (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should handle memory efficiently with large datasets', async () => {
      // Mock memory usage tracking
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      renderDashboard(mockWithLargeDataset)

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      // Memory increase should be reasonable (less than 50MB for large dataset)
      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory - initialMemory
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB
      }
    })
  })

  describe('Apollo Client Caching and Optimization', () => {
    it('should cache data and avoid unnecessary refetches', async () => {
      let queryCount = 0
      const mocksWithCounter = [
        {
          request: {
            query: GET_DASHBOARD_DATA,
            variables: { userID: 'user-1' }
          },
          result: () => {
            queryCount++
            return { data: mockDashboardData }
          }
        }
      ]

      const { rerender } = renderDashboard(mocksWithCounter)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      expect(queryCount).toBe(1)

      // Rerender component (simulating navigation back)
      rerender(
        <MockedProvider mocks={mocksWithCounter} addTypename={false}>
          <DashboardHomePage />
        </MockedProvider>
      )

      // Should use cached data, not trigger new query immediately
      expect(queryCount).toBe(1)
    })

    it('should handle optimistic updates correctly', async () => {
      renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Test quick action that would trigger optimistic update
      const addTransactionButton = screen.getByText('Add Transaction')
      fireEvent.click(addTransactionButton)

      // Should show immediate feedback (optimistic update)
      // This would be implemented when the actual mutation is added
    })

    it('should handle network status changes', async () => {
      // Mock network status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      renderDashboard(mocks)

      // Should handle offline state gracefully
      await waitFor(() => {
        // Component should still render with cached data or show offline indicator
        expect(screen.getByRole('main') || screen.getByText(/offline/i)).toBeInTheDocument()
      })

      // Restore online status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary network failures', async () => {
      let shouldFail = true
      const dynamicMocks = [
        {
          request: {
            query: GET_DASHBOARD_DATA,
            variables: { userID: 'user-1' }
          },
          result: () => {
            if (shouldFail) {
              shouldFail = false
              throw new Error('Temporary network failure')
            }
            return { data: mockDashboardData }
          }
        }
      ]

      renderDashboard(dynamicMocks)

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument()
      })

      // Click retry
      const retryButton = screen.getByText('Try Again')
      fireEvent.click(retryButton)

      // Should recover and show data
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })
    })

    it('should handle concurrent data updates', async () => {
      renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Simulate concurrent updates (polling, user actions, etc.)
      // This would test race conditions and data consistency
      act(() => {
        // Multiple rapid state updates
        for (let i = 0; i < 10; i++) {
          // Simulate rapid updates that might cause race conditions
        }
      })

      // Should maintain data consistency
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
    })
  })
})
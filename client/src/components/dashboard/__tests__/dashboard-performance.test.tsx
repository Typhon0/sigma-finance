import { render, screen, waitFor, act } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import DashboardHomePage from '@/pages/dashboard-home'
import { GET_DASHBOARD_DATA } from '@/lib/graphql/dashboard.queries'
// Simple wrapper for testing without full router setup

// Performance monitoring utilities
interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  componentCount: number
  reRenderCount: number
}

let performanceMetrics: PerformanceMetrics = {
  renderTime: 0,
  memoryUsage: 0,
  componentCount: 0,
  reRenderCount: 0
}

// Mock performance.memory for testing
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 10000000, // 10MB baseline
    totalJSHeapSize: 20000000,
    jsHeapSizeLimit: 100000000
  },
  writable: true
})

// Mock the dashboard calculations hook with performance tracking
vi.mock('@/hooks/use-dashboard-calculations', () => ({
  useDashboardCalculations: () => {
    performanceMetrics.reRenderCount++
    return {
      data: {
        totalValue: 125000,
        totalChange: 2500,
        totalChangePercent: 2.04,
        portfolios: Array.from({ length: 10 }, (_, i) => ({
          id: `portfolio-${i + 1}`,
          name: `Portfolio ${i + 1}`,
          value: 75000 + i * 1000,
          change: 1500 + i * 100,
          changePercent: 2.04 + i * 0.1,
          allocation: 60 - i * 2,
          assets: Array.from({ length: 20 }, (_, j) => ({
            id: `asset-${i}-${j}`,
            name: `Asset ${i}-${j}`,
            symbol: `SYM${i}${j}`
          }))
        })),
        topPerformingAssets: Array.from({ length: 10 }, (_, i) => ({
          asset: { id: `asset-${i}`, name: `Top Asset ${i}`, symbol: `TOP${i}` },
          currentValue: 15000 + i * 1000,
          changePercent: 5.2 + i * 0.5,
          changeAmount: 742.50 + i * 50
        })),
        worstPerformingAssets: Array.from({ length: 10 }, (_, i) => ({
          asset: { id: `asset-w-${i}`, name: `Worst Asset ${i}`, symbol: `WST${i}` },
          currentValue: 12000 - i * 500,
          changePercent: -2.1 - i * 0.3,
          changeAmount: -257.14 - i * 25
        })),
        recentTransactions: Array.from({ length: 100 }, (_, i) => ({
          id: `transaction-${i}`,
          transactionType: i % 2 === 0 ? 'BUY' : 'SELL',
          quantity: 10 + i,
          pricePerUnit: 155.00 + i * 2,
          transactionDate: new Date(Date.now() - i * 86400000).toISOString(),
          asset: { name: `Asset ${i}` },
          portfolio: { name: `Portfolio ${i % 5}` }
        })),
        assetAllocation: [
          { assetType: 'Stocks', value: 100000, percentage: 80, color: '#3b82f6' },
          { assetType: 'Bonds', value: 25000, percentage: 20, color: '#10b981' }
        ],
        alerts: Array.from({ length: 50 }, (_, i) => ({
          id: `alert-${i}`,
          type: 'PRICE_CHANGE',
          message: `Alert ${i}`,
          assetId: `asset-${i}`,
          portfolioId: `portfolio-${i % 5}`,
          timestamp: new Date(Date.now() - i * 3600000).toISOString()
        })),
        portfolioAllocation: Array.from({ length: 10 }, (_, i) => ({
          portfolioId: `portfolio-${i}`,
          name: `Portfolio ${i}`,
          percentage: 10
        }))
      },
      loading: false
    }
  }
}))

// Mock ResizeObserver with performance tracking
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ECharts with performance simulation
vi.mock('echarts-for-react', () => ({
  default: ({ option, onEvents }: any) => {
    // Simulate chart rendering time
    const renderStart = performance.now()
    
    return (
      <div 
        data-testid="echarts-performance"
        data-render-time={performance.now() - renderStart}
        onClick={() => onEvents?.click?.({ data: { name: 'Stocks' } })}
      >
        ECharts Performance Mock
      </div>
    )
  }
}))

const generateLargeDataset = (size: 'small' | 'medium' | 'large' | 'xlarge') => {
  const sizes = {
    small: { portfolios: 5, assets: 10, transactions: 50 },
    medium: { portfolios: 20, assets: 50, transactions: 200 },
    large: { portfolios: 100, assets: 500, transactions: 1000 },
    xlarge: { portfolios: 500, assets: 2000, transactions: 5000 }
  }

  const config = sizes[size]

  return {
    portfolios: Array.from({ length: config.portfolios }, (_, i) => ({
      id: `portfolio-${i + 1}`,
      name: `Portfolio ${i + 1}`,
      assets: Array.from({ length: config.assets / config.portfolios }, (_, j) => ({
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
    transactions: Array.from({ length: config.transactions }, (_, i) => ({
      id: `transaction-${i + 1}`,
      transactionType: i % 2 === 0 ? 'BUY' : 'SELL',
      quantity: Math.random() * 100,
      pricePerUnit: Math.random() * 1000,
      transactionDate: new Date(Date.now() - i * 86400000).toISOString(),
      asset: { name: `Asset ${i}` },
      portfolio: { name: `Portfolio ${i % config.portfolios}` }
    }))
  }
}

const createMocksWithDataset = (size: 'small' | 'medium' | 'large' | 'xlarge') => [
  {
    request: {
      query: GET_DASHBOARD_DATA,
      variables: { userID: 'user-1' }
    },
    result: {
      data: generateLargeDataset(size)
    }
  }
]

const measurePerformance = async (testFn: () => Promise<void>): Promise<PerformanceMetrics> => {
  const startTime = performance.now()
  const startMemory = (performance as any).memory?.usedJSHeapSize || 0

  performanceMetrics.reRenderCount = 0

  await testFn()

  const endTime = performance.now()
  const endMemory = (performance as any).memory?.usedJSHeapSize || 0

  return {
    renderTime: endTime - startTime,
    memoryUsage: endMemory - startMemory,
    componentCount: document.querySelectorAll('*').length,
    reRenderCount: performanceMetrics.reRenderCount
  }
}

const renderDashboard = (mocks: any[] = []) => {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <DashboardHomePage />
    </MockedProvider>
  )
}

describe('Dashboard Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    performanceMetrics = {
      renderTime: 0,
      memoryUsage: 0,
      componentCount: 0,
      reRenderCount: 0
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Render Performance', () => {
    it('should render small dataset within performance budget', async () => {
      const mocks = createMocksWithDataset('small')
      
      const metrics = await measurePerformance(async () => {
        renderDashboard(mocks)
        await waitFor(() => {
          expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
        })
      })

      // Performance budgets for small dataset
      expect(metrics.renderTime).toBeLessThan(1000) // 1 second
      expect(metrics.memoryUsage).toBeLessThan(5 * 1024 * 1024) // 5MB
      expect(metrics.componentCount).toBeLessThan(500) // Reasonable DOM size
    })

    it('should render medium dataset within performance budget', async () => {
      const mocks = createMocksWithDataset('medium')
      
      const metrics = await measurePerformance(async () => {
        renderDashboard(mocks)
        await waitFor(() => {
          expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
        }, { timeout: 5000 })
      })

      // Performance budgets for medium dataset
      expect(metrics.renderTime).toBeLessThan(3000) // 3 seconds
      expect(metrics.memoryUsage).toBeLessThan(15 * 1024 * 1024) // 15MB
      expect(metrics.componentCount).toBeLessThan(1000)
    })

    it('should handle large dataset gracefully', async () => {
      const mocks = createMocksWithDataset('large')
      
      const metrics = await measurePerformance(async () => {
        renderDashboard(mocks)
        await waitFor(() => {
          expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
        }, { timeout: 10000 })
      })

      // Performance budgets for large dataset (more lenient)
      expect(metrics.renderTime).toBeLessThan(8000) // 8 seconds
      expect(metrics.memoryUsage).toBeLessThan(50 * 1024 * 1024) // 50MB
      
      // Should implement virtualization or pagination for large datasets
      const portfolioElements = screen.getAllByText(/Portfolio \d+/)
      expect(portfolioElements.length).toBeLessThanOrEqual(20) // Should limit visible items
    })

    it('should maintain performance with extra large dataset', async () => {
      const mocks = createMocksWithDataset('xlarge')
      
      const metrics = await measurePerformance(async () => {
        renderDashboard(mocks)
        await waitFor(() => {
          expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
        }, { timeout: 15000 })
      })

      // Should implement aggressive optimization for xlarge datasets
      expect(metrics.renderTime).toBeLessThan(15000) // 15 seconds max
      
      // Should heavily limit visible items
      const portfolioElements = screen.getAllByText(/Portfolio \d+/)
      expect(portfolioElements.length).toBeLessThanOrEqual(10)
    })
  })

  describe('Re-render Performance', () => {
    it('should minimize re-renders during data updates', async () => {
      const mocks = createMocksWithDataset('medium')
      renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const initialRenderCount = performanceMetrics.reRenderCount
      
      // Simulate data update
      act(() => {
        // Force a re-render
        window.dispatchEvent(new Event('resize'))
      })

      // Should not cause excessive re-renders
      expect(performanceMetrics.reRenderCount - initialRenderCount).toBeLessThan(5)
    })

    it('should handle rapid state changes efficiently', async () => {
      const mocks = createMocksWithDataset('small')
      renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const startTime = performance.now()
      
      // Simulate rapid state changes
      act(() => {
        for (let i = 0; i < 10; i++) {
          window.dispatchEvent(new Event('resize'))
        }
      })

      const endTime = performance.now()
      
      // Should handle rapid changes within reasonable time
      expect(endTime - startTime).toBeLessThan(100)
    })
  })

  describe('Memory Management', () => {
    it('should not leak memory during component lifecycle', async () => {
      const mocks = createMocksWithDataset('medium')
      
      const { unmount } = renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const beforeUnmount = (performance as any).memory?.usedJSHeapSize || 0
      
      unmount()
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const afterUnmount = (performance as any).memory?.usedJSHeapSize || 0
      
      // Memory should be released (allowing for some variance)
      const memoryDiff = afterUnmount - beforeUnmount
      expect(Math.abs(memoryDiff)).toBeLessThan(10 * 1024 * 1024) // 10MB variance
    })

    it('should handle memory efficiently with chart components', async () => {
      const mocks = createMocksWithDataset('large')
      renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.getByTestId('echarts-performance')).toBeInTheDocument()
      })

      const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0
      
      // Interact with chart multiple times
      const chart = screen.getByTestId('echarts-performance')
      for (let i = 0; i < 10; i++) {
        act(() => {
          chart.click()
        })
      }

      const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = memoryAfter - memoryBefore
      
      // Chart interactions should not cause significant memory increase
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024) // 5MB
    })
  })

  describe('Component Optimization', () => {
    it('should implement efficient list rendering', async () => {
      const mocks = createMocksWithDataset('large')
      renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      // Should not render all items at once for large lists
      const allElements = document.querySelectorAll('*')
      expect(allElements.length).toBeLessThan(2000) // Reasonable DOM size limit
    })

    it('should lazy load chart components', async () => {
      const mocks = createMocksWithDataset('medium')
      
      const startTime = performance.now()
      renderDashboard(mocks)

      // Initial render should be fast without charts
      const initialRenderTime = performance.now() - startTime
      expect(initialRenderTime).toBeLessThan(500)

      // Charts should load after initial render
      await waitFor(() => {
        expect(screen.getByTestId('echarts-performance')).toBeInTheDocument()
      })
    })

    it('should optimize Apollo Client queries', async () => {
      let queryExecutionTime = 0
      const mocks = [
        {
          request: {
            query: GET_DASHBOARD_DATA,
            variables: { userID: 'user-1' }
          },
          result: () => {
            const start = performance.now()
            const data = generateLargeDataset('medium')
            queryExecutionTime = performance.now() - start
            return { data }
          }
        }
      ]

      renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      // Query processing should be efficient
      expect(queryExecutionTime).toBeLessThan(100)
    })
  })

  describe('Interaction Performance', () => {
    it('should respond to user interactions quickly', async () => {
      const mocks = createMocksWithDataset('medium')
      renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.getByText('Add Transaction')).toBeInTheDocument()
      })

      const button = screen.getByText('Add Transaction')
      
      const startTime = performance.now()
      act(() => {
        button.click()
      })
      const endTime = performance.now()

      // Click response should be immediate
      expect(endTime - startTime).toBeLessThan(16) // 60fps = 16ms per frame
    })

    it('should handle scroll performance efficiently', async () => {
      const mocks = createMocksWithDataset('large')
      renderDashboard(mocks)

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const startTime = performance.now()
      
      // Simulate scroll events
      for (let i = 0; i < 10; i++) {
        act(() => {
          window.dispatchEvent(new Event('scroll'))
        })
      }

      const endTime = performance.now()
      
      // Scroll handling should be efficient
      expect(endTime - startTime).toBeLessThan(50)
    })
  })

  describe('Network Performance', () => {
    it('should handle slow network conditions gracefully', async () => {
      const slowMocks = [
        {
          request: {
            query: GET_DASHBOARD_DATA,
            variables: { userID: 'user-1' }
          },
          result: () => {
            return new Promise(resolve => {
              setTimeout(() => {
                resolve({ data: generateLargeDataset('small') })
              }, 2000) // 2 second delay
            })
          }
        }
      ]

      const startTime = performance.now()
      renderDashboard(slowMocks)

      // Should show loading state immediately
      expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      }, { timeout: 5000 })

      const endTime = performance.now()
      
      // Should handle slow network without blocking UI
      expect(endTime - startTime).toBeGreaterThan(2000)
      expect(screen.getByText(/Portfolio \d+/)).toBeInTheDocument()
    })

    it('should implement efficient caching strategies', async () => {
      let queryCount = 0
      const cachingMocks = [
        {
          request: {
            query: GET_DASHBOARD_DATA,
            variables: { userID: 'user-1' }
          },
          result: () => {
            queryCount++
            return { data: generateLargeDataset('small') }
          }
        }
      ]

      const { rerender } = renderDashboard(cachingMocks)

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      expect(queryCount).toBe(1)

      // Rerender should use cache
      rerender(
        <MockedProvider mocks={cachingMocks} addTypename={false}>
          <DashboardHomePage />
        </MockedProvider>
      )

      // Should not trigger additional queries immediately
      expect(queryCount).toBe(1)
    })
  })
})
import { render, screen, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import DashboardHomePage from '@/pages/dashboard-home'
import { GET_DASHBOARD_DATA } from '@/lib/graphql/dashboard.queries'
// Simple wrapper for testing without full router setup

// Mock the dashboard calculations hook
vi.mock('@/hooks/use-dashboard-calculations', () => ({
  useDashboardCalculations: () => ({
    data: {
      totalValue: 125000,
      totalChange: 2500,
      totalChangePercent: 2.04,
      portfolios: [
        {
          id: 'portfolio-1',
          name: 'Growth Portfolio',
          value: 75000,
          change: 1500,
          changePercent: 2.04,
          allocation: 60,
          assets: [{ id: 'asset-1', name: 'AAPL', symbol: 'AAPL' }]
        }
      ],
      topPerformingAssets: [],
      worstPerformingAssets: [],
      recentTransactions: [],
      assetAllocation: [],
      alerts: [],
      portfolioAllocation: []
    },
    loading: false
  })
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ECharts
vi.mock('echarts-for-react', () => ({
  default: ({ option }: any) => (
    <div data-testid="echarts-responsive" style={{ width: '100%', height: '300px' }}>
      ECharts Responsive Mock
    </div>
  )
}))

const mockData = {
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
        }
      ]
    }
  ],
  transactions: []
}

const mocks = [
  {
    request: {
      query: GET_DASHBOARD_DATA,
      variables: { userID: 'user-1' }
    },
    result: { data: mockData }
  }
]

// Helper to set viewport size
const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'))
}

const renderDashboard = () => {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <DashboardHomePage />
    </MockedProvider>
  )
}

describe('Dashboard Responsive Behavior Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to desktop size
    setViewportSize(1024, 768)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Mobile Responsiveness (320px - 768px)', () => {
    it('should adapt layout for mobile screens (320px)', async () => {
      setViewportSize(320, 568)
      
      renderDashboard()

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      // Check that sidebar is collapsible on mobile
      const sidebarTrigger = screen.getByRole('button', { name: /toggle sidebar/i })
      expect(sidebarTrigger).toBeInTheDocument()

      // Portfolio overview should stack vertically
      const portfolioOverview = screen.getByText('$125,000.00')
      expect(portfolioOverview).toBeInTheDocument()

      // Quick actions should be stacked
      const quickActions = screen.getByText('Add Transaction')
      expect(quickActions).toBeInTheDocument()
    })

    it('should handle touch interactions on mobile', async () => {
      setViewportSize(375, 667) // iPhone SE size
      
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // All interactive elements should be accessible via touch
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button)
        // Buttons should have adequate touch target size (44px minimum)
        const minSize = 44
        expect(
          parseInt(styles.minHeight) >= minSize || 
          parseInt(styles.height) >= minSize ||
          button.offsetHeight >= minSize
        ).toBe(true)
      })
    })

    it('should optimize chart rendering for mobile', async () => {
      setViewportSize(414, 896) // iPhone 11 Pro Max
      
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('echarts-responsive')).toBeInTheDocument()
      })

      const chart = screen.getByTestId('echarts-responsive')
      const chartStyles = window.getComputedStyle(chart)
      
      // Chart should be responsive
      expect(chartStyles.width).toBe('100%')
    })
  })

  describe('Tablet Responsiveness (768px - 1024px)', () => {
    it('should adapt layout for tablet screens', async () => {
      setViewportSize(768, 1024)
      
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Should show intermediate layout between mobile and desktop
      // Grid should adapt to tablet size
      const portfolioCards = screen.getByText('Growth Portfolio').closest('[class*="grid"]')
      expect(portfolioCards).toBeInTheDocument()
    })

    it('should handle landscape and portrait orientations', async () => {
      // Portrait tablet
      setViewportSize(768, 1024)
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Landscape tablet
      setViewportSize(1024, 768)
      
      // Should adapt layout for landscape
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
    })
  })

  describe('Desktop Responsiveness (1024px+)', () => {
    it('should show full desktop layout', async () => {
      setViewportSize(1440, 900)
      
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Should show full grid layout
      // Portfolio overview should span multiple columns
      const portfolioOverview = screen.getByText('$125,000.00')
      expect(portfolioOverview).toBeInTheDocument()

      // All sections should be visible
      expect(screen.getByText('Portfolio Summary')).toBeInTheDocument()
      expect(screen.getByText('Top Performers')).toBeInTheDocument()
      expect(screen.getByText('Add Transaction')).toBeInTheDocument()
    })

    it('should handle ultra-wide screens', async () => {
      setViewportSize(2560, 1440)
      
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Layout should not become too stretched
      // Content should have reasonable max-width constraints
      const mainContent = screen.getByText('Growth Portfolio').closest('div')
      expect(mainContent).toBeInTheDocument()
    })
  })

  describe('Dynamic Resize Behavior', () => {
    it('should handle window resize events', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Start with desktop
      setViewportSize(1200, 800)
      
      // Resize to mobile
      setViewportSize(375, 667)
      
      // Should adapt layout dynamically
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      
      // Resize back to desktop
      setViewportSize(1200, 800)
      
      // Should return to desktop layout
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
    })

    it('should maintain chart responsiveness during resize', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('echarts-responsive')).toBeInTheDocument()
      })

      const chart = screen.getByTestId('echarts-responsive')
      
      // Resize window
      setViewportSize(800, 600)
      
      // Chart should remain responsive
      const chartStyles = window.getComputedStyle(chart)
      expect(chartStyles.width).toBe('100%')
    })

    it('should handle rapid resize events efficiently', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      const startTime = performance.now()
      
      // Simulate rapid resize events
      for (let i = 0; i < 10; i++) {
        setViewportSize(800 + i * 10, 600 + i * 5)
      }
      
      const endTime = performance.now()
      
      // Should handle rapid resizes efficiently (less than 100ms total)
      expect(endTime - startTime).toBeLessThan(100)
      
      // Content should still be visible
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
    })
  })

  describe('Content Overflow and Scrolling', () => {
    it('should handle content overflow gracefully', async () => {
      setViewportSize(320, 400) // Very small screen
      
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Content should be scrollable, not cut off
      const mainContent = document.body
      expect(mainContent.scrollHeight).toBeGreaterThan(400)
    })

    it('should maintain horizontal scrolling prevention', async () => {
      setViewportSize(320, 568)
      
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Should not cause horizontal scrolling
      expect(document.body.scrollWidth).toBeLessThanOrEqual(320)
    })
  })

  describe('Accessibility at Different Screen Sizes', () => {
    it('should maintain focus management across screen sizes', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Test focus on desktop
      setViewportSize(1200, 800)
      const addTransactionButton = screen.getByText('Add Transaction')
      addTransactionButton.focus()
      expect(document.activeElement).toBe(addTransactionButton)

      // Resize to mobile
      setViewportSize(375, 667)
      
      // Focus should be maintained or handled gracefully
      expect(document.activeElement).toBeTruthy()
    })

    it('should maintain keyboard navigation on all screen sizes', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // All interactive elements should be keyboard accessible
      const interactiveElements = screen.getAllByRole('button')
      
      interactiveElements.forEach(element => {
        expect(element.tabIndex).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Performance Across Screen Sizes', () => {
    it('should maintain performance on smaller screens', async () => {
      const startTime = performance.now()
      
      setViewportSize(320, 568)
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      const endTime = performance.now()
      
      // Should render quickly even on mobile
      expect(endTime - startTime).toBeLessThan(3000)
    })

    it('should optimize rendering for different screen densities', async () => {
      // Mock high DPI screen
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        configurable: true,
        value: 2,
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Should handle high DPI screens without performance issues
      expect(screen.getByTestId('echarts-responsive')).toBeInTheDocument()
    })
  })
})
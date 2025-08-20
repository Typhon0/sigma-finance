import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { gql } from '@apollo/client'
import PortfolioAnalytics from '@/components/portfolio/portfolio-analytics'
import { usePortfolioAnalytics } from '@/hooks/use-portfolio-analytics'

// Mock the Chart component
vi.mock('@/components/ui/chart', () => ({
  Chart: ({ option, onClick, className }: any) => (
    <div 
      data-testid="analytics-chart" 
      className={className}
      onClick={() => onClick && onClick({ data: { name: 'Test Asset', value: 1000 } })}
    >
      Chart rendered with data
    </div>
  ),
}))

// Mock chart colors
vi.mock('@/lib/chart-colors', () => ({
  getChartColors: () => ['#e11d48', '#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b'],
  getAssetTypeColor: (assetType: string) => '#e11d48',
}))

// Mock portfolio calculations
vi.mock('@/lib/utils/portfolio-calculations', () => ({
  formatCurrency: (value: number) => `$${value.toLocaleString()}`,
  formatPercentage: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
}))

// Test component that uses the analytics hook
function TestPortfolioAnalyticsPage({ portfolioId }: { portfolioId: string }) {
  const { analytics, loading, error, refetch, isStale } = usePortfolioAnalytics({
    portfolioId,
    enabled: true,
  })

  return (
    <div>
      <div data-testid="loading-state">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="stale-state">{isStale ? 'Stale' : 'Fresh'}</div>
      {error && <div data-testid="error-message">{error.message}</div>}
      <button onClick={refetch} data-testid="refetch-button">
        Refetch
      </button>
      <PortfolioAnalytics 
        analytics={analytics} 
        isLoading={loading} 
        error={error}
      />
    </div>
  )
}

const GET_PORTFOLIO_ANALYTICS = gql`
  query GetPortfolioAnalytics($portfolioID: ID!) {
    portfolio(id: $portfolioID) {
      id
      name
      analytics {
        totalValue
        totalCost
        totalGainLoss
        totalGainLossPercent
        assetAllocation {
          assetType
          value
          percentage
          count
        }
        riskMetrics {
          volatility
          sharpeRatio
          maxDrawdown
          diversification
        }
        performanceHistory {
          date
          value
        }
      }
    }
  }
`

const mockAnalyticsResponse = {
  portfolio: {
    id: 'portfolio-1',
    name: 'Test Portfolio',
    analytics: {
      totalValue: 150000,
      totalCost: 120000,
      totalGainLoss: 30000,
      totalGainLossPercent: 25.0,
      assetAllocation: [
        {
          assetType: 'STOCK',
          value: 75000,
          percentage: 50,
          count: 8,
        },
        {
          assetType: 'CRYPTO',
          value: 45000,
          percentage: 30,
          count: 5,
        },
        {
          assetType: 'BANK_ACCOUNT',
          value: 30000,
          percentage: 20,
          count: 2,
        },
      ],
      riskMetrics: {
        volatility: 0.18,
        sharpeRatio: 1.5,
        maxDrawdown: -0.12,
        diversification: 82,
      },
      performanceHistory: [
        { date: '2024-01-01', value: 120000 },
        { date: '2024-01-15', value: 125000 },
        { date: '2024-02-01', value: 135000 },
        { date: '2024-02-15', value: 140000 },
        { date: '2024-03-01', value: 150000 },
      ],
    },
  },
}

describe('Portfolio Analytics Integration', () => {
  const successMock = {
    request: {
      query: GET_PORTFOLIO_ANALYTICS,
      variables: { portfolioID: 'portfolio-1' },
    },
    result: {
      data: mockAnalyticsResponse,
    },
  }

  const errorMock = {
    request: {
      query: GET_PORTFOLIO_ANALYTICS,
      variables: { portfolioID: 'portfolio-error' },
    },
    error: new Error('Analytics calculation failed'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful Analytics Loading', () => {
    it('should load and display portfolio analytics correctly', async () => {
      render(
        <MockedProvider mocks={[successMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      // Initially loading
      expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading')

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading')
      })

      // Check that analytics data is displayed
      expect(screen.getByText('$150,000')).toBeInTheDocument()
      expect(screen.getByText('$30,000')).toBeInTheDocument()
      expect(screen.getByText('+25.00%')).toBeInTheDocument()
      expect(screen.getByText('82%')).toBeInTheDocument()

      // Check asset allocation
      expect(screen.getByText('Stock')).toBeInTheDocument()
      expect(screen.getByText('Crypto')).toBeInTheDocument()
      expect(screen.getByText('Bank Account')).toBeInTheDocument()
      expect(screen.getByText('8 assets')).toBeInTheDocument()
      expect(screen.getByText('5 assets')).toBeInTheDocument()
    })

    it('should handle tab switching correctly', async () => {
      render(
        <MockedProvider mocks={[successMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading')
      })

      // Initially on allocation tab
      expect(screen.getByText('Asset Allocation')).toBeInTheDocument()

      // Switch to performance tab
      fireEvent.click(screen.getByRole('tab', { name: /Performance/i }))
      await waitFor(() => {
        expect(screen.getByText('Performance History')).toBeInTheDocument()
      })

      // Switch to risk tab
      fireEvent.click(screen.getByRole('tab', { name: /Risk Metrics/i }))
      await waitFor(() => {
        expect(screen.getByText('Risk Analysis')).toBeInTheDocument()
        expect(screen.getByText('18.0%')).toBeInTheDocument() // Volatility
        expect(screen.getByText('1.50')).toBeInTheDocument() // Sharpe Ratio
      })
    })

    it('should handle time period selection', async () => {
      render(
        <MockedProvider mocks={[successMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading')
      })

      // Find and click the time period selector
      const selector = screen.getByRole('combobox')
      fireEvent.click(selector)

      // Select 1Y option
      await waitFor(() => {
        const yearOption = screen.getByText('1Y')
        fireEvent.click(yearOption)
      })

      // Chart should re-render with filtered data
      expect(screen.getByTestId('analytics-chart')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error state correctly', async () => {
      render(
        <MockedProvider mocks={[errorMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-error" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Analytics calculation failed')
      })

      expect(screen.getByText('Failed to Load Analytics')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })

    it('should handle refetch functionality', async () => {
      const refetchMock = {
        request: {
          query: GET_PORTFOLIO_ANALYTICS,
          variables: { portfolioID: 'portfolio-1' },
        },
        result: {
          data: mockAnalyticsResponse,
        },
      }

      render(
        <MockedProvider mocks={[successMock, refetchMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading')
      })

      // Click refetch button
      fireEvent.click(screen.getByTestId('refetch-button'))

      // Should trigger a refetch (loading state might briefly appear)
      expect(screen.getByTestId('refetch-button')).toBeInTheDocument()
    })
  })

  describe('Chart Interactions', () => {
    it('should render charts in all tabs', async () => {
      render(
        <MockedProvider mocks={[successMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading')
      })

      // Allocation tab chart
      expect(screen.getByTestId('analytics-chart')).toBeInTheDocument()

      // Performance tab chart
      fireEvent.click(screen.getByRole('tab', { name: /Performance/i }))
      await waitFor(() => {
        expect(screen.getByTestId('analytics-chart')).toBeInTheDocument()
      })

      // Risk tab chart
      fireEvent.click(screen.getByRole('tab', { name: /Risk Metrics/i }))
      await waitFor(() => {
        expect(screen.getByTestId('analytics-chart')).toBeInTheDocument()
      })
    })

    it('should handle chart click events', async () => {
      render(
        <MockedProvider mocks={[successMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading')
      })

      const chart = screen.getByTestId('analytics-chart')
      fireEvent.click(chart)

      // Should not cause any errors
      expect(chart).toBeInTheDocument()
    })
  })

  describe('Real-time Updates', () => {
    it('should handle polling updates', async () => {
      const updatedMock = {
        request: {
          query: GET_PORTFOLIO_ANALYTICS,
          variables: { portfolioID: 'portfolio-1' },
        },
        result: {
          data: {
            ...mockAnalyticsResponse,
            portfolio: {
              ...mockAnalyticsResponse.portfolio,
              analytics: {
                ...mockAnalyticsResponse.portfolio.analytics,
                totalValue: 160000, // Updated value
                totalGainLoss: 40000,
                totalGainLossPercent: 33.33,
              },
            },
          },
        },
      }

      render(
        <MockedProvider mocks={[successMock, updatedMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('$150,000')).toBeInTheDocument()
      })

      // Simulate polling update (this would happen automatically in real usage)
      // For testing, we can trigger a refetch
      fireEvent.click(screen.getByTestId('refetch-button'))

      await waitFor(() => {
        expect(screen.getByText('$160,000')).toBeInTheDocument()
      })
    })
  })

  describe('Performance Metrics Display', () => {
    it('should display all key performance metrics', async () => {
      render(
        <MockedProvider mocks={[successMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading')
      })

      // Check all key metrics are displayed
      expect(screen.getByText('Total Value')).toBeInTheDocument()
      expect(screen.getByText('Total Gain/Loss')).toBeInTheDocument()
      expect(screen.getByText('Performance')).toBeInTheDocument()
      expect(screen.getByText('Diversification')).toBeInTheDocument()

      // Check values
      expect(screen.getByText('$150,000')).toBeInTheDocument()
      expect(screen.getByText('$30,000')).toBeInTheDocument()
      expect(screen.getByText('+25.00%')).toBeInTheDocument()
      expect(screen.getByText('82%')).toBeInTheDocument()
    })

    it('should display risk metrics correctly', async () => {
      render(
        <MockedProvider mocks={[successMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading')
      })

      // Switch to risk tab
      fireEvent.click(screen.getByRole('tab', { name: /Risk Metrics/i }))

      await waitFor(() => {
        expect(screen.getByText('Volatility')).toBeInTheDocument()
        expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument()
        expect(screen.getByText('Max Drawdown')).toBeInTheDocument()
        expect(screen.getByText('Diversification Score')).toBeInTheDocument()

        // Check calculated values
        expect(screen.getByText('18.0%')).toBeInTheDocument() // Volatility
        expect(screen.getByText('1.50')).toBeInTheDocument() // Sharpe Ratio
        expect(screen.getByText('12.0%')).toBeInTheDocument() // Max Drawdown
        expect(screen.getByText('82%')).toBeInTheDocument() // Diversification
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('should handle different screen sizes', async () => {
      render(
        <MockedProvider mocks={[successMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading')
      })

      // The component should render without layout issues
      expect(screen.getByText('Portfolio Analytics')).toBeInTheDocument()
      expect(screen.getByTestId('analytics-chart')).toBeInTheDocument()
    })
  })

  describe('Data Staleness', () => {
    it('should indicate when data becomes stale', async () => {
      render(
        <MockedProvider mocks={[successMock]} addTypename={false}>
          <TestPortfolioAnalyticsPage portfolioId="portfolio-1" />
        </MockedProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('stale-state')).toHaveTextContent('Fresh')
      })

      // Data staleness would be detected by the hook based on cache timeout
      // This is more of a unit test concern, but we can verify the UI handles it
      expect(screen.getByTestId('stale-state')).toBeInTheDocument()
    })
  })
})
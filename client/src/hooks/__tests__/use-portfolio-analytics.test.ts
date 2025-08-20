import { renderHook, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePortfolioAnalytics, analyticsCache_utils } from '../use-portfolio-analytics'
import { gql } from '@apollo/client'

// Mock the GraphQL query
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

const mockAnalyticsData = {
  portfolio: {
    id: 'portfolio-1',
    name: 'Test Portfolio',
    analytics: {
      totalValue: 100000,
      totalCost: 90000,
      totalGainLoss: 10000,
      totalGainLossPercent: 11.11,
      assetAllocation: [
        {
          assetType: 'STOCK',
          value: 50000,
          percentage: 50,
          count: 5,
        },
        {
          assetType: 'CRYPTO',
          value: 30000,
          percentage: 30,
          count: 3,
        },
      ],
      riskMetrics: {
        volatility: 0.15,
        sharpeRatio: 1.2,
        maxDrawdown: -0.08,
        diversification: 75,
      },
      performanceHistory: [
        { date: '2024-01-01', value: 90000 },
        { date: '2024-02-01', value: 100000 },
      ],
    },
  },
}

const successMock = {
  request: {
    query: GET_PORTFOLIO_ANALYTICS,
    variables: { portfolioID: 'portfolio-1' },
  },
  result: {
    data: mockAnalyticsData,
  },
}

const errorMock = {
  request: {
    query: GET_PORTFOLIO_ANALYTICS,
    variables: { portfolioID: 'portfolio-error' },
  },
  error: new Error('Failed to fetch analytics'),
}

const networkErrorMock = {
  request: {
    query: GET_PORTFOLIO_ANALYTICS,
    variables: { portfolioID: 'portfolio-network-error' },
  },
  networkError: new Error('Network error'),
}

describe('usePortfolioAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    analyticsCache_utils.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    analyticsCache_utils.clear()
  })

  describe('Basic Functionality', () => {
    it('should return loading state initially', () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      expect(result.current.loading).toBe(true)
      expect(result.current.analytics).toBe(null)
      expect(result.current.error).toBe(null)
    })

    it('should return analytics data on successful fetch', async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.analytics).toEqual({
        portfolioId: 'portfolio-1',
        totalValue: 100000,
        totalCost: 90000,
        totalGainLoss: 10000,
        totalGainLossPercent: 11.11,
        assetAllocation: [
          {
            assetType: 'STOCK',
            value: 50000,
            percentage: 50,
            count: 5,
          },
          {
            assetType: 'CRYPTO',
            value: 30000,
            percentage: 30,
            count: 3,
          },
        ],
        riskMetrics: {
          volatility: 0.15,
          sharpeRatio: 1.2,
          maxDrawdown: -0.08,
          diversification: 75,
        },
        performanceHistory: [
          { date: '2024-01-01', value: 90000 },
          { date: '2024-02-01', value: 100000 },
        ],
        diversificationScore: expect.any(Number),
        riskLevel: expect.any(String),
        performanceGrade: expect.any(String),
        volatilityLevel: expect.any(String),
        sharpeRating: expect.any(String),
      })
    })

    it('should handle errors correctly', async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-error' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[errorMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.analytics).toBe(null)
    })
  })

  describe('Caching Functionality', () => {
    it('should cache analytics data', async () => {
      const { result, rerender } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(analyticsCache_utils.has('portfolio-1')).toBe(true)

      // Re-render should use cached data
      rerender()
      expect(result.current.loading).toBe(false)
      expect(result.current.analytics).toBeTruthy()
    })

    it('should return cached data when available', () => {
      // First render to populate cache
      const { result: firstResult } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      // Wait for data to be cached
      waitFor(() => {
        expect(firstResult.current.analytics).toBeTruthy()
      })

      // Second render should use cached data immediately
      const { result: secondResult } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      expect(secondResult.current.loading).toBe(false)
    })

    it('should clear cache when refetch is called', async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock, successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.analytics).toBeTruthy()
      })

      expect(analyticsCache_utils.has('portfolio-1')).toBe(true)

      // Call refetch
      result.current.refetch()

      expect(analyticsCache_utils.has('portfolio-1')).toBe(false)
    })
  })

  describe('Configuration Options', () => {
    it('should respect enabled option', () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1', enabled: false }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      expect(result.current.loading).toBe(false)
      expect(result.current.analytics).toBe(null)
    })

    it('should handle empty portfolioId', () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: '' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      expect(result.current.loading).toBe(false)
      expect(result.current.analytics).toBe(null)
    })
  })

  describe('Enhanced Analytics Calculations', () => {
    it('should calculate diversification score correctly', async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.analytics).toBeTruthy()
      })

      expect(result.current.analytics?.diversificationScore).toBeGreaterThanOrEqual(0)
      expect(result.current.analytics?.diversificationScore).toBeLessThanOrEqual(100)
    })

    it('should calculate risk level correctly', async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.analytics).toBeTruthy()
      })

      expect(['Low', 'Medium', 'High']).toContain(result.current.analytics?.riskLevel)
    })

    it('should calculate performance grade correctly', async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.analytics).toBeTruthy()
      })

      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.current.analytics?.performanceGrade)
    })

    it('should calculate volatility level correctly', async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.analytics).toBeTruthy()
      })

      expect(['Very Low', 'Low', 'Medium', 'High', 'Very High']).toContain(
        result.current.analytics?.volatilityLevel
      )
    })

    it('should calculate Sharpe rating correctly', async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.analytics).toBeTruthy()
      })

      expect(['Excellent', 'Good', 'Fair', 'Poor']).toContain(
        result.current.analytics?.sharpeRating
      )
    })
  })

  describe('Staleness Detection', () => {
    it('should detect stale data', async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics({ 
          portfolioId: 'portfolio-1',
          cacheTimeout: 100, // Very short timeout for testing
        }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.analytics).toBeTruthy()
      })

      expect(result.current.isStale).toBe(false)

      // Wait for data to become stale
      await new Promise(resolve => setTimeout(resolve, 150))

      await waitFor(() => {
        expect(result.current.isStale).toBe(true)
      })
    })
  })

  describe('Network Error Handling', () => {
    it('should handle network errors with cached data', async () => {
      // First, populate cache with successful data
      const { result: firstResult } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-1' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[successMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(firstResult.current.analytics).toBeTruthy()
      })

      // Now test with network error - should use cached data
      const { result: secondResult } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-network-error' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[networkErrorMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(secondResult.current.loading).toBe(false)
      })

      // Should handle network error gracefully
      expect(secondResult.current.error).toBeTruthy()
    })
  })

  describe('Cache Utilities', () => {
    it('should provide cache management utilities', () => {
      expect(typeof analyticsCache_utils.clear).toBe('function')
      expect(typeof analyticsCache_utils.delete).toBe('function')
      expect(typeof analyticsCache_utils.size).toBe('function')
      expect(typeof analyticsCache_utils.has).toBe('function')
    })

    it('should clear all cache entries', () => {
      // Simulate some cached data
      analyticsCache_utils.clear()
      expect(analyticsCache_utils.size()).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing analytics data gracefully', async () => {
      const emptyMock = {
        request: {
          query: GET_PORTFOLIO_ANALYTICS,
          variables: { portfolioID: 'portfolio-empty' },
        },
        result: {
          data: {
            portfolio: {
              id: 'portfolio-empty',
              name: 'Empty Portfolio',
              analytics: null,
            },
          },
        },
      }

      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-empty' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[emptyMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.analytics).toBe(null)
      expect(result.current.error).toBe(null)
    })

    it('should handle partial analytics data', async () => {
      const partialMock = {
        request: {
          query: GET_PORTFOLIO_ANALYTICS,
          variables: { portfolioID: 'portfolio-partial' },
        },
        result: {
          data: {
            portfolio: {
              id: 'portfolio-partial',
              name: 'Partial Portfolio',
              analytics: {
                totalValue: 50000,
                totalCost: null,
                totalGainLoss: null,
                totalGainLossPercent: null,
                assetAllocation: [],
                riskMetrics: null,
                performanceHistory: [],
              },
            },
          },
        },
      }

      const { result } = renderHook(
        () => usePortfolioAnalytics({ portfolioId: 'portfolio-partial' }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={[partialMock]} addTypename={false}>
              {children}
            </MockedProvider>
          ),
        }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.analytics?.totalValue).toBe(50000)
      expect(result.current.analytics?.totalCost).toBe(0)
      expect(result.current.analytics?.riskMetrics).toEqual({
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        diversification: 0,
      })
    })
  })
})
import { renderHook, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ReactNode } from 'react'
import { usePortfolioManagement, DuplicatePortfolioInput } from '../use-portfolio-management'

// Mock the auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' }
  })
}))

const DUPLICATE_PORTFOLIO_MUTATION = `
  mutation DuplicatePortfolio($input: DuplicatePortfolioInput!) {
    duplicatePortfolio(input: $input) {
      id
      name
      description
      createdAt
      updatedAt
      assets {
        id
        asset {
          id
          name
          symbol
          currentValue
          assetType {
            name
          }
        }
        quantity
        averagePurchasePrice
        ownershipPct
      }
    }
  }
`

const GET_PORTFOLIOS_QUERY = `
  query GetPortfoliosWithAnalytics($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      description
      createdAt
      updatedAt
      assets {
        id
        asset {
       
          name
          symbol
          currentValue
          assetType {
            name
          }
        }
        quantity
        averagePurchasePrice
        ownershipPct
      }
    }
  }
`

describe('usePortfolioManagement - Duplicate Functionality', () => {
  const mockPortfolio = {
    id: '1',
    name: 'Original Portfolio',
    description: 'Original description',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    assets: [
      {
        id: '1',
        asset: {
          id: '1',
          name: 'Apple Inc.',
          symbol: 'AAPL',
          currentValue: 150,
          assetType: { name: 'Stock' },
        },
        quantity: 10,
        averagePurchasePrice: 140,
        ownershipPct: 100,
      },
    ],
  }

  const duplicatedPortfolio = {
    id: '2',
    name: 'Original Portfolio (Copy)',
    description: 'Original description',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    assets: [
      {
        id: '2',
        asset: {
          id: '1',
          name: 'Apple Inc.',
          symbol: 'AAPL',
          currentValue: 150,
          assetType: { name: 'Stock' },
        },
        quantity: 10,
        averagePurchasePrice: 140,
        ownershipPct: 100,
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful Duplication', () => {
    it('duplicates portfolio with assets successfully', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolio],
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Original Portfolio (Copy)',
                copyAssets: true,
              },
            },
          },
          result: {
            data: {
              duplicatePortfolio: duplicatedPortfolio,
            },
          },
        },
      ]

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      )

      const { result } = renderHook(() => usePortfolioManagement(), { wrapper })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })

      // Duplicate the portfolio
      const duplicateInput: DuplicatePortfolioInput = {
        sourcePortfolioID: '1',
        newName: 'Original Portfolio (Copy)',
        copyAssets: true,
      }

      await result.current.duplicatePortfolio(duplicateInput)

      // Wait for the cache to update
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(2)
      })

      const portfolios = result.current.data?.portfolios || []
      expect(portfolios.find(p => p.id === '2')).toEqual(duplicatedPortfolio)
    })

    it('duplicates portfolio without assets successfully', async () => {
      const duplicatedPortfolioNoAssets = {
        ...duplicatedPortfolio,
        assets: [],
      }

      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolio],
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Empty Copy',
                copyAssets: false,
              },
            },
          },
          result: {
            data: {
              duplicatePortfolio: duplicatedPortfolioNoAssets,
            },
          },
        },
      ]

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      )

      const { result } = renderHook(() => usePortfolioManagement(), { wrapper })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })

      // Duplicate the portfolio without assets
      const duplicateInput: DuplicatePortfolioInput = {
        sourcePortfolioID: '1',
        newName: 'Empty Copy',
        copyAssets: false,
      }

      await result.current.duplicatePortfolio(duplicateInput)

      // Wait for the cache to update
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(2)
      })

      const portfolios = result.current.data?.portfolios || []
      const duplicated = portfolios.find(p => p.name === 'Empty Copy')
      expect(duplicated?.assets).toHaveLength(0)
    })

    it('handles optimistic updates correctly', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolio],
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Optimistic Copy',
                copyAssets: true,
              },
            },
          },
          result: {
            data: {
              duplicatePortfolio: {
                ...duplicatedPortfolio,
                name: 'Optimistic Copy',
              },
            },
          },
          delay: 1000, // Simulate network delay
        },
      ]

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      )

      const { result } = renderHook(() => usePortfolioManagement(), { wrapper })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })

      // Start duplication (don't await yet)
      const duplicatePromise = result.current.duplicatePortfolio({
        sourcePortfolioID: '1',
        newName: 'Optimistic Copy',
        copyAssets: true,
      })

      // Should immediately show optimistic update
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(2)
      })

      const portfolios = result.current.data?.portfolios || []
      const optimisticPortfolio = portfolios.find(p => p.name === 'Optimistic Copy')
      expect(optimisticPortfolio).toBeDefined()
      expect(optimisticPortfolio?.id).toMatch(/^temp-/)

      // Wait for actual response
      await duplicatePromise

      // Should now have the real portfolio
      await waitFor(() => {
        const updatedPortfolios = result.current.data?.portfolios || []
        const realPortfolio = updatedPortfolios.find(p => p.name === 'Optimistic Copy')
        expect(realPortfolio?.id).not.toMatch(/^temp-/)
      })
    })
  })

  describe('Error Handling', () => {
    it('handles name conflict errors', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolio],
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Existing Name',
                copyAssets: true,
              },
            },
          },
          error: new Error('Portfolio name already exists'),
        },
      ]

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      )

      const { result } = renderHook(() => usePortfolioManagement(), { wrapper })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })

      // Attempt to duplicate with existing name
      const duplicateInput: DuplicatePortfolioInput = {
        sourcePortfolioID: '1',
        newName: 'Existing Name',
        copyAssets: true,
      }

      await expect(result.current.duplicatePortfolio(duplicateInput)).rejects.toThrow(
        'Portfolio name already exists'
      )

      // Should still have only the original portfolio
      expect(result.current.data?.portfolios).toHaveLength(1)
    })

    it('handles validation errors', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolio],
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'AB', // Too short
                copyAssets: true,
              },
            },
          },
          error: new Error('Validation failed: name too short'),
        },
      ]

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      )

      const { result } = renderHook(() => usePortfolioManagement(), { wrapper })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })

      // Attempt to duplicate with invalid name
      const duplicateInput: DuplicatePortfolioInput = {
        sourcePortfolioID: '1',
        newName: 'AB',
        copyAssets: true,
      }

      await expect(result.current.duplicatePortfolio(duplicateInput)).rejects.toThrow(
        'Validation failed: name too short'
      )
    })

    it('handles network errors gracefully', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolio],
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Network Error Test',
                copyAssets: true,
              },
            },
          },
          networkError: new Error('Network error'),
        },
      ]

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      )

      const { result } = renderHook(() => usePortfolioManagement(), { wrapper })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })

      // Attempt to duplicate with network error
      const duplicateInput: DuplicatePortfolioInput = {
        sourcePortfolioID: '1',
        newName: 'Network Error Test',
        copyAssets: true,
      }

      await expect(result.current.duplicatePortfolio(duplicateInput)).rejects.toThrow()
    })

    it('reverts optimistic updates on error', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolio],
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Error Test',
                copyAssets: true,
              },
            },
          },
          error: new Error('Duplication failed'),
          delay: 500,
        },
      ]

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      )

      const { result } = renderHook(() => usePortfolioManagement(), { wrapper })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })

      // Start duplication (don't await yet)
      const duplicatePromise = result.current.duplicatePortfolio({
        sourcePortfolioID: '1',
        newName: 'Error Test',
        copyAssets: true,
      })

      // Should show optimistic update
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(2)
      })

      // Wait for error and revert
      await expect(duplicatePromise).rejects.toThrow('Duplication failed')

      // Should revert to original state
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })
    })
  })

  describe('Cache Management', () => {
    it('updates cache correctly after successful duplication', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolio],
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Cache Test',
                copyAssets: true,
              },
            },
          },
          result: {
            data: {
              duplicatePortfolio: {
                ...duplicatedPortfolio,
                name: 'Cache Test',
              },
            },
          },
        },
      ]

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      )

      const { result } = renderHook(() => usePortfolioManagement(), { wrapper })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })

      // Duplicate portfolio
      await result.current.duplicatePortfolio({
        sourcePortfolioID: '1',
        newName: 'Cache Test',
        copyAssets: true,
      })

      // Verify cache is updated
      await waitFor(() => {
        const portfolios = result.current.data?.portfolios || []
        expect(portfolios).toHaveLength(2)
        expect(portfolios.find(p => p.name === 'Cache Test')).toBeDefined()
      })
    })

    it('maintains proper portfolio order in cache', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolio],
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Second Portfolio',
                copyAssets: true,
              },
            },
          },
          result: {
            data: {
              duplicatePortfolio: {
                ...duplicatedPortfolio,
                name: 'Second Portfolio',
              },
            },
          },
        },
      ]

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      )

      const { result } = renderHook(() => usePortfolioManagement(), { wrapper })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data?.portfolios).toHaveLength(1)
      })

      // Duplicate portfolio
      await result.current.duplicatePortfolio({
        sourcePortfolioID: '1',
        newName: 'Second Portfolio',
        copyAssets: true,
      })

      // Verify order is maintained (new portfolio should be added at the end)
      await waitFor(() => {
        const portfolios = result.current.data?.portfolios || []
        expect(portfolios).toHaveLength(2)
        expect(portfolios[0].name).toBe('Original Portfolio')
        expect(portfolios[1].name).toBe('Second Portfolio')
      })
    })
  })
})
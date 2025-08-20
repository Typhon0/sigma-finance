import { renderHook, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReactNode } from 'react'
import { usePortfolioManagement } from '../use-portfolio-management'
import { 
  GET_PORTFOLIOS_WITH_ANALYTICS, 
  DELETE_PORTFOLIO, 
  CREATE_PORTFOLIO 
} from '../use-portfolio-management'

// Mock the auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user1' }
  })
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockPortfolios = [
  {
    id: '1',
    name: 'Test Portfolio 1',
    description: 'First test portfolio',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    assets: [],
  },
  {
    id: '2',
    name: 'Test Portfolio 2',
    description: 'Second test portfolio',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    assets: [
      {
        id: 'asset1',
        asset: {
          id: 'stock1',
          name: 'Apple Inc.',
          symbol: 'AAPL',
          currentValue: 150.00,
          assetType: { name: 'STOCK' },
        },
        quantity: 10,
        averagePurchasePrice: 140.00,
        ownershipPct: 100,
      },
    ],
  },
]

describe('usePortfolioManagement - Delete Functionality', () => {
  const createWrapper = (mocks: any[]) => {
    return ({ children }: { children: ReactNode }) => (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deletePortfolio', () => {
    it('should delete portfolio successfully', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_WITH_ANALYTICS,
            variables: { userID: 'user1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DELETE_PORTFOLIO,
            variables: { id: '1' },
          },
          result: {
            data: {
              deletePortfolio: true,
            },
          },
        },
      ]

      const { result } = renderHook(() => usePortfolioManagement(), {
        wrapper: createWrapper(mocks),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify initial data
      expect(result.current.data?.portfolios).toHaveLength(2)

      // Delete portfolio
      await result.current.deletePortfolio('1')

      await waitFor(() => {
        // Portfolio should be removed from cache
        expect(result.current.data?.portfolios).toHaveLength(1)
        expect(result.current.data?.portfolios[0].id).toBe('2')
      })
    })

    it('should handle delete portfolio error', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_WITH_ANALYTICS,
            variables: { userID: 'user1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DELETE_PORTFOLIO,
            variables: { id: '1' },
          },
          error: new Error('Delete failed'),
        },
      ]

      const { result } = renderHook(() => usePortfolioManagement(), {
        wrapper: createWrapper(mocks),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Attempt to delete portfolio
      await expect(result.current.deletePortfolio('1')).rejects.toThrow('Delete failed')

      // Data should remain unchanged
      expect(result.current.data?.portfolios).toHaveLength(2)
    })

    it('should handle network error during deletion', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_WITH_ANALYTICS,
            variables: { userID: 'user1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DELETE_PORTFOLIO,
            variables: { id: '1' },
          },
          networkError: new Error('Network error'),
        },
      ]

      const { result } = renderHook(() => usePortfolioManagement(), {
        wrapper: createWrapper(mocks),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Attempt to delete portfolio
      await expect(result.current.deletePortfolio('1')).rejects.toThrow('Network error')
    })
  })

  describe('undoDeletePortfolio', () => {
    it('should restore deleted portfolio successfully', async () => {
      const deletedPortfolio = mockPortfolios[0]
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_WITH_ANALYTICS,
            variables: { userID: 'user1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolios[1]], // Only second portfolio remains
            },
          },
        },
        {
          request: {
            query: CREATE_PORTFOLIO,
            variables: {
              input: {
                userID: 'user1',
                name: deletedPortfolio.name,
                description: deletedPortfolio.description,
              },
            },
          },
          result: {
            data: {
              createPortfolio: {
                id: '3', // New ID for restored portfolio
                name: deletedPortfolio.name,
                description: deletedPortfolio.description,
                createdAt: '2024-01-03T00:00:00Z',
                updatedAt: '2024-01-03T00:00:00Z',
              },
            },
          },
        },
      ]

      const { result } = renderHook(() => usePortfolioManagement(), {
        wrapper: createWrapper(mocks),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify initial state (portfolio already deleted)
      expect(result.current.data?.portfolios).toHaveLength(1)

      // Undo deletion
      await result.current.undoDeletePortfolio(deletedPortfolio)

      await waitFor(() => {
        // Portfolio should be restored to cache
        expect(result.current.data?.portfolios).toHaveLength(2)
        const restoredPortfolio = result.current.data?.portfolios.find(p => p.name === deletedPortfolio.name)
        expect(restoredPortfolio).toBeDefined()
        expect(restoredPortfolio?.name).toBe(deletedPortfolio.name)
        expect(restoredPortfolio?.description).toBe(deletedPortfolio.description)
      })
    })

    it('should handle undo deletion error', async () => {
      const deletedPortfolio = mockPortfolios[0]
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_WITH_ANALYTICS,
            variables: { userID: 'user1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolios[1]],
            },
          },
        },
        {
          request: {
            query: CREATE_PORTFOLIO,
            variables: {
              input: {
                userID: 'user1',
                name: deletedPortfolio.name,
                description: deletedPortfolio.description,
              },
            },
          },
          error: new Error('Restore failed'),
        },
      ]

      const { result } = renderHook(() => usePortfolioManagement(), {
        wrapper: createWrapper(mocks),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Attempt to undo deletion
      await expect(result.current.undoDeletePortfolio(deletedPortfolio)).rejects.toThrow('Restore failed')

      // Data should remain unchanged
      expect(result.current.data?.portfolios).toHaveLength(1)
    })

    it('should handle undo with portfolio name conflict', async () => {
      const deletedPortfolio = mockPortfolios[0]
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_WITH_ANALYTICS,
            variables: { userID: 'user1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios, // Both portfolios exist
            },
          },
        },
        {
          request: {
            query: CREATE_PORTFOLIO,
            variables: {
              input: {
                userID: 'user1',
                name: deletedPortfolio.name,
                description: deletedPortfolio.description,
              },
            },
          },
          error: new Error('Portfolio name already exists'),
        },
      ]

      const { result } = renderHook(() => usePortfolioManagement(), {
        wrapper: createWrapper(mocks),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Attempt to undo deletion when name already exists
      await expect(result.current.undoDeletePortfolio(deletedPortfolio)).rejects.toThrow('Portfolio name already exists')
    })
  })

  describe('Cache Management', () => {
    it('should properly update cache when deleting portfolio', async () => {
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_WITH_ANALYTICS,
            variables: { userID: 'user1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DELETE_PORTFOLIO,
            variables: { id: '2' },
          },
          result: {
            data: {
              deletePortfolio: true,
            },
          },
        },
      ]

      const { result } = renderHook(() => usePortfolioManagement(), {
        wrapper: createWrapper(mocks),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify initial data
      expect(result.current.data?.portfolios).toHaveLength(2)
      expect(result.current.data?.portfolios.map(p => p.id)).toEqual(['1', '2'])

      // Delete second portfolio
      await result.current.deletePortfolio('2')

      await waitFor(() => {
        // Only first portfolio should remain
        expect(result.current.data?.portfolios).toHaveLength(1)
        expect(result.current.data?.portfolios[0].id).toBe('1')
      })
    })

    it('should properly update cache when restoring portfolio', async () => {
      const deletedPortfolio = mockPortfolios[1]
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_WITH_ANALYTICS,
            variables: { userID: 'user1' },
          },
          result: {
            data: {
              portfolios: [mockPortfolios[0]], // Only first portfolio
            },
          },
        },
        {
          request: {
            query: CREATE_PORTFOLIO,
            variables: {
              input: {
                userID: 'user1',
                name: deletedPortfolio.name,
                description: deletedPortfolio.description,
              },
            },
          },
          result: {
            data: {
              createPortfolio: {
                id: '4',
                name: deletedPortfolio.name,
                description: deletedPortfolio.description,
                createdAt: '2024-01-04T00:00:00Z',
                updatedAt: '2024-01-04T00:00:00Z',
              },
            },
          },
        },
      ]

      const { result } = renderHook(() => usePortfolioManagement(), {
        wrapper: createWrapper(mocks),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify initial state
      expect(result.current.data?.portfolios).toHaveLength(1)
      expect(result.current.data?.portfolios[0].id).toBe('1')

      // Restore portfolio
      await result.current.undoDeletePortfolio(deletedPortfolio)

      await waitFor(() => {
        // Both portfolios should be present
        expect(result.current.data?.portfolios).toHaveLength(2)
        expect(result.current.data?.portfolios.map(p => p.name)).toContain(deletedPortfolio.name)
      })
    })
  })
})
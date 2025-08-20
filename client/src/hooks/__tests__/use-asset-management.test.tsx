import { renderHook, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import { vi } from 'vitest'
import { useAssets, useAssetTypes, useAssetManagement } from '../use-asset-management'
import { ReactNode } from 'react'

// Mock GraphQL queries and mutations
const GET_ASSETS_MOCK = {
  request: {
    query: expect.any(Object), // We'll mock the actual query
    variables: {
      filter: undefined,
      pagination: undefined,
      orderBy: undefined
    }
  },
  result: {
    data: {
      assets: [
        {
          id: '1',
          name: 'Apple Inc.',
          symbol: 'AAPL',
          currentValue: 150.00,
          assetType: {
            id: '1',
            name: 'Stock'
          }
        },
        {
          id: '2',
          name: 'Bitcoin',
          symbol: 'BTC',
          currentValue: 45000.00,
          assetType: {
            id: '2',
            name: 'Crypto'
          }
        }
      ]
    }
  }
}

const GET_ASSET_TYPES_MOCK = {
  request: {
    query: expect.any(Object),
    variables: {}
  },
  result: {
    data: {
      assetTypes: [
        { id: '1', name: 'Stock' },
        { id: '2', name: 'Crypto' },
        { id: '3', name: 'Real Estate' }
      ]
    }
  }
}

const ADD_ASSET_TO_PORTFOLIO_MOCK = {
  request: {
    query: expect.any(Object),
    variables: {
      input: {
        portfolioID: 'portfolio-1',
        assetID: 'asset-1',
        quantity: 10,
        averagePurchasePrice: 140.00
      }
    }
  },
  result: {
    data: {
      addAssetToPortfolio: {
        asset: {
          id: 'asset-1',
          name: 'Apple Inc.',
          symbol: 'AAPL',
          currentValue: 150.00,
          assetType: {
            id: '1',
            name: 'Stock'
          }
        },
        quantity: 10,
        averagePurchasePrice: 140.00,
        ownershipPct: 100
      }
    }
  }
}

const REMOVE_ASSET_FROM_PORTFOLIO_MOCK = {
  request: {
    query: expect.any(Object),
    variables: {
      portfolioID: 'portfolio-1',
      assetID: 'asset-1'
    }
  },
  result: {
    data: {
      removeAssetFromPortfolio: 'asset-1'
    }
  }
}

// Mock Apollo Client hooks
vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual('@apollo/client')
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    gql: vi.fn()
  }
})

const createWrapper = (mocks: any[] = []) => {
  return ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks} addTypename={false}>
      {children}
    </MockedProvider>
  )
}

describe('useAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns assets data when query succeeds', async () => {
    const { useQuery } = await import('@apollo/client')
    vi.mocked(useQuery).mockReturnValue({
      data: { assets: GET_ASSETS_MOCK.result.data.assets },
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    const { result } = renderHook(() => useAssets(), {
      wrapper: createWrapper([GET_ASSETS_MOCK])
    })

    expect(result.current.assets).toHaveLength(2)
    expect(result.current.assets[0].name).toBe('Apple Inc.')
    expect(result.current.assets[1].name).toBe('Bitcoin')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns loading state when query is loading', async () => {
    const { useQuery } = await import('@apollo/client')
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn()
    })

    const { result } = renderHook(() => useAssets(), {
      wrapper: createWrapper([GET_ASSETS_MOCK])
    })

    expect(result.current.assets).toHaveLength(0)
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('returns error state when query fails', async () => {
    const { useQuery } = await import('@apollo/client')
    const mockError = new Error('Failed to fetch assets')
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      loading: false,
      error: mockError,
      refetch: vi.fn()
    })

    const { result } = renderHook(() => useAssets(), {
      wrapper: createWrapper([GET_ASSETS_MOCK])
    })

    expect(result.current.assets).toHaveLength(0)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(mockError)
  })

  it('passes filter parameters to query', async () => {
    const { useQuery } = await import('@apollo/client')
    const mockRefetch = vi.fn()
    vi.mocked(useQuery).mockReturnValue({
      data: { assets: [] },
      loading: false,
      error: null,
      refetch: mockRefetch
    })

    const filter = { assetTypeID: '1', nameContains: 'Apple' }
    const pagination = { limit: 10, offset: 0 }
    const orderBy = { field: 'NAME' as const, direction: 'ASC' as const }

    renderHook(() => useAssets(filter, pagination, orderBy), {
      wrapper: createWrapper([GET_ASSETS_MOCK])
    })

    expect(useQuery).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        variables: { filter, pagination, orderBy }
      })
    )
  })
})

describe('useAssetTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns asset types data when query succeeds', async () => {
    const { useQuery } = await import('@apollo/client')
    vi.mocked(useQuery).mockReturnValue({
      data: { assetTypes: GET_ASSET_TYPES_MOCK.result.data.assetTypes },
      loading: false,
      error: null
    })

    const { result } = renderHook(() => useAssetTypes(), {
      wrapper: createWrapper([GET_ASSET_TYPES_MOCK])
    })

    expect(result.current.assetTypes).toHaveLength(3)
    expect(result.current.assetTypes[0].name).toBe('Stock')
    expect(result.current.assetTypes[1].name).toBe('Crypto')
    expect(result.current.assetTypes[2].name).toBe('Real Estate')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns loading state when query is loading', async () => {
    const { useQuery } = await import('@apollo/client')
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      loading: true,
      error: null
    })

    const { result } = renderHook(() => useAssetTypes(), {
      wrapper: createWrapper([GET_ASSET_TYPES_MOCK])
    })

    expect(result.current.assetTypes).toHaveLength(0)
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })
})

describe('useAssetManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides addAssetToPortfolio function', async () => {
    const { useMutation } = await import('@apollo/client')
    const mockMutation = vi.fn().mockResolvedValue(ADD_ASSET_TO_PORTFOLIO_MOCK.result)
    vi.mocked(useMutation).mockReturnValue([mockMutation, { loading: false, error: null }])

    const { result } = renderHook(() => useAssetManagement(), {
      wrapper: createWrapper([ADD_ASSET_TO_PORTFOLIO_MOCK])
    })

    expect(typeof result.current.addAssetToPortfolio).toBe('function')
  })

  it('calls addAssetToPortfolio mutation with correct variables', async () => {
    const { useMutation } = await import('@apollo/client')
    const mockMutation = vi.fn().mockResolvedValue(ADD_ASSET_TO_PORTFOLIO_MOCK.result)
    vi.mocked(useMutation).mockReturnValue([mockMutation, { loading: false, error: null }])

    const { result } = renderHook(() => useAssetManagement(), {
      wrapper: createWrapper([ADD_ASSET_TO_PORTFOLIO_MOCK])
    })

    const input = {
      portfolioID: 'portfolio-1',
      assetID: 'asset-1',
      quantity: 10,
      averagePurchasePrice: 140.00
    }

    await result.current.addAssetToPortfolio(input)

    expect(mockMutation).toHaveBeenCalledWith({
      variables: { input },
      update: expect.any(Function)
    })
  })

  it('provides removeAssetFromPortfolio function', async () => {
    const { useMutation } = await import('@apollo/client')
    const mockMutation = vi.fn().mockResolvedValue(REMOVE_ASSET_FROM_PORTFOLIO_MOCK.result)
    vi.mocked(useMutation).mockReturnValue([mockMutation, { loading: false, error: null }])

    const { result } = renderHook(() => useAssetManagement(), {
      wrapper: createWrapper([REMOVE_ASSET_FROM_PORTFOLIO_MOCK])
    })

    expect(typeof result.current.removeAssetFromPortfolio).toBe('function')
  })

  it('calls removeAssetFromPortfolio mutation with correct variables', async () => {
    const { useMutation } = await import('@apollo/client')
    const mockMutation = vi.fn().mockResolvedValue(REMOVE_ASSET_FROM_PORTFOLIO_MOCK.result)
    vi.mocked(useMutation).mockReturnValue([mockMutation, { loading: false, error: null }])

    const { result } = renderHook(() => useAssetManagement(), {
      wrapper: createWrapper([REMOVE_ASSET_FROM_PORTFOLIO_MOCK])
    })

    await result.current.removeAssetFromPortfolio('portfolio-1', 'asset-1')

    expect(mockMutation).toHaveBeenCalledWith({
      variables: { portfolioID: 'portfolio-1', assetID: 'asset-1' },
      update: expect.any(Function)
    })
  })

  it('handles addAssetToPortfolio errors', async () => {
    const { useMutation } = await import('@apollo/client')
    const mockError = new Error('Failed to add asset')
    const mockMutation = vi.fn().mockRejectedValue(mockError)
    vi.mocked(useMutation).mockReturnValue([mockMutation, { loading: false, error: null }])

    const { result } = renderHook(() => useAssetManagement(), {
      wrapper: createWrapper([])
    })

    const input = {
      portfolioID: 'portfolio-1',
      assetID: 'asset-1',
      quantity: 10,
      averagePurchasePrice: 140.00
    }

    await expect(result.current.addAssetToPortfolio(input)).rejects.toThrow('Failed to add asset')
  })

  it('handles removeAssetFromPortfolio errors', async () => {
    const { useMutation } = await import('@apollo/client')
    const mockError = new Error('Failed to remove asset')
    const mockMutation = vi.fn().mockRejectedValue(mockError)
    vi.mocked(useMutation).mockReturnValue([mockMutation, { loading: false, error: null }])

    const { result } = renderHook(() => useAssetManagement(), {
      wrapper: createWrapper([])
    })

    await expect(result.current.removeAssetFromPortfolio('portfolio-1', 'asset-1')).rejects.toThrow('Failed to remove asset')
  })
})
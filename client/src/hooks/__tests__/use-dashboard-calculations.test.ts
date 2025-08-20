import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardCalculations } from '../use-dashboard-calculations'
import * as dashboardDataHooks from '../use-dashboard-data'

// Mock the dashboard data hooks
vi.mock('../use-dashboard-data')

const mockUseDashboardData = vi.mocked(dashboardDataHooks.useDashboardData)
const mockUseAssetPerformance = vi.mocked(dashboardDataHooks.useAssetPerformance)

// Mock data
const mockPortfolios = [
  {
    id: '1',
    name: 'Tech Portfolio',
    assets: [
      {
        id: '1',
        quantity: 10,
        averagePurchasePrice: 100,
        ownershipPct: 100,
        asset: {
          id: '1',
          name: 'Apple Inc.',
          symbol: 'AAPL',
          currentValue: 150,
          purchasePrice: 100,
          assetType: { id: '1', name: 'STOCK' },
        },
        portfolio: {} as any,
      },
    ],
  },
]

const mockTransactions = [
  {
    id: '1',
    transactionType: 'BUY',
    quantity: 10,
    pricePerUnit: 100,
    transactionDate: '2024-01-01',
    asset: {
      id: '1',
      name: 'Apple Inc.',
      symbol: 'AAPL',
      currentValue: 150,
      assetType: { id: '1', name: 'STOCK' },
    },
    portfolio: {
      id: '1',
      name: 'Tech Portfolio',
      assets: [],
    },
  },
]

describe('useDashboardCalculations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return calculated dashboard data when data is available', () => {
    mockUseDashboardData.mockReturnValue({
      data: {
        portfolios: mockPortfolios,
        transactions: mockTransactions,
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    mockUseAssetPerformance.mockReturnValue({
      data: { assets: [] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    const { result } = renderHook(() => useDashboardCalculations('user-1'))

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.totalValue).toBe(1500) // 150 * 10
    expect(result.current.data?.totalChange).toBe(500) // 1500 - 1000
    expect(result.current.data?.totalChangePercent).toBe(50) // (500/1000) * 100
    expect(result.current.data?.portfolios).toEqual(mockPortfolios)
    expect(result.current.data?.recentTransactions).toEqual(mockTransactions)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should return null data when portfolios are not available', () => {
    mockUseDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    mockUseAssetPerformance.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    const { result } = renderHook(() => useDashboardCalculations('user-1'))

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('should handle loading states correctly', () => {
    mockUseDashboardData.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    } as any)

    mockUseAssetPerformance.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    const { result } = renderHook(() => useDashboardCalculations('user-1'))

    expect(result.current.loading).toBe(true)
    expect(result.current.dashboardLoading).toBe(true)
    expect(result.current.assetLoading).toBe(false)
  })

  it('should handle error states correctly', () => {
    const mockError = new Error('GraphQL Error')
    
    mockUseDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: mockError,
      refetch: vi.fn(),
    } as any)

    mockUseAssetPerformance.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    const { result } = renderHook(() => useDashboardCalculations('user-1'))

    expect(result.current.error).toBe(mockError)
    expect(result.current.dashboardError).toBe(mockError)
    expect(result.current.assetError).toBeNull()
  })

  it('should calculate asset allocation correctly', () => {
    const portfoliosWithMultipleAssetTypes = [
      {
        id: '1',
        name: 'Diversified Portfolio',
        assets: [
          {
            id: '1',
            quantity: 10,
            averagePurchasePrice: 100,
            ownershipPct: 100,
            asset: {
              id: '1',
              name: 'Apple Inc.',
              currentValue: 150,
              assetType: { id: '1', name: 'STOCK' },
            },
            portfolio: {} as any,
          },
          {
            id: '2',
            quantity: 1,
            averagePurchasePrice: 30000,
            ownershipPct: 100,
            asset: {
              id: '2',
              name: 'Bitcoin',
              currentValue: 35000,
              assetType: { id: '2', name: 'CRYPTO' },
            },
            portfolio: {} as any,
          },
        ],
      },
    ]

    mockUseDashboardData.mockReturnValue({
      data: {
        portfolios: portfoliosWithMultipleAssetTypes,
        transactions: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    mockUseAssetPerformance.mockReturnValue({
      data: { assets: [] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    const { result } = renderHook(() => useDashboardCalculations('user-1'))

    expect(result.current.data?.assetAllocation).toHaveLength(2)
    
    const stockAllocation = result.current.data?.assetAllocation.find(a => a.assetType === 'STOCK')
    const cryptoAllocation = result.current.data?.assetAllocation.find(a => a.assetType === 'CRYPTO')
    
    expect(stockAllocation?.value).toBe(1500) // 150 * 10
    expect(cryptoAllocation?.value).toBe(35000) // 35000 * 1
    expect(stockAllocation?.percentage).toBeCloseTo(4.11, 1) // 1500 / (1500 + 35000) * 100
    expect(cryptoAllocation?.percentage).toBeCloseTo(95.89, 1) // 35000 / (1500 + 35000) * 100
  })

  it('should call refetch functions when refetch is called', async () => {
    const mockRefetchDashboard = vi.fn()
    const mockRefetchAssets = vi.fn()

    mockUseDashboardData.mockReturnValue({
      data: { portfolios: mockPortfolios, transactions: [] },
      loading: false,
      error: null,
      refetch: mockRefetchDashboard,
    } as any)

    mockUseAssetPerformance.mockReturnValue({
      data: { assets: [] },
      loading: false,
      error: null,
      refetch: mockRefetchAssets,
    } as any)

    const { result } = renderHook(() => useDashboardCalculations('user-1'))

    await result.current.refetch()

    expect(mockRefetchDashboard).toHaveBeenCalled()
    expect(mockRefetchAssets).toHaveBeenCalled()
  })
})
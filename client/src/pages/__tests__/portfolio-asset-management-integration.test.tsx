import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import PortfolioDetailPage from '../portfolio-detail'

// Mock the router params
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ portfolioId: 'portfolio-1' }),
  useNavigate: () => vi.fn(),
}))

// Mock the auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' }
  })
}))

// Mock the portfolio management hook
vi.mock('@/hooks/use-portfolio-management', () => ({
  usePortfolioManagement: vi.fn(() => ({
    data: {
      portfolios: [
        {
          id: 'portfolio-1',
          name: 'Test Portfolio',
          description: 'A test portfolio',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          assets: [
            {
              id: 'portfolio-asset-1',
              asset: {
                id: 'asset-1',
                name: 'Apple Inc.',
                symbol: 'AAPL',
                currentValue: 150.00,
                assetType: {
                  name: 'Stock'
                }
              },
              quantity: 10,
              averagePurchasePrice: 140.00,
              ownershipPct: 100
            },
            {
              id: 'portfolio-asset-2',
              asset: {
                id: 'asset-2',
                name: 'Bitcoin',
                symbol: 'BTC',
                currentValue: 45000.00,
                assetType: {
                  name: 'Crypto'
                }
              },
              quantity: 0.5,
              averagePurchasePrice: 40000.00,
              ownershipPct: 100
            }
          ]
        }
      ]
    },
    loading: false,
    error: null,
    refetch: vi.fn()
  }))
}))

// Mock the asset management hook
vi.mock('@/hooks/use-asset-management', () => ({
  useAssets: vi.fn(() => ({
    assets: [
      {
        id: 'asset-3',
        name: 'Tesla Inc.',
        symbol: 'TSLA',
        currentValue: 800.00,
        assetType: { id: '1', name: 'Stock' }
      },
      {
        id: 'asset-4',
        name: 'Ethereum',
        symbol: 'ETH',
        currentValue: 3000.00,
        assetType: { id: '2', name: 'Crypto' }
      }
    ],
    loading: false,
    error: null,
    refetch: vi.fn()
  })),
  useAssetTypes: vi.fn(() => ({
    assetTypes: [
      { id: '1', name: 'Stock' },
      { id: '2', name: 'Crypto' }
    ],
    loading: false,
    error: null
  })),
  useAssetManagement: vi.fn(() => ({
    addAssetToPortfolio: vi.fn().mockResolvedValue({ data: { addAssetToPortfolio: {} } }),
    removeAssetFromPortfolio: vi.fn().mockResolvedValue({ data: { removeAssetFromPortfolio: 'asset-1' } })
  }))
}))

// Mock the sidebar components
vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar">Sidebar</div>
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle</button>
}))

const renderWithProviders = (component: React.ReactElement) => {
  return render(component)
}

describe('Portfolio Asset Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays portfolio assets correctly', () => {
    renderWithProviders(<PortfolioDetailPage />)

    expect(screen.getByText('Test Portfolio')).toBeInTheDocument()

    // Check that assets are displayed
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Bitcoin')).toBeInTheDocument()
    expect(screen.getByText('BTC')).toBeInTheDocument()

    // Check that quantity information is displayed (multiple assets)
    expect(screen.getAllByText(/Quantity/)).toHaveLength(2)
  })

  it('shows add asset button', () => {
    renderWithProviders(<PortfolioDetailPage />)

    expect(screen.getByText('Test Portfolio')).toBeInTheDocument()

    // Find the "Add Asset" button
    const addAssetButton = screen.getByRole('button', { name: /add asset/i })
    expect(addAssetButton).toBeInTheDocument()
  })

  it('displays portfolio metrics correctly', () => {
    renderWithProviders(<PortfolioDetailPage />)

    expect(screen.getByText('Test Portfolio')).toBeInTheDocument()

    // Check that portfolio metrics are displayed
    expect(screen.getByText('Total Value')).toBeInTheDocument()
    expect(screen.getByText('Total Cost')).toBeInTheDocument()
    expect(screen.getByText('Gain/Loss')).toBeInTheDocument()
    expect(screen.getAllByText('Assets')).toHaveLength(2) // Appears in metrics and section title
  })

  it('shows asset type badges correctly', () => {
    renderWithProviders(<PortfolioDetailPage />)

    expect(screen.getByText('Test Portfolio')).toBeInTheDocument()

    // Check that asset type badges are displayed
    const stockBadges = screen.getAllByText('Stock')
    const cryptoBadges = screen.getAllByText('Crypto')
    
    expect(stockBadges.length).toBeGreaterThan(0)
    expect(cryptoBadges.length).toBeGreaterThan(0)
  })

  it('shows portfolio navigation elements', () => {
    renderWithProviders(<PortfolioDetailPage />)

    expect(screen.getByText('Test Portfolio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to portfolios/i })).toBeInTheDocument()
  })

  it('displays portfolio action buttons', () => {
    renderWithProviders(<PortfolioDetailPage />)

    expect(screen.getByText('Test Portfolio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })
})
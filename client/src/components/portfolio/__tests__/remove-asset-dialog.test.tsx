import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { RemoveAssetDialog } from '../remove-asset-dialog'
import type { PortfolioAsset } from '@/hooks/use-portfolio-management'

// Mock the hooks
vi.mock('@/hooks/use-asset-management', () => ({
  useAssetManagement: vi.fn(() => ({
    removeAssetFromPortfolio: vi.fn().mockResolvedValue({ data: { removeAssetFromPortfolio: 'asset-1' } })
  }))
}))

const mockAsset: PortfolioAsset = {
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
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  portfolioID: 'portfolio-1',
  portfolioName: 'Test Portfolio',
  asset: mockAsset,
  onSuccess: vi.fn()
}

describe('RemoveAssetDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog with correct title and description', () => {
    render(<RemoveAssetDialog {...defaultProps} />)

    expect(screen.getByText('Remove Asset from Test Portfolio')).toBeInTheDocument()
    expect(screen.getByText(/You are about to remove/)).toBeInTheDocument()
    expect(screen.getAllByText('Apple Inc.')).toHaveLength(3) // Appears in description and asset details
  })

  it('displays asset details correctly', () => {
    render(<RemoveAssetDialog {...defaultProps} />)

    expect(screen.getByText('Asset Details')).toBeInTheDocument()
    expect(screen.getAllByText('Apple Inc.')).toHaveLength(3)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('calculates and displays financial impact correctly', () => {
    render(<RemoveAssetDialog {...defaultProps} />)

    expect(screen.getByText('Financial Impact')).toBeInTheDocument()
    
    // Check for the presence of financial values (exact formatting may vary)
    expect(screen.getByText(/Current Value:/)).toBeInTheDocument()
    expect(screen.getByText(/Purchase Value:/)).toBeInTheDocument()
    expect(screen.getByText(/Gain\/Loss:/)).toBeInTheDocument()
  })

  it('shows portfolio impact warning', () => {
    render(<RemoveAssetDialog {...defaultProps} />)

    expect(screen.getByText('Portfolio Impact')).toBeInTheDocument()
    expect(screen.getByText(/Removing this asset will reduce your portfolio value by/)).toBeInTheDocument()
  })

  it('shows confirmation requirements', () => {
    render(<RemoveAssetDialog {...defaultProps} />)

    expect(screen.getByText('Confirmation Required')).toBeInTheDocument()
    expect(screen.getByText(/Please confirm that you want to remove/)).toBeInTheDocument()
  })

  it('displays cancel and remove buttons', () => {
    render(<RemoveAssetDialog {...defaultProps} />)

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove asset/i })).toBeInTheDocument()
  })

  it('handles asset with loss correctly', () => {
    const assetWithLoss: PortfolioAsset = {
      ...mockAsset,
      asset: {
        ...mockAsset.asset,
        currentValue: 120.00 // Lower than purchase price
      }
    }

    render(<RemoveAssetDialog {...defaultProps} asset={assetWithLoss} />)

    // Check that financial impact section is displayed with loss scenario
    expect(screen.getByText('Financial Impact')).toBeInTheDocument()
    expect(screen.getByText(/Current Value:/)).toBeInTheDocument()
    expect(screen.getByText(/Purchase Value:/)).toBeInTheDocument()
  })

  it('handles asset with partial ownership correctly', () => {
    const assetWithPartialOwnership: PortfolioAsset = {
      ...mockAsset,
      ownershipPct: 50
    }

    render(<RemoveAssetDialog {...defaultProps} asset={assetWithPartialOwnership} />)

    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('returns null when no asset is provided', () => {
    const { container } = render(<RemoveAssetDialog {...defaultProps} asset={null} />)

    expect(container.firstChild).toBeNull()
  })
})
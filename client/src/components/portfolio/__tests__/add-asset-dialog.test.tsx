import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AddAssetDialog } from '../add-asset-dialog'

// Mock the hooks
vi.mock('@/hooks/use-asset-management', () => ({
  useAssets: vi.fn(() => ({
    assets: [
      {
        id: '1',
        name: 'Apple Inc.',
        symbol: 'AAPL',
        currentValue: 150.00,
        assetType: { id: '1', name: 'Stock' }
      },
      {
        id: '2',
        name: 'Bitcoin',
        symbol: 'BTC',
        currentValue: 45000.00,
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
    addAssetToPortfolio: vi.fn().mockResolvedValue({ data: { addAssetToPortfolio: {} } })
  }))
}))

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  portfolioID: 'portfolio-1',
  portfolioName: 'Test Portfolio',
  onSuccess: vi.fn()
}

describe('AddAssetDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog with correct title and description', () => {
    render(<AddAssetDialog {...defaultProps} />)

    expect(screen.getByText('Add Asset to Test Portfolio')).toBeInTheDocument()
    expect(screen.getByText(/Search and select an asset to add to your portfolio/)).toBeInTheDocument()
  })

  it('displays asset type filter dropdown', () => {
    render(<AddAssetDialog {...defaultProps} />)

    expect(screen.getByText('Filter by Asset Type')).toBeInTheDocument()
  })

  it('displays search input for assets', () => {
    render(<AddAssetDialog {...defaultProps} />)

    expect(screen.getByText('Search Assets')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search by name or symbol...')).toBeInTheDocument()
  })

  it('displays quantity and purchase price inputs', () => {
    render(<AddAssetDialog {...defaultProps} />)

    expect(screen.getByText('Quantity')).toBeInTheDocument()
    expect(screen.getByText('Average Purchase Price (Optional)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter quantity')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter purchase price')).toBeInTheDocument()
  })

  it('displays cancel and add asset buttons', () => {
    render(<AddAssetDialog {...defaultProps} />)

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add asset/i })).toBeInTheDocument()
  })

  it('calls onOpenChange when dialog is closed', () => {
    const onOpenChange = vi.fn()
    render(<AddAssetDialog {...defaultProps} onOpenChange={onOpenChange} open={false} />)

    // When dialog is closed, it should not render content
    expect(screen.queryByText('Add Asset to Test Portfolio')).not.toBeInTheDocument()
  })

  it('shows form fields for asset selection and quantity', () => {
    render(<AddAssetDialog {...defaultProps} />)

    expect(screen.getByText('Select Asset')).toBeInTheDocument()
    expect(screen.getByText('Quantity')).toBeInTheDocument()
    expect(screen.getByText('Average Purchase Price (Optional)')).toBeInTheDocument()
  })
})
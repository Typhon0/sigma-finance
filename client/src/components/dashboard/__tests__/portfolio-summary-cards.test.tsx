import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PortfolioSummaryCards, PortfolioSummaryCardsSkeleton } from '../portfolio-summary-cards'
import { Portfolio } from '@/lib/types/dashboard.types'

// Mock portfolio data for testing
const mockPortfolios: Portfolio[] = [
  {
    id: 'portfolio-1',
    name: 'Growth Portfolio',
    assets: [
      {
        id: 'position-1',
        quantity: 100,
        averagePurchasePrice: 50,
        ownershipPct: 100,
        asset: {
          id: 'asset-1',
          name: 'Apple Inc.',
          symbol: 'AAPL',
          currentValue: 60,
          purchasePrice: 50,
          assetType: { id: 'type-1', name: 'STOCK' }
        },
        portfolio: {} as Portfolio
      },
      {
        id: 'position-2',
        quantity: 50,
        averagePurchasePrice: 100,
        ownershipPct: 100,
        asset: {
          id: 'asset-2',
          name: 'Microsoft Corp.',
          symbol: 'MSFT',
          currentValue: 120,
          purchasePrice: 100,
          assetType: { id: 'type-1', name: 'STOCK' }
        },
        portfolio: {} as Portfolio
      }
    ]
  },
  {
    id: 'portfolio-2',
    name: 'Conservative Portfolio',
    assets: [
      {
        id: 'position-3',
        quantity: 1000,
        averagePurchasePrice: 10,
        ownershipPct: 100,
        asset: {
          id: 'asset-3',
          name: 'Treasury Bond',
          currentValue: 9.5,
          purchasePrice: 10,
          assetType: { id: 'type-2', name: 'BOND' }
        },
        portfolio: {} as Portfolio
      }
    ]
  },
  {
    id: 'portfolio-3',
    name: 'Crypto Portfolio',
    assets: []
  }
]

const mockPortfolioAllocation = [
  {
    portfolio: mockPortfolios[0],
    value: 12000, // (100 * 60) + (50 * 120) = 6000 + 6000
    percentage: 55.81
  },
  {
    portfolio: mockPortfolios[1],
    value: 9500, // 1000 * 9.5
    percentage: 44.19
  },
  {
    portfolio: mockPortfolios[2],
    value: 0,
    percentage: 0
  }
]

// Default props for testing - moved outside describe blocks for global access
const defaultProps = {
  portfolios: mockPortfolios,
  portfolioAllocation: mockPortfolioAllocation,
  isLoading: false
}

describe('PortfolioSummaryCards', () => {
  describe('Portfolio card rendering and data display', () => {
    it('renders all portfolio cards with correct data', () => {
      render(<PortfolioSummaryCards {...defaultProps} />)

      // Check portfolio names
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Conservative Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Crypto Portfolio')).toBeInTheDocument()

      // Check allocation percentages
      expect(screen.getByText('55.8%')).toBeInTheDocument()
      expect(screen.getByText('44.2%')).toBeInTheDocument()
      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })

    it('displays portfolio values formatted as currency', () => {
      render(<PortfolioSummaryCards {...defaultProps} />)

      expect(screen.getByText('$12,000.00')).toBeInTheDocument()
      expect(screen.getByText('$9,500.00')).toBeInTheDocument()
      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })

    it('shows correct asset counts', () => {
      render(<PortfolioSummaryCards {...defaultProps} />)

      expect(screen.getByText('2 assets')).toBeInTheDocument()
      expect(screen.getByText('1 asset')).toBeInTheDocument()
      expect(screen.getByText('0 assets')).toBeInTheDocument()
    })

    it('limits display to 5 portfolios maximum', () => {
      const manyPortfolios = Array.from({ length: 8 }, (_, i) => ({
        ...mockPortfolios[0],
        id: `portfolio-${i}`,
        name: `Portfolio ${i + 1}`
      }))

      render(
        <PortfolioSummaryCards
          {...defaultProps}
          portfolios={manyPortfolios}
        />
      )

      // Should only show first 5 portfolios
      expect(screen.getByText('Portfolio 1')).toBeInTheDocument()
      expect(screen.getByText('Portfolio 5')).toBeInTheDocument()
      expect(screen.queryByText('Portfolio 6')).not.toBeInTheDocument()

      // Should show "View All" button
      expect(screen.getByText('View All Portfolios (8)')).toBeInTheDocument()
    })
  })

  describe('Navigation functionality and click handlers', () => {
    it('calls onPortfolioClick when portfolio card is clicked', () => {
      const mockOnPortfolioClick = vi.fn()

      render(
        <PortfolioSummaryCards
          {...defaultProps}
          onPortfolioClick={mockOnPortfolioClick}
        />
      )

      const portfolioCard = screen.getByText('Growth Portfolio').closest('div[class*="cursor-pointer"]')
      expect(portfolioCard).toBeInTheDocument()

      fireEvent.click(portfolioCard!)
      expect(mockOnPortfolioClick).toHaveBeenCalledWith('portfolio-1')
    })

    it('calls onCreatePortfolio when create button is clicked in empty state', () => {
      const mockOnCreatePortfolio = vi.fn()

      render(
        <PortfolioSummaryCards
          portfolios={[]}
          portfolioAllocation={[]}
          isLoading={false}
          onCreatePortfolio={mockOnCreatePortfolio}
        />
      )

      const createButton = screen.getByText('Create Your First Portfolio')
      fireEvent.click(createButton)

      expect(mockOnCreatePortfolio).toHaveBeenCalled()
    })

    it('calls onViewAllPortfolios when view all button is clicked', () => {
      const mockOnViewAllPortfolios = vi.fn()
      const manyPortfolios = Array.from({ length: 6 }, (_, i) => ({
        ...mockPortfolios[0],
        id: `portfolio-${i}`,
        name: `Portfolio ${i + 1}`
      }))

      render(
        <PortfolioSummaryCards
          portfolios={manyPortfolios}
          portfolioAllocation={[]}
          isLoading={false}
          onViewAllPortfolios={mockOnViewAllPortfolios}
        />
      )

      const viewAllButton = screen.getByText('View All Portfolios (6)')
      fireEvent.click(viewAllButton)

      expect(mockOnViewAllPortfolios).toHaveBeenCalled()
    })

    it('has hover effects on portfolio cards', () => {
      render(<PortfolioSummaryCards {...defaultProps} />)

      const portfolioCard = screen.getByText('Growth Portfolio').closest('div[class*="cursor-pointer"]')
      expect(portfolioCard).toHaveClass('hover:shadow-md', 'transition-all', 'hover:scale-[1.02]')
    })
  })

  describe('Responsive grid behavior', () => {
    it('has responsive grid layout classes', () => {
      const { container } = render(<PortfolioSummaryCards {...defaultProps} />)

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('gap-4', 'md:grid-cols-2', 'lg:grid-cols-3')
    })

    it('handles long portfolio names with truncation', () => {
      const longNamePortfolio = {
        ...mockPortfolios[0],
        name: 'This is a very long portfolio name that should be truncated'
      }

      render(
        <PortfolioSummaryCards
          portfolios={[longNamePortfolio]}
          portfolioAllocation={[]}
          isLoading={false}
        />
      )

      const nameElement = screen.getByText('This is a very long portfolio name that should be truncated')
      expect(nameElement).toHaveClass('truncate')
      expect(nameElement).toHaveAttribute('title', 'This is a very long portfolio name that should be truncated')
    })

    it('maintains proper spacing and layout on different screen sizes', () => {
      const { container } = render(<PortfolioSummaryCards {...defaultProps} />)

      // Check card content padding
      const cardContent = container.querySelector('[class*="p-4"]')
      expect(cardContent).toBeInTheDocument()

      // Check spacing between elements
      const spaceContainer = container.querySelector('.space-y-4')
      expect(spaceContainer).toBeInTheDocument()
    })
  })

  describe('Loading states and empty states', () => {
    it('displays loading skeleton when isLoading is true', () => {
      render(<PortfolioSummaryCards {...defaultProps} isLoading={true} />)

      // Should not show actual portfolio data
      expect(screen.queryByText('Growth Portfolio')).not.toBeInTheDocument()
      expect(screen.queryByText('$12,000.00')).not.toBeInTheDocument()
    })

    it('displays actual content when isLoading is false', () => {
      render(<PortfolioSummaryCards {...defaultProps} isLoading={false} />)

      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('$12,000.00')).toBeInTheDocument()
    })

    it('shows empty state when no portfolios are provided', () => {
      render(
        <PortfolioSummaryCards
          portfolios={[]}
          portfolioAllocation={[]}
          isLoading={false}
        />
      )

      expect(screen.getByText('No portfolios found')).toBeInTheDocument()
      expect(screen.getByText('Get started by creating your first portfolio to track your investments and assets.')).toBeInTheDocument()
      expect(screen.getByText('Create Your First Portfolio')).toBeInTheDocument()
    })
  })

  describe('Edge cases and error handling', () => {
    it('handles portfolios with zero assets', () => {
      const emptyPortfolio = {
        id: 'empty-portfolio',
        name: 'Empty Portfolio',
        assets: []
      }

      render(
        <PortfolioSummaryCards
          portfolios={[emptyPortfolio]}
          portfolioAllocation={[{ portfolio: emptyPortfolio, value: 0, percentage: 0 }]}
          isLoading={false}
        />
      )

      expect(screen.getByText('Empty Portfolio')).toBeInTheDocument()
      expect(screen.getByText('$0.00')).toBeInTheDocument()
      expect(screen.getByText('0 assets')).toBeInTheDocument()
      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })

    it('handles missing portfolio allocation data', () => {
      render(
        <PortfolioSummaryCards
          portfolios={[mockPortfolios[0]]}
          portfolioAllocation={[]}
          isLoading={false}
        />
      )

      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('0.0%')).toBeInTheDocument() // Default percentage
    })
  })
})

describe('PortfolioSummaryCardsSkeleton', () => {
  it('renders default number of skeleton cards', () => {
    const { container } = render(<PortfolioSummaryCardsSkeleton />)

    // Should render skeleton cards with proper grid layout
    const gridContainer = container.querySelector('.grid')
    expect(gridContainer).toHaveClass('gap-4', 'md:grid-cols-2', 'lg:grid-cols-3')
  })

  it('renders custom number of skeleton cards', () => {
    render(<PortfolioSummaryCardsSkeleton count={5} />)

    // Should render with proper structure
    const skeletonCards = document.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletonCards.length).toBeGreaterThan(0)
  })

  it('has proper grid layout for skeleton cards', () => {
    const { container } = render(<PortfolioSummaryCardsSkeleton />)

    const gridContainer = container.querySelector('.grid')
    expect(gridContainer).toHaveClass('gap-4', 'md:grid-cols-2', 'lg:grid-cols-3')
  })
})

describe('Accessibility and keyboard navigation', () => {
  it('has proper semantic structure', () => {
    render(<PortfolioSummaryCards {...defaultProps} />)

    // Cards should be clickable and have proper structure
    const portfolioCards = screen.getAllByRole('button')
    expect(portfolioCards.length).toBe(3) // Should have 3 portfolio cards
  })

  it('provides proper aria labels for portfolio cards', () => {
    render(<PortfolioSummaryCards {...defaultProps} />)

    expect(screen.getByLabelText('View details for Growth Portfolio')).toBeInTheDocument()
    expect(screen.getByLabelText('View details for Conservative Portfolio')).toBeInTheDocument()
    expect(screen.getByLabelText('View details for Crypto Portfolio')).toBeInTheDocument()
  })

  it('handles keyboard events for portfolio cards', () => {
    const mockOnPortfolioClick = vi.fn()

    render(
      <PortfolioSummaryCards
        {...defaultProps}
        onPortfolioClick={mockOnPortfolioClick}
      />
    )

    const portfolioCard = screen.getByLabelText('View details for Growth Portfolio')

    // Test Enter key
    fireEvent.keyDown(portfolioCard, { key: 'Enter' })
    expect(mockOnPortfolioClick).toHaveBeenCalledWith('portfolio-1')

    // Test Space key
    fireEvent.keyDown(portfolioCard, { key: ' ' })
    expect(mockOnPortfolioClick).toHaveBeenCalledTimes(2)
  })

  it('has proper keyboard navigation support', () => {
    render(<PortfolioSummaryCards {...defaultProps} />)

    const portfolioCards = screen.getAllByRole('button')
    portfolioCards.forEach(card => {
      expect(card).toHaveAttribute('tabIndex', '0')
    })
  })
})
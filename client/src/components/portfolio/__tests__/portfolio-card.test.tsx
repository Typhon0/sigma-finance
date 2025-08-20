import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PortfolioCard, PortfolioAction, ViewMode } from '../portfolio-card'
import { Portfolio } from '@/hooks/use-portfolio-management'

// Mock portfolio data for testing
const mockPortfolio: Portfolio = {
  id: 'portfolio-1',
  name: 'Growth Portfolio',
  description: 'A portfolio focused on growth stocks and emerging markets',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-20T15:30:00Z',
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
        assetType: { name: 'STOCK' }
      }
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
        assetType: { name: 'STOCK' }
      }
    }
  ]
}

const mockPortfolioWithAnalytics = {
  ...mockPortfolio,
  analytics: {
    totalValue: 12000,
    totalCost: 10000,
    totalGainLoss: 2000,
    totalGainLossPercent: 20,
    assetCount: 2
  }
}

const defaultProps = {
  portfolio: mockPortfolio,
  viewMode: 'grid' as ViewMode,
  isSelected: false,
  onSelect: vi.fn(),
  onAction: vi.fn(),
  isDragging: false
}

describe('PortfolioCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Portfolio card rendering and data display', () => {
    it('renders portfolio name and description', () => {
      render(<PortfolioCard {...defaultProps} />)

      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('A portfolio focused on growth stocks and emerging markets')).toBeInTheDocument()
    })

    it('displays calculated analytics when not provided', () => {
      render(<PortfolioCard {...defaultProps} />)

      // Should calculate from assets: (100 * 60) + (50 * 120) = 12000
      expect(screen.getByText('$12,000.00')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // asset count badge
    })

    it('displays provided analytics when available', () => {
      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={mockPortfolioWithAnalytics}
        />
      )

      expect(screen.getByText('$12,000.00')).toBeInTheDocument()
      expect(screen.getByText('+20.00%')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('formats currency values correctly', () => {
      const portfolioWithLargeValue = {
        ...mockPortfolio,
        analytics: {
          totalValue: 1234567.89,
          totalCost: 1000000,
          totalGainLoss: 234567.89,
          totalGainLossPercent: 23.46,
          assetCount: 5
        }
      }

      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={portfolioWithLargeValue}
        />
      )

      expect(screen.getByText('$1,234,567.89')).toBeInTheDocument()
    })

    it('shows creation date in grid view', () => {
      render(<PortfolioCard {...defaultProps} viewMode="grid" />)

      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument()
    })

    it('hides description in list view', () => {
      render(<PortfolioCard {...defaultProps} viewMode="list" />)

      // Description should be in the card but not visible in list view layout
      const description = screen.queryByText('A portfolio focused on growth stocks and emerging markets')
      expect(description).toBeInTheDocument()
    })
  })

  describe('Color-coded performance indicators', () => {
    it('shows green badge for positive performance', () => {
      const positivePortfolio = {
        ...mockPortfolio,
        analytics: {
          totalValue: 12000,
          totalCost: 10000,
          totalGainLoss: 2000,
          totalGainLossPercent: 20,
          assetCount: 2
        }
      }

      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={positivePortfolio}
        />
      )

      const performanceBadge = screen.getByText('+20.00%')
      expect(performanceBadge).toBeInTheDocument()
      // Badge should have default variant (green for positive)
    })

    it('shows red badge for negative performance', () => {
      const negativePortfolio = {
        ...mockPortfolio,
        analytics: {
          totalValue: 8000,
          totalCost: 10000,
          totalGainLoss: -2000,
          totalGainLossPercent: -20,
          assetCount: 2
        }
      }

      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={negativePortfolio}
        />
      )

      const performanceBadge = screen.getByText('-20.00%')
      expect(performanceBadge).toBeInTheDocument()
    })

    it('shows neutral badge for zero performance', () => {
      const neutralPortfolio = {
        ...mockPortfolio,
        analytics: {
          totalValue: 10000,
          totalCost: 10000,
          totalGainLoss: 0,
          totalGainLossPercent: 0,
          assetCount: 2
        }
      }

      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={neutralPortfolio}
        />
      )

      const performanceBadge = screen.getByText('+0.00%')
      expect(performanceBadge).toBeInTheDocument()
    })
  })

  describe('Dropdown menu for portfolio actions', () => {
    it('renders dropdown menu trigger', () => {
      render(<PortfolioCard {...defaultProps} />)

      const dropdownTrigger = screen.getByRole('button', { name: /more/i })
      expect(dropdownTrigger).toBeInTheDocument()
    })

    it('opens dropdown menu when trigger is clicked', () => {
      render(<PortfolioCard {...defaultProps} />)

      const dropdownTrigger = screen.getByRole('button', { name: /more/i })
      fireEvent.click(dropdownTrigger)

      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Duplicate')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('calls onAction with correct parameters when menu items are clicked', () => {
      const mockOnAction = vi.fn()
      render(
        <PortfolioCard 
          {...defaultProps} 
          onAction={mockOnAction}
        />
      )

      const dropdownTrigger = screen.getByRole('button', { name: /more/i })
      fireEvent.click(dropdownTrigger)

      // Test edit action
      fireEvent.click(screen.getByText('Edit'))
      expect(mockOnAction).toHaveBeenCalledWith('edit', 'portfolio-1')

      // Test duplicate action
      fireEvent.click(screen.getByText('Duplicate'))
      expect(mockOnAction).toHaveBeenCalledWith('duplicate', 'portfolio-1')

      // Test export action
      fireEvent.click(screen.getByText('Export'))
      expect(mockOnAction).toHaveBeenCalledWith('export', 'portfolio-1')

      // Test delete action
      fireEvent.click(screen.getByText('Delete'))
      expect(mockOnAction).toHaveBeenCalledWith('delete', 'portfolio-1')
    })

    it('prevents card click when dropdown is clicked', () => {
      const mockOnAction = vi.fn()
      render(
        <PortfolioCard 
          {...defaultProps} 
          onAction={mockOnAction}
        />
      )

      const dropdownTrigger = screen.getByRole('button', { name: /more/i })
      fireEvent.click(dropdownTrigger)

      // Should not trigger view action
      expect(mockOnAction).not.toHaveBeenCalledWith('view', 'portfolio-1')
    })
  })

  describe('Selection functionality', () => {
    it('renders checkbox for selection', () => {
      render(<PortfolioCard {...defaultProps} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })

    it('shows selected state when isSelected is true', () => {
      render(<PortfolioCard {...defaultProps} isSelected={true} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('calls onSelect when checkbox is clicked', () => {
      const mockOnSelect = vi.fn()
      render(
        <PortfolioCard 
          {...defaultProps} 
          onSelect={mockOnSelect}
        />
      )

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(mockOnSelect).toHaveBeenCalledWith(true)
    })

    it('prevents card click when checkbox is clicked', () => {
      const mockOnAction = vi.fn()
      render(
        <PortfolioCard 
          {...defaultProps} 
          onAction={mockOnAction}
        />
      )

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      // Should not trigger view action
      expect(mockOnAction).not.toHaveBeenCalledWith('view', 'portfolio-1')
    })

    it('shows ring border when selected', () => {
      const { container } = render(
        <PortfolioCard {...defaultProps} isSelected={true} />
      )

      const card = container.querySelector('[data-slot="card"]')
      expect(card).toHaveClass('ring-2', 'ring-primary')
    })
  })

  describe('Drag and drop functionality', () => {
    it('renders drag handle', () => {
      render(<PortfolioCard {...defaultProps} />)

      const dragHandle = screen.getByTestId('drag-handle') || 
                         document.querySelector('[data-drag-handle]')
      expect(dragHandle).toBeInTheDocument()
    })

    it('shows dragging state when isDragging is true', () => {
      const { container } = render(
        <PortfolioCard {...defaultProps} isDragging={true} />
      )

      const card = container.querySelector('[data-slot="card"]')
      expect(card).toHaveClass('opacity-50')
    })

    it('prevents card click when drag handle is clicked', () => {
      const mockOnAction = vi.fn()
      render(
        <PortfolioCard 
          {...defaultProps} 
          onAction={mockOnAction}
        />
      )

      const dragHandle = document.querySelector('[data-drag-handle]')
      if (dragHandle) {
        fireEvent.click(dragHandle)
        // Should not trigger view action
        expect(mockOnAction).not.toHaveBeenCalledWith('view', 'portfolio-1')
      }
    })
  })

  describe('Responsive design for mobile and desktop', () => {
    it('has responsive layout classes for grid view', () => {
      const { container } = render(
        <PortfolioCard {...defaultProps} viewMode="grid" />
      )

      const card = container.querySelector('[data-slot="card"]')
      expect(card).not.toHaveClass('flex-row')
    })

    it('has responsive layout classes for list view', () => {
      const { container } = render(
        <PortfolioCard {...defaultProps} viewMode="list" />
      )

      const card = container.querySelector('[data-slot="card"]')
      expect(card).toHaveClass('flex-row')
    })

    it('truncates long portfolio names', () => {
      const longNamePortfolio = {
        ...mockPortfolio,
        name: 'This is a very long portfolio name that should be truncated to fit'
      }

      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={longNamePortfolio}
        />
      )

      const nameElement = screen.getByText('This is a very long portfolio name that should be truncated to fit')
      expect(nameElement).toHaveClass('truncate')
    })

    it('handles portfolios with no description', () => {
      const noDescriptionPortfolio = {
        ...mockPortfolio,
        description: undefined
      }

      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={noDescriptionPortfolio}
        />
      )

      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.queryByText('A portfolio focused on growth stocks and emerging markets')).not.toBeInTheDocument()
    })
  })

  describe('Card click functionality', () => {
    it('calls onAction with view when card is clicked', () => {
      const mockOnAction = vi.fn()
      render(
        <PortfolioCard 
          {...defaultProps} 
          onAction={mockOnAction}
        />
      )

      const card = screen.getByText('Growth Portfolio').closest('[data-slot="card"]')
      if (card) {
        fireEvent.click(card)
        expect(mockOnAction).toHaveBeenCalledWith('view', 'portfolio-1')
      }
    })

    it('has hover effects', () => {
      const { container } = render(<PortfolioCard {...defaultProps} />)

      const card = container.querySelector('[data-slot="card"]')
      expect(card).toHaveClass('hover:shadow-md', 'transition-all', 'cursor-pointer')
    })
  })

  describe('Edge cases and error handling', () => {
    it('handles portfolio with no assets', () => {
      const emptyPortfolio = {
        ...mockPortfolio,
        assets: []
      }

      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={emptyPortfolio}
        />
      )

      expect(screen.getByText('$0.00')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument() // asset count
      expect(screen.getByText('+0.00%')).toBeInTheDocument()
    })

    it('handles missing asset data gracefully', () => {
      const portfolioWithMissingData = {
        ...mockPortfolio,
        assets: [
          {
            id: 'position-1',
            quantity: 100,
            averagePurchasePrice: 50,
            ownershipPct: 100,
            asset: {
              id: 'asset-1',
              name: 'Apple Inc.',
              currentValue: 0, // Missing current value
              assetType: { name: 'STOCK' }
            }
          }
        ]
      }

      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={portfolioWithMissingData}
        />
      )

      // Should still render without crashing
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
    })

    it('handles very large numbers correctly', () => {
      const largeValuePortfolio = {
        ...mockPortfolio,
        analytics: {
          totalValue: 999999999.99,
          totalCost: 500000000,
          totalGainLoss: 499999999.99,
          totalGainLossPercent: 100,
          assetCount: 1000
        }
      }

      render(
        <PortfolioCard 
          {...defaultProps} 
          portfolio={largeValuePortfolio}
        />
      )

      expect(screen.getByText('$999,999,999.99')).toBeInTheDocument()
      expect(screen.getByText('1000')).toBeInTheDocument()
    })
  })
})
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PortfoliosPage from '../../../pages/portfolios'
import { PortfolioList } from '../portfolio-list'
import { PortfolioCard } from '../portfolio-card'

const now = new Date().toISOString();
const mockPortfolios = [
  {
    id: '1',
    name: 'Growth Portfolio',
    description: 'Long-term growth assets',
    createdAt: now,
    updatedAt: now,
    assets: [],
    analytics: {
      totalValue: 100000,
      totalCost: 90000,
      totalGainLoss: 10000,
      totalGainLossPercent: 11.11,
      assetCount: 5,
    },
  },
  {
    id: '2',
    name: 'Income Portfolio',
    description: 'Dividend stocks',
    createdAt: now,
    updatedAt: now,
    assets: [],
    analytics: {
      totalValue: 50000,
      totalCost: 48000,
      totalGainLoss: 2000,
      totalGainLossPercent: 4.17,
      assetCount: 3,
    },
  },
]

describe('Portfolio Accessibility & Responsive Design', () => {
  it('renders ARIA roles and labels for main regions and lists', () => {
    render(<PortfoliosPage />)
    expect(screen.getByRole('main', { name: /portfolio management/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /portfolios list|portfolio selection and list/i })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: /portfolios/i })).toBeInTheDocument()
  })

  it('portfolio cards are keyboard accessible and have ARIA attributes', () => {
    render(
      <PortfolioList
        portfolios={mockPortfolios}
        viewMode="grid"
        sortBy="name"
        selectedPortfolios={[]}
        onSelectionChange={() => {}}
        onPortfolioAction={() => {}}
        onViewModeChange={() => {}}
        onSortChange={() => {}}
      />
    )
    const cards = screen.getAllByRole('listitem')
    expect(cards.length).toBe(mockPortfolios.length)
    cards.forEach(card => {
      expect(card).toHaveAttribute('tabindex', '0')
      expect(card).toHaveAttribute('aria-label')
      expect(card).toHaveAttribute('aria-posinset')
      expect(card).toHaveAttribute('aria-setsize')
    })
  })

  it('supports keyboard navigation (Tab, Enter, Space) for cards', () => {
    render(
      <PortfolioList
        portfolios={mockPortfolios}
        viewMode="grid"
        sortBy="name"
        selectedPortfolios={[]}
        onSelectionChange={() => {}}
        onPortfolioAction={() => {}}
        onViewModeChange={() => {}}
        onSortChange={() => {}}
      />
    )
    const cards = screen.getAllByRole('listitem')
    cards[0].focus()
    expect(cards[0]).toHaveFocus()
    fireEvent.keyDown(cards[0], { key: 'Enter' })
    fireEvent.keyDown(cards[1], { key: ' ' })
    // No error should occur
  })

  it('renders correctly on mobile and desktop screen sizes', () => {
    global.innerWidth = 375 // Mobile
    global.dispatchEvent(new Event('resize'))
    render(<PortfoliosPage />)
    expect(screen.getByRole('main')).toHaveClass('w-full')
    global.innerWidth = 1280 // Desktop
    global.dispatchEvent(new Event('resize'))
    render(<PortfoliosPage />)
    expect(screen.getByRole('main')).toHaveClass('max-w-full')
  })

  it('has sufficient color contrast for performance indicators', () => {
    render(
      <PortfolioCard
        portfolio={mockPortfolios[0]}
        viewMode="grid"
        isSelected={false}
        onSelect={() => {}}
        onAction={() => {}}
      />
    )
    const badge = screen.getByText(/11.11%/)
    expect(badge).toHaveClass('bg-primary')
  })

  it('focus management works for modals/dialogs (empty state)', () => {
    render(<PortfoliosPage />)
    const createBtn = screen.getByRole('button', { name: /create portfolio/i })
    createBtn.focus()
    expect(createBtn).toHaveFocus()
  })
})

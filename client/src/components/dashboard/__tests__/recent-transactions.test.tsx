import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecentTransactions, CompactRecentTransactions } from '../recent-transactions'
import { Transaction } from '@/lib/types/dashboard.types'

// Mock data for testing
const mockTransactions: Transaction[] = [
  {
    id: '1',
    transactionType: 'BUY',
    quantity: 10,
    pricePerUnit: 150,
    transactionDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
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
  {
    id: '2',
    transactionType: 'SELL',
    quantity: 5,
    pricePerUnit: 200,
    transactionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    asset: {
      id: '2',
      name: 'Tesla Inc.',
      symbol: 'TSLA',
      currentValue: 200,
      assetType: { id: '1', name: 'STOCK' },
    },
    portfolio: {
      id: '2',
      name: 'Growth Portfolio',
      assets: [],
    },
  },
  {
    id: '3',
    transactionType: 'DEPOSIT',
    quantity: 1,
    pricePerUnit: 1000,
    transactionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    asset: {
      id: '3',
      name: 'Savings Account',
      currentValue: 1000,
      assetType: { id: '2', name: 'BANK_ACCOUNT' },
    },
    portfolio: {
      id: '3',
      name: 'Cash Portfolio',
      assets: [],
    },
  },
  {
    id: '4',
    transactionType: 'WITHDRAWAL',
    quantity: 2,
    pricePerUnit: 500,
    transactionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    asset: {
      id: '4',
      name: 'Checking Account',
      currentValue: 500,
      assetType: { id: '2', name: 'BANK_ACCOUNT' },
    },
    portfolio: {
      id: '3',
      name: 'Cash Portfolio',
      assets: [],
    },
  },
  {
    id: '5',
    transactionType: 'BUY',
    quantity: 0.5,
    pricePerUnit: 40000,
    transactionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    asset: {
      id: '5',
      name: 'Bitcoin',
      symbol: 'BTC',
      currentValue: 40000,
      assetType: { id: '3', name: 'CRYPTO' },
    },
    portfolio: {
      id: '4',
      name: 'Crypto Portfolio',
      assets: [],
    },
  },
  {
    id: '6',
    transactionType: 'BUY',
    quantity: 3,
    pricePerUnit: 100,
    transactionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    asset: {
      id: '6',
      name: 'Microsoft Corp.',
      symbol: 'MSFT',
      currentValue: 100,
      assetType: { id: '1', name: 'STOCK' },
    },
    portfolio: {
      id: '1',
      name: 'Tech Portfolio',
      assets: [],
    },
  },
]

describe('RecentTransactions', () => {
  const mockOnTransactionClick = vi.fn()
  const mockOnViewAllTransactions = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Transaction List Rendering and Data Formatting', () => {
    it('should render transaction list with correct data formatting', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Check that the component renders
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()

      // Check that only 5 transactions are displayed (requirement 4.1)
      const transactionElements = document.querySelectorAll('[class*="cursor-pointer"]')
      expect(transactionElements).toHaveLength(5)

      // Check transaction type display (requirement 4.2)
      expect(screen.getByText('Buy')).toBeInTheDocument()
      expect(screen.getByText('Sell')).toBeInTheDocument()
      expect(screen.getByText('Deposit')).toBeInTheDocument()
      expect(screen.getByText('Withdrawal')).toBeInTheDocument()

      // Check asset names are displayed (requirement 4.2)
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
      expect(screen.getByText('Tesla Inc.')).toBeInTheDocument()
      expect(screen.getByText('Savings Account')).toBeInTheDocument()
      expect(screen.getByText('Checking Account')).toBeInTheDocument()
      expect(screen.getByText('Bitcoin')).toBeInTheDocument()

      // Check asset symbols are displayed when available
      expect(screen.getByText('(AAPL)')).toBeInTheDocument()
      expect(screen.getByText('(TSLA)')).toBeInTheDocument()
      expect(screen.getByText('(BTC)')).toBeInTheDocument()

      // Check portfolio names are displayed
      expect(screen.getByText(/Tech Portfolio/)).toBeInTheDocument()
      expect(screen.getByText(/Growth Portfolio/)).toBeInTheDocument()
      expect(screen.getByText(/Cash Portfolio/)).toBeInTheDocument()
      expect(screen.getByText(/Crypto Portfolio/)).toBeInTheDocument()

      // Check quantity and price formatting
      expect(screen.getByText(/10 units @ \$150\.00/)).toBeInTheDocument()
      expect(screen.getByText(/5 units @ \$200\.00/)).toBeInTheDocument()
      expect(screen.getByText(/0\.5 units @ \$40,000\.00/)).toBeInTheDocument()
    })

    it('should display timestamps correctly (requirement 4.2)', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Check that relative timestamps are displayed (flexible matching)
      const timeElements = document.querySelectorAll('.text-xs.text-muted-foreground')
      const timeTexts = Array.from(timeElements).map(el => el.textContent)
      
      // Should have timestamps that contain "ago"
      const timestampElements = timeTexts.filter(text => text && text.includes('ago'))
      expect(timestampElements.length).toBeGreaterThan(0)
    })

    it('should handle invalid timestamps gracefully', () => {
      const transactionWithInvalidDate: Transaction = {
        ...mockTransactions[0],
        id: 'invalid',
        transactionDate: 'invalid-date',
      }

      render(
        <RecentTransactions
          transactions={[transactionWithInvalidDate]}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // The component should handle invalid dates gracefully
      // It might show "NaN days ago" or "Unknown time" depending on implementation
      const timeElement = document.querySelector('.text-xs.text-muted-foreground')
      expect(timeElement).toBeInTheDocument()
    })
  })

  describe('Color Coding for Transaction Amounts', () => {
    it('should display positive amounts in green for sell and deposit transactions (requirements 4.3, 4.4)', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Find all positive amounts (green)
      const positiveAmounts = screen.getAllByText(/^\+\$/)
      positiveAmounts.forEach((amount) => {
        expect(amount).toHaveClass('text-green-600')
      })
    })

    it('should display negative amounts in red for buy and withdrawal transactions (requirements 4.3, 4.4)', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Find buy transactions - should be negative (red)
      const buyAmounts = screen.getAllByText(/-\$/)
      buyAmounts.forEach((amount) => {
        expect(amount).toHaveClass('text-red-600')
      })

      // Find withdrawal transaction - should be negative (red)
      const withdrawalAmount = screen.getByText('-$1,000.00')
      expect(withdrawalAmount).toHaveClass('text-red-600')
    })

    it('should calculate transaction amounts correctly', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Apple buy: 10 * 150 = $1,500 (negative for buy)
      expect(screen.getByText('-$1,500.00')).toBeInTheDocument()

      // Tesla sell: 5 * 200 = $1,000 (positive for sell)
      const positiveAmounts = screen.getAllByText('+$1,000.00')
      expect(positiveAmounts.length).toBeGreaterThan(0)

      // Bitcoin buy: 0.5 * 40,000 = $20,000 (negative for buy)
      expect(screen.getByText('-$20,000.00')).toBeInTheDocument()

      // Microsoft buy: 3 * 100 = $300 (negative for buy)
      expect(screen.getByText('-$300.00')).toBeInTheDocument()
    })
  })

  describe('Navigation Functionality', () => {
    it('should call onTransactionClick when transaction is clicked (requirement 4.5)', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Click on the first transaction
      const firstTransaction = document.querySelector('[class*="cursor-pointer"]')
      
      if (firstTransaction) {
        fireEvent.click(firstTransaction)
        expect(mockOnTransactionClick).toHaveBeenCalledWith('1')
      }
    })

    it('should call onViewAllTransactions when "View All" button is clicked (requirement 4.6)', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      const viewAllButton = screen.getByRole('button', { name: /view all/i })
      fireEvent.click(viewAllButton)

      expect(mockOnViewAllTransactions).toHaveBeenCalledTimes(1)
    })

    it('should handle missing navigation callbacks gracefully', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
        />
      )

      // Should render without errors even without callbacks
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()

      // Clicking should not throw errors
      const firstTransaction = document.querySelector('[class*="cursor-pointer"]')
      
      if (firstTransaction) {
        expect(() => fireEvent.click(firstTransaction)).not.toThrow()
      }
    })
  })

  describe('Loading States', () => {
    it('should display skeleton loading state when isLoading is true', () => {
      render(
        <RecentTransactions
          transactions={[]}
          isLoading={true}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Check that skeleton elements are rendered
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
      
      // Should have skeleton transaction items
      const skeletonElements = document.querySelectorAll('[data-slot="skeleton"]')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('should not display actual transactions when loading', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
          isLoading={true}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Should not display actual transaction data
      expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument()
      expect(screen.queryByText('Tesla Inc.')).not.toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no transactions are provided', () => {
      render(
        <RecentTransactions
          transactions={[]}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      expect(screen.getByText('No Recent Transactions')).toBeInTheDocument()
      expect(screen.getByText('Your transaction history will appear here once you start trading.')).toBeInTheDocument()
      
      // Should still show "View All" button
      expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument()
    })

    it('should display empty state when transactions array is null or undefined', () => {
      render(
        <RecentTransactions
          transactions={null as any}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      expect(screen.getByText('No Recent Transactions')).toBeInTheDocument()
    })
  })

  describe('Transaction Type Handling', () => {
    it('should handle different transaction types correctly', () => {
      const customTransactions: Transaction[] = [
        {
          ...mockTransactions[0],
          id: 'purchase',
          transactionType: 'PURCHASE',
        },
        {
          ...mockTransactions[0],
          id: 'unknown',
          transactionType: 'UNKNOWN_TYPE',
        },
      ]

      render(
        <RecentTransactions
          transactions={customTransactions}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // PURCHASE should be treated as Buy
      expect(screen.getByText('Buy')).toBeInTheDocument()
      
      // Unknown type should display as-is
      expect(screen.getByText('UNKNOWN_TYPE')).toBeInTheDocument()
    })

    it('should handle case-insensitive transaction types', () => {
      const lowerCaseTransaction: Transaction = {
        ...mockTransactions[0],
        id: 'lowercase',
        transactionType: 'buy',
      }

      render(
        <RecentTransactions
          transactions={[lowerCaseTransaction]}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      expect(screen.getByText('Buy')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <RecentTransactions
          transactions={mockTransactions}
          onTransactionClick={mockOnTransactionClick}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Check that buttons are properly labeled
      const viewAllButton = screen.getByRole('button', { name: /view all/i })
      expect(viewAllButton).toBeInTheDocument()

      // Check that transaction items are clickable
      const transactionElements = document.querySelectorAll('[class*="cursor-pointer"]')
      expect(transactionElements.length).toBeGreaterThan(0)
    })
  })
})

describe('CompactRecentTransactions', () => {
  const mockOnViewAllTransactions = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Compact Display', () => {
    it('should render compact version with limited transactions', () => {
      render(
        <CompactRecentTransactions
          transactions={mockTransactions}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
      
      // Should only show 3 transactions in compact mode
      const transactionElements = screen.getAllByText(/Buy|Sell|Deposit/)
      expect(transactionElements.length).toBeLessThanOrEqual(3)
    })

    it('should display transaction amounts with correct color coding', () => {
      render(
        <CompactRecentTransactions
          transactions={mockTransactions}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      // Check that amounts are displayed with proper colors
      const amounts = screen.getAllByText(/[\+\-]\$/)
      amounts.forEach((amount) => {
        const isPositive = amount.textContent?.startsWith('+')
        const isNegative = amount.textContent?.startsWith('-')
        
        if (isPositive) {
          expect(amount).toHaveClass('text-green-600')
        } else if (isNegative) {
          expect(amount).toHaveClass('text-red-600')
        }
      })
    })

    it('should handle loading state in compact mode', () => {
      render(
        <CompactRecentTransactions
          transactions={[]}
          isLoading={true}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
      
      // Should show skeleton elements
      const skeletonElements = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('should handle empty state in compact mode', () => {
      render(
        <CompactRecentTransactions
          transactions={[]}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      expect(screen.getByText('No recent transactions')).toBeInTheDocument()
    })

    it('should call onViewAllTransactions when "View All" is clicked', () => {
      render(
        <CompactRecentTransactions
          transactions={mockTransactions}
          onViewAllTransactions={mockOnViewAllTransactions}
        />
      )

      const viewAllButton = screen.getByRole('button', { name: /view all/i })
      fireEvent.click(viewAllButton)

      expect(mockOnViewAllTransactions).toHaveBeenCalledTimes(1)
    })
  })
})
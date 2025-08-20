import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock the toast library
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock the formatCurrency utility
vi.mock('@/lib/utils/portfolio-calculations', () => ({
  formatCurrency: vi.fn((value: number) => `$${value.toFixed(2)}`),
}))

import React from 'react'
import { PortfolioDeleteDialog } from '../portfolio-delete-dialog'
import { Portfolio } from '@/hooks/use-portfolio-management'

describe('PortfolioDeleteDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  const mockPortfolioWithoutAssets: Portfolio = {
    id: '1',
    name: 'Test Portfolio',
    description: 'A test portfolio',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    assets: [],
  }

  const mockPortfolioWithAssets: Portfolio = {
    id: '2',
    name: 'Portfolio with Assets',
    description: 'A portfolio with assets',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
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
      {
        id: 'asset2',
        asset: {
          id: 'stock2',
          name: 'Microsoft Corp.',
          symbol: 'MSFT',
          currentValue: 300.00,
          assetType: { name: 'STOCK' },
        },
        quantity: 5,
        averagePurchasePrice: 280.00,
        ownershipPct: 100,
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Dialog Rendering', () => {
    it('should not render when portfolio is null', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={null}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.queryByText('Delete Portfolio')).not.toBeInTheDocument()
    })

    it('should not render when isOpen is false', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.queryByText('Delete Portfolio')).not.toBeInTheDocument()
    })

    it('should render dialog when portfolio exists and isOpen is true', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.getByText('Delete Portfolio')).toBeInTheDocument()
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()
      expect(screen.getByText(mockPortfolioWithoutAssets.name, { exact: false })).toBeInTheDocument()
    })
  })

  describe('Portfolio without Assets', () => {
    it('should show basic deletion warning for portfolio without assets', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.getByText(/permanently delete the portfolio/)).toBeInTheDocument()
      expect(screen.queryByText(/assets to be deleted/)).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('should require typing portfolio name to enable delete button', async () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const deleteButton = screen.getByRole('button', { name: /delete portfolio/i })
      const confirmationInput = screen.getByPlaceholderText(mockPortfolioWithoutAssets.name)

      // Initially disabled
      expect(deleteButton).toBeDisabled()

      // Type incorrect name
      fireEvent.change(confirmationInput, { target: { value: 'Wrong Name' } })
      expect(deleteButton).toBeDisabled()

      // Type correct name
      fireEvent.change(confirmationInput, { target: { value: mockPortfolioWithoutAssets.name } })
      expect(deleteButton).toBeEnabled()
    })

    it('should call onConfirm when delete button is clicked with valid confirmation', async () => {
      mockOnConfirm.mockResolvedValue(undefined)

      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const deleteButton = screen.getByRole('button', { name: /delete portfolio/i })
      const confirmationInput = screen.getByPlaceholderText(mockPortfolioWithoutAssets.name)

      // Type correct name
      fireEvent.change(confirmationInput, { target: { value: mockPortfolioWithoutAssets.name } })

      // Click delete
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith(mockPortfolioWithoutAssets.id)
      })
    })
  })

  describe('Portfolio with Assets', () => {
    it('should show impact preview for portfolio with assets', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.getByText(/assets to be deleted/)).toBeInTheDocument()
      expect(screen.getByText('2 assets')).toBeInTheDocument()
      expect(screen.getByText(/Total portfolio value/)).toBeInTheDocument()
      expect(screen.getByText('$3000.00')).toBeInTheDocument() // 10*150 + 5*300
      expect(screen.getByText('Apple Inc. (AAPL)')).toBeInTheDocument()
      expect(screen.getByText('Microsoft Corp. (MSFT)')).toBeInTheDocument()
    })

    it('should require both name confirmation and assets checkbox for portfolios with assets', async () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const deleteButton = screen.getByRole('button', { name: /delete portfolio/i })
      const confirmationInput = screen.getByPlaceholderText(mockPortfolioWithAssets.name)
      const assetsCheckbox = screen.getByRole('checkbox')

      // Initially disabled
      expect(deleteButton).toBeDisabled()

      // Type correct name but don't check assets checkbox
      fireEvent.change(confirmationInput, { target: { value: mockPortfolioWithAssets.name } })
      expect(deleteButton).toBeDisabled()

      // Check assets checkbox but clear name
      fireEvent.click(assetsCheckbox)
      fireEvent.change(confirmationInput, { target: { value: '' } })
      expect(deleteButton).toBeDisabled()

      // Both name and checkbox
      fireEvent.change(confirmationInput, { target: { value: mockPortfolioWithAssets.name } })
      fireEvent.click(assetsCheckbox)
      expect(deleteButton).toBeEnabled()
    })

    it('should show assets confirmation checkbox text', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.getByText(/I understand that this will permanently delete all 2 assets/)).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should show loading state when isDeleting is true', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      )

      expect(screen.getByText('Deleting...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    })

    it('should disable inputs when isDeleting is true', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      )

      const confirmationInput = screen.getByPlaceholderText(mockPortfolioWithAssets.name)
      const assetsCheckbox = screen.getByRole('checkbox')

      expect(confirmationInput).toBeDisabled()
      expect(assetsCheckbox).toBeDisabled()
    })
  })

  describe('Dialog Actions', () => {
    it('should call onClose when cancel button is clicked', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should reset form state when dialog is closed', async () => {
      const { rerender } = render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const confirmationInput = screen.getByPlaceholderText(mockPortfolioWithoutAssets.name)
      
      // Type something
      fireEvent.change(confirmationInput, { target: { value: 'test' } })
      expect(confirmationInput).toHaveValue('test')

      // Close and reopen dialog
      rerender(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      rerender(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const newConfirmationInput = screen.getByPlaceholderText(mockPortfolioWithoutAssets.name)
      expect(newConfirmationInput).toHaveValue('')
    })
  })

  describe('Error Handling', () => {
    it('should handle onConfirm errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockOnConfirm.mockRejectedValue(new Error('Delete failed'))

      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const deleteButton = screen.getByRole('button', { name: /delete portfolio/i })
      const confirmationInput = screen.getByPlaceholderText(mockPortfolioWithoutAssets.name)

      // Type correct name and click delete
      fireEvent.change(confirmationInput, { target: { value: mockPortfolioWithoutAssets.name } })
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalled()
      })

      // Should log error but not crash
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting portfolio:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      // Check for proper form labels
      expect(screen.getByLabelText(/Type.*to confirm deletion/)).toBeInTheDocument()
      expect(screen.getByLabelText(/I understand that this will permanently delete/)).toBeInTheDocument()

      // Check for proper button roles
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete portfolio/i })).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      render(
        <PortfolioDeleteDialog
          portfolio={mockPortfolioWithoutAssets}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const confirmationInput = screen.getByPlaceholderText(mockPortfolioWithoutAssets.name)
      
      // Should be focusable
      confirmationInput.focus()
      expect(document.activeElement).toBe(confirmationInput)
    })
  })
})
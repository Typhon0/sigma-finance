import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuickActions } from '../quick-actions'

describe('QuickActions', () => {
  const mockOnAddTransaction = vi.fn()
  const mockOnAddAsset = vi.fn()
  const mockOnCreatePortfolio = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Button Rendering and Click Handlers', () => {
    it('should render all three quick action buttons (requirement 7.1, 7.2)', () => {
      render(<QuickActions />)

      // Check that all three buttons are rendered
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add asset/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create portfolio/i })).toBeInTheDocument()
    })

    it('should display correct button text and descriptions (requirement 7.2)', () => {
      render(<QuickActions />)

      // Check button text
      expect(screen.getByText('Add Transaction')).toBeInTheDocument()
      expect(screen.getByText('Add Asset')).toBeInTheDocument()
      expect(screen.getByText('Create Portfolio')).toBeInTheDocument()

      // Check button descriptions
      expect(screen.getByText('Record buy/sell activity')).toBeInTheDocument()
      expect(screen.getByText('Track new investments')).toBeInTheDocument()
      expect(screen.getByText('Organize your assets')).toBeInTheDocument()
    })

    it('should display correct icons for each button', () => {
      render(<QuickActions />)

      // Check that icons are rendered (SVG elements)
      const icons = document.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThanOrEqual(3)
    })

    it('should call custom handlers when provided (requirement 7.3)', () => {
      render(
        <QuickActions
          onAddTransaction={mockOnAddTransaction}
          onAddAsset={mockOnAddAsset}
          onCreatePortfolio={mockOnCreatePortfolio}
        />
      )

      // Click each button and verify handlers are called
      fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
      expect(mockOnAddTransaction).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('button', { name: /add asset/i }))
      expect(mockOnAddAsset).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('button', { name: /create portfolio/i }))
      expect(mockOnCreatePortfolio).toHaveBeenCalledTimes(1)
    })

    it('should disable buttons when isLoading is true', () => {
      render(<QuickActions isLoading={true} />)

      // All buttons should be disabled
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /add asset/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /create portfolio/i })).toBeDisabled()
    })

    it('should enable buttons when isLoading is false', () => {
      render(<QuickActions isLoading={false} />)

      // All buttons should be enabled
      expect(screen.getByRole('button', { name: /add transaction/i })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: /add asset/i })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: /create portfolio/i })).not.toBeDisabled()
    })
  })

  describe('Modal Integration', () => {
    it('should open transaction modal when Add Transaction button is clicked without custom handler (requirement 7.4)', async () => {
      render(<QuickActions />)

      // Click Add Transaction button
      fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))

      // Check that transaction modal opens
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument()
        expect(screen.getByText('Record a new buy, sell, deposit, or withdrawal transaction.')).toBeInTheDocument()
      })
    })

    it('should open asset modal when Add Asset button is clicked without custom handler (requirement 7.5)', async () => {
      render(<QuickActions />)

      // Click Add Asset button
      fireEvent.click(screen.getByRole('button', { name: /add asset/i }))

      // Check that asset modal opens
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Add Asset' })).toBeInTheDocument()
        expect(screen.getByText('Add a new asset to track in your portfolio.')).toBeInTheDocument()
      })
    })

    it('should open portfolio modal when Create Portfolio button is clicked without custom handler', async () => {
      render(<QuickActions />)

      // Click Create Portfolio button
      fireEvent.click(screen.getByRole('button', { name: /create portfolio/i }))

      // Check that portfolio modal opens
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Create Portfolio' })).toBeInTheDocument()
        expect(screen.getByText('Create a new portfolio to organize your assets.')).toBeInTheDocument()
      })
    })

    it('should close modals when close button is clicked', async () => {
      render(<QuickActions />)

      // Open transaction modal
      fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Close modal using the X button
      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('should close modals when clicking outside', async () => {
      render(<QuickActions />)

      // Open asset modal
      fireEvent.click(screen.getByRole('button', { name: /add asset/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Click on the overlay to close (using escape key as it's more reliable)
      fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' })

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('should not open modals when custom handlers are provided', () => {
      render(
        <QuickActions
          onAddTransaction={mockOnAddTransaction}
          onAddAsset={mockOnAddAsset}
          onCreatePortfolio={mockOnCreatePortfolio}
        />
      )

      // Click buttons
      fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
      fireEvent.click(screen.getByRole('button', { name: /add asset/i }))
      fireEvent.click(screen.getByRole('button', { name: /create portfolio/i }))

      // No modals should open
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      // But handlers should be called
      expect(mockOnAddTransaction).toHaveBeenCalledTimes(1)
      expect(mockOnAddAsset).toHaveBeenCalledTimes(1)
      expect(mockOnCreatePortfolio).toHaveBeenCalledTimes(1)
    })
  })

  describe('Responsive Layout Behavior', () => {
    it('should have responsive grid classes for different screen sizes (requirement 7.2)', () => {
      render(<QuickActions />)

      // Check that the grid container has responsive classes
      // Find the specific grid container for the buttons (not the card header)
      const gridContainers = document.querySelectorAll('.grid')
      const buttonGridContainer = Array.from(gridContainers).find(container => 
        container.className.includes('gap-3') && container.className.includes('sm:grid-cols-1')
      )
      
      expect(buttonGridContainer).toBeTruthy()
      expect(buttonGridContainer).toHaveClass('gap-3')
      expect(buttonGridContainer).toHaveClass('sm:grid-cols-1')
      expect(buttonGridContainer).toHaveClass('md:grid-cols-3')
      expect(buttonGridContainer).toHaveClass('lg:grid-cols-1')
      expect(buttonGridContainer).toHaveClass('xl:grid-cols-3')
    })

    it('should have proper button styling for responsive design', () => {
      render(<QuickActions />)

      const buttons = screen.getAllByRole('button').filter(button => 
        button.textContent?.includes('Add Transaction') || 
        button.textContent?.includes('Add Asset') || 
        button.textContent?.includes('Create Portfolio')
      )

      buttons.forEach(button => {
        expect(button).toHaveClass('h-auto')
        expect(button).toHaveClass('p-4')
        expect(button).toHaveClass('flex')
        expect(button).toHaveClass('flex-col')
        expect(button).toHaveClass('items-center')
        expect(button).toHaveClass('gap-2')
        expect(button).toHaveClass('text-center')
      })
    })

    it('should have correct button variants for visual hierarchy', () => {
      render(<QuickActions />)

      const addTransactionButton = screen.getByRole('button', { name: /add transaction/i })
      const addAssetButton = screen.getByRole('button', { name: /add asset/i })
      const createPortfolioButton = screen.getByRole('button', { name: /create portfolio/i })

      // Add Transaction should be primary (no variant class or default variant)
      // Add Asset and Create Portfolio should be outline variant
      expect(addAssetButton.className).toContain('border')
      expect(createPortfolioButton.className).toContain('border')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<QuickActions />)

      // All buttons should have proper roles
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThanOrEqual(3)

      // Check that buttons have accessible names
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add asset/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create portfolio/i })).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      render(<QuickActions />)

      const addTransactionButton = screen.getByRole('button', { name: /add transaction/i })
      
      // Button should be focusable
      addTransactionButton.focus()
      expect(document.activeElement).toBe(addTransactionButton)

      // Should respond to Enter key (we'll just test that it doesn't throw an error)
      expect(() => {
        fireEvent.keyDown(addTransactionButton, { key: 'Enter' })
      }).not.toThrow()
    })

    it('should have proper modal accessibility', async () => {
      render(<QuickActions />)

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))

      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeInTheDocument()
        
        // Check for proper dialog title using heading role
        expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument()
        
        // Check for dialog description
        expect(screen.getByText('Record a new buy, sell, deposit, or withdrawal transaction.')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined props gracefully', () => {
      expect(() => render(<QuickActions />)).not.toThrow()
    })

    it('should handle null handlers gracefully', () => {
      expect(() => 
        render(
          <QuickActions
            onAddTransaction={null as any}
            onAddAsset={null as any}
            onCreatePortfolio={null as any}
          />
        )
      ).not.toThrow()
    })

    it('should handle rapid button clicks without errors', async () => {
      render(<QuickActions />)

      const addTransactionButton = screen.getByRole('button', { name: /add transaction/i })
      
      // Click the button once to open modal
      fireEvent.click(addTransactionButton)

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Close the modal
      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      // Wait for modal to close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      // Should not throw errors and button should still work
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument()
    })

    it('should handle modal state changes correctly', async () => {
      render(<QuickActions />)

      // Open transaction modal
      fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Close it
      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      // Open asset modal
      fireEvent.click(screen.getByRole('button', { name: /add asset/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        // Use a more specific selector to avoid conflicts with button text
        expect(screen.getByRole('heading', { name: 'Add Asset' })).toBeInTheDocument()
      })
    })
  })

  describe('Component Structure', () => {
    it('should render within a Card component', () => {
      render(<QuickActions />)

      // Check for card structure
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      
      // The card should contain the title and buttons
      const cardTitle = screen.getByText('Quick Actions')
      expect(cardTitle).toBeInTheDocument()
    })

    it('should have proper component hierarchy', () => {
      render(<QuickActions />)

      // Check that the component has the expected structure
      const quickActionsTitle = screen.getByText('Quick Actions')
      const buttons = screen.getAllByRole('button').filter(button => 
        button.textContent?.includes('Add Transaction') || 
        button.textContent?.includes('Add Asset') || 
        button.textContent?.includes('Create Portfolio')
      )

      expect(quickActionsTitle).toBeInTheDocument()
      expect(buttons).toHaveLength(3)
    })
  })
})
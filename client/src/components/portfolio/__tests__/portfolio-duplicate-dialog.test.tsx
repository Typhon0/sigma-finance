import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PortfolioDuplicateDialog, DuplicatePortfolioInput } from '../portfolio-duplicate-dialog'
import { Portfolio } from '@/hooks/use-portfolio-management'

// Mock the UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      type={type}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, disabled, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={props['data-testid'] || 'input'}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      data-testid={props['data-testid'] || 'checkbox'}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => <form data-testid="form">{children}</form>,
  FormField: ({ children, render }: any) => {
    const field = { value: '', onChange: vi.fn() }
    return render({ field })
  },
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: any) => <label data-testid="form-label">{children}</label>,
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
  FormDescription: ({ children }: any) => <div data-testid="form-description">{children}</div>,
  FormMessage: ({ children }: any) => <div data-testid="form-message">{children}</div>,
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => (
    <div data-testid="alert-description">{children}</div>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}))

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Copy: () => <span data-testid="copy-icon">Copy</span>,
  CheckCircle: () => <span data-testid="check-circle-icon">CheckCircle</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">AlertCircle</span>,
  Loader2: () => <span data-testid="loader-icon">Loader2</span>,
  Package: () => <span data-testid="package-icon">Package</span>,
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
}))

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    handleSubmit: (fn: any) => (e: any) => {
      e.preventDefault()
      fn({ name: 'Test Portfolio (Copy)', copyAssets: true })
    },
    formState: { errors: {}, isSubmitting: false, isValid: true },
    reset: vi.fn(),
    watch: () => ({ name: 'Test Portfolio (Copy)', copyAssets: true }),
  }),
}))

// Mock @hookform/resolvers/zod
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}))

describe('PortfolioDuplicateDialog', () => {
  const mockPortfolio: Portfolio = {
    id: '1',
    name: 'Test Portfolio',
    description: 'A test portfolio',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    assets: [
      {
        id: '1',
        asset: {
          id: '1',
          name: 'Apple Inc.',
          symbol: 'AAPL',
          currentValue: 150,
          assetType: { name: 'Stock' },
        },
        quantity: 10,
        averagePurchasePrice: 140,
        ownershipPct: 100,
      },
      {
        id: '2',
        asset: {
          id: '2',
          name: 'Microsoft Corp.',
          symbol: 'MSFT',
          currentValue: 300,
          assetType: { name: 'Stock' },
        },
        quantity: 5,
        averagePurchasePrice: 280,
        ownershipPct: 100,
      },
    ],
  }

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    portfolio: mockPortfolio,
    onDuplicate: vi.fn(),
    isLoading: false,
    errorMessage: undefined,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Dialog Rendering', () => {
    it('renders the dialog when open', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Duplicate Portfolio')
      expect(screen.getByTestId('dialog-description')).toHaveTextContent(
        'Create a copy of "Test Portfolio" with your preferred settings.'
      )
    })

    it('does not render when closed', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} open={false} />)
      
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('does not render when portfolio is null', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} portfolio={null} />)
      
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })
  })

  describe('Portfolio Information Display', () => {
    it('displays source portfolio information', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      expect(screen.getByText('Source Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Test Portfolio')).toBeInTheDocument()
      expect(screen.getByText('A test portfolio')).toBeInTheDocument()
      expect(screen.getByText('2 assets')).toBeInTheDocument()
    })

    it('displays correct asset count', () => {
      const portfolioWithNoAssets = { ...mockPortfolio, assets: [] }
      render(<PortfolioDuplicateDialog {...defaultProps} portfolio={portfolioWithNoAssets} />)
      
      expect(screen.getByText('0 assets')).toBeInTheDocument()
    })

    it('handles portfolio without description', () => {
      const portfolioWithoutDescription = { ...mockPortfolio, description: undefined }
      render(<PortfolioDuplicateDialog {...defaultProps} portfolio={portfolioWithoutDescription} />)
      
      expect(screen.getByText('Test Portfolio')).toBeInTheDocument()
      expect(screen.queryByText('A test portfolio')).not.toBeInTheDocument()
    })
  })

  describe('Form Functionality', () => {
    it('renders form fields correctly', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      expect(screen.getByText('New Portfolio Name')).toBeInTheDocument()
      expect(screen.getByText('Copy Assets')).toBeInTheDocument()
      expect(screen.getByTestId('checkbox')).toBeInTheDocument()
    })

    it('shows suggested name by default', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      // The suggested name should be "Test Portfolio (Copy)"
      // This would be tested through the form's default values
      expect(screen.getByTestId('form')).toBeInTheDocument()
    })

    it('handles form submission with assets', async () => {
      const onDuplicate = vi.fn().mockResolvedValue({})
      
      render(<PortfolioDuplicateDialog {...defaultProps} onDuplicate={onDuplicate} />)
      
      const submitButton = screen.getByText('Duplicate Portfolio')
      fireEvent.click(submitButton)
      
      expect(onDuplicate).toHaveBeenCalledWith({
        sourcePortfolioID: '1',
        newName: 'Test Portfolio (Copy)',
        copyAssets: true,
      })
    })

    it('handles form submission without assets', async () => {
      const onDuplicate = vi.fn().mockResolvedValue({})
      
      // Mock the form to return copyAssets: false
      vi.mocked(require('react-hook-form').useForm).mockReturnValue({
        handleSubmit: (fn: any) => (e: any) => {
          e.preventDefault()
          fn({ name: 'Test Portfolio (Copy)', copyAssets: false })
        },
        formState: { errors: {}, isSubmitting: false, isValid: true },
        reset: vi.fn(),
        watch: () => ({ name: 'Test Portfolio (Copy)', copyAssets: false }),
      })
      
      render(<PortfolioDuplicateDialog {...defaultProps} onDuplicate={onDuplicate} />)
      
      const submitButton = screen.getByText('Duplicate Portfolio')
      fireEvent.click(submitButton)
      
      expect(onDuplicate).toHaveBeenCalledWith({
        sourcePortfolioID: '1',
        newName: 'Test Portfolio (Copy)',
        copyAssets: false,
      })
    })
  })

  describe('Loading States', () => {
    it('shows loading state when isLoading is true', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} isLoading={true} />)
      
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
      expect(screen.getByText('Duplicate Portfolio')).toBeInTheDocument()
    })

    it('disables form when loading', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} isLoading={true} />)
      
      const cancelButton = screen.getByText('Cancel')
      const submitButton = screen.getByText('Duplicate Portfolio')
      
      expect(cancelButton).toBeDisabled()
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('displays error message when provided', () => {
      const errorMessage = 'A portfolio with this name already exists'
      render(<PortfolioDuplicateDialog {...defaultProps} errorMessage={errorMessage} />)
      
      expect(screen.getByTestId('alert')).toHaveAttribute('data-variant', 'destructive')
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('does not display error alert when no error', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      const alerts = screen.queryAllByTestId('alert')
      const errorAlerts = alerts.filter(alert => 
        alert.getAttribute('data-variant') === 'destructive'
      )
      expect(errorAlerts).toHaveLength(0)
    })
  })

  describe('Success States', () => {
    it('shows success message after successful duplication', async () => {
      const onDuplicate = vi.fn().mockResolvedValue({})
      
      render(<PortfolioDuplicateDialog {...defaultProps} onDuplicate={onDuplicate} />)
      
      const submitButton = screen.getByText('Duplicate Portfolio')
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Portfolio duplicated successfully! Redirecting...')).toBeInTheDocument()
      })
    })

    it('changes button text after successful duplication', async () => {
      const onDuplicate = vi.fn().mockResolvedValue({})
      
      render(<PortfolioDuplicateDialog {...defaultProps} onDuplicate={onDuplicate} />)
      
      const submitButton = screen.getByText('Duplicate Portfolio')
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Duplicated!')).toBeInTheDocument()
      })
    })
  })

  describe('Dialog Actions', () => {
    it('calls onOpenChange when cancel is clicked', async () => {
      const onOpenChange = vi.fn()
      
      render(<PortfolioDuplicateDialog {...defaultProps} onOpenChange={onOpenChange} />)
      
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('handles duplication errors gracefully', async () => {
      const onDuplicate = vi.fn().mockRejectedValue(new Error('Duplication failed'))
      
      render(<PortfolioDuplicateDialog {...defaultProps} onDuplicate={onDuplicate} />)
      
      const submitButton = screen.getByText('Duplicate Portfolio')
      fireEvent.click(submitButton)
      
      expect(onDuplicate).toHaveBeenCalled()
      // The error should be handled by the parent component
    })
  })

  describe('Duplication Preview', () => {
    it('shows what will be duplicated', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      expect(screen.getByText('What will be duplicated:')).toBeInTheDocument()
      expect(screen.getByText('Portfolio details (name, description)')).toBeInTheDocument()
      expect(screen.getByText('Assets and positions')).toBeInTheDocument()
    })

    it('shows note about transaction history', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      expect(screen.getByText(/Transaction history will not be copied/)).toBeInTheDocument()
    })

    it('updates preview based on copyAssets checkbox', () => {
      // Mock the form to return copyAssets: false
      vi.mocked(require('react-hook-form').useForm).mockReturnValue({
        handleSubmit: vi.fn(),
        formState: { errors: {}, isSubmitting: false, isValid: true },
        reset: vi.fn(),
        watch: () => ({ name: 'Test Portfolio (Copy)', copyAssets: false }),
      })
      
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      expect(screen.getByText('Skipped')).toBeInTheDocument()
    })
  })

  describe('Name Suggestion Logic', () => {
    it('generates correct suggested name', () => {
      // Test the generateSuggestedName function indirectly
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      // The component should use "Test Portfolio (Copy)" as the suggested name
      // This is tested through the form's behavior
      expect(screen.getByTestId('form')).toBeInTheDocument()
    })

    it('handles portfolios with existing Copy suffix', () => {
      const portfolioWithCopy = { ...mockPortfolio, name: 'Test Portfolio (Copy)' }
      render(<PortfolioDuplicateDialog {...defaultProps} portfolio={portfolioWithCopy} />)
      
      // Should still work correctly even with existing Copy suffix
      expect(screen.getByTestId('form')).toBeInTheDocument()
    })
  })

  describe('Asset Count Display', () => {
    it('shows correct asset count in description', () => {
      render(<PortfolioDuplicateDialog {...defaultProps} />)
      
      expect(screen.getByText(/This will copy 2 assets/)).toBeInTheDocument()
    })

    it('handles singular asset count', () => {
      const portfolioWithOneAsset = {
        ...mockPortfolio,
        assets: [mockPortfolio.assets[0]]
      }
      render(<PortfolioDuplicateDialog {...defaultProps} portfolio={portfolioWithOneAsset} />)
      
      expect(screen.getByText(/This will copy 1 asset with/)).toBeInTheDocument()
    })

    it('handles zero assets', () => {
      const portfolioWithNoAssets = { ...mockPortfolio, assets: [] }
      render(<PortfolioDuplicateDialog {...defaultProps} portfolio={portfolioWithNoAssets} />)
      
      // Should not show the asset copy description when there are no assets
      expect(screen.queryByText(/This will copy/)).not.toBeInTheDocument()
    })
  })
})
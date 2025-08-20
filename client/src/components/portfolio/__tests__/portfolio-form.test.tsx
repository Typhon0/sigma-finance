import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock all dependencies first
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    handleSubmit: vi.fn(() => vi.fn()),
    formState: { errors: {}, isSubmitting: false, isDirty: false, isValid: true },
    reset: vi.fn(),
    watch: vi.fn(() => ({})),
    control: {},
  }),
}))

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => <div data-testid="form">{children}</div>,
  FormField: ({ render }: any) => render({ field: { value: '', onChange: vi.fn() } }),
  FormItem: ({ children }: any) => <div>{children}</div>,
  FormLabel: ({ children }: any) => <label>{children}</label>,
  FormControl: ({ children }: any) => <div>{children}</div>,
  FormDescription: ({ children }: any) => <p>{children}</p>,
  FormMessage: () => null,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/confirmation-dialog', () => ({
  ConfirmationDialog: () => null,
}))

vi.mock('lucide-react', () => ({
  Loader2: () => <span>Loading</span>,
  CheckCircle: () => <span>Success</span>,
  AlertCircle: () => <span>Alert</span>,
}))

// Import the component after mocks
import { PortfolioForm } from '../portfolio-form'

describe('PortfolioForm', () => {

  it('renders basic form structure', () => {
    const mockProps = {
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    }

    render(<PortfolioForm {...mockProps} />)

    expect(screen.getByTestId('form')).toBeInTheDocument()
    expect(screen.getByText('Portfolio Name')).toBeInTheDocument()
    expect(screen.getByText('Description (Optional)')).toBeInTheDocument()
  })

  it('shows create button for new portfolio', () => {
    const mockProps = {
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    }

    render(<PortfolioForm {...mockProps} />)

    expect(screen.getByRole('button', { name: /create portfolio/i })).toBeInTheDocument()
  })

  it('shows update button for existing portfolio', () => {
    const mockProps = {
      portfolio: { name: 'Test Portfolio', description: 'Test Description' },
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    }

    render(<PortfolioForm {...mockProps} />)

    expect(screen.getByRole('button', { name: /update portfolio/i })).toBeInTheDocument()
  })

  it('shows success message when showSuccessMessage is true', () => {
    const mockProps = {
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
      showSuccessMessage: true,
    }

    render(<PortfolioForm {...mockProps} />)

    expect(screen.getByTestId('alert')).toBeInTheDocument()
    expect(screen.getByText(/created successfully/i)).toBeInTheDocument()
  })

  it('shows error message when errorMessage is provided', () => {
    const mockProps = {
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
      errorMessage: 'Something went wrong',
    }

    render(<PortfolioForm {...mockProps} />)

    expect(screen.getByTestId('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})


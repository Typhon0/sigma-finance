import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MockedProvider } from '@apollo/client/testing'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import PortfoliosPage from '../portfolios'

// Mock the auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' }
  })
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}))

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

// Mock sidebar components
vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar">Sidebar</div>,
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: any) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarInset: ({ children }: any) => <div data-testid="sidebar-inset">{children}</div>,
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle</button>,
}))

vi.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: ({ children }: any) => <nav data-testid="breadcrumb">{children}</nav>,
  BreadcrumbList: ({ children }: any) => <ol data-testid="breadcrumb-list">{children}</ol>,
  BreadcrumbItem: ({ children }: any) => <li data-testid="breadcrumb-item">{children}</li>,
  BreadcrumbLink: ({ children, href }: any) => <a href={href} data-testid="breadcrumb-link">{children}</a>,
  BreadcrumbPage: ({ children }: any) => <span data-testid="breadcrumb-page">{children}</span>,
  BreadcrumbSeparator: () => <span data-testid="breadcrumb-separator">/</span>,
}))

const GET_PORTFOLIOS_QUERY = `
  query GetPortfoliosWithAnalytics($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      description
      createdAt
      updatedAt
      assets {
        id
        asset {
          id
          name
          symbol
          currentValue
          assetType {
            name
          }
        }
        quantity
        averagePurchasePrice
        ownershipPct
      }
    }
  }
`

const DUPLICATE_PORTFOLIO_MUTATION = `
  mutation DuplicatePortfolio($input: DuplicatePortfolioInput!) {
    duplicatePortfolio(input: $input) {
      id
      name
      description
      createdAt
      updatedAt
      assets {
        id
        asset {
          id
          name
          symbol
          currentValue
          assetType {
            name
          }
        }
        quantity
        averagePurchasePrice
        ownershipPct
      }
    }
  }
`

describe('Portfolio Duplication Integration', () => {
  const mockPortfolios = [
    {
      id: '1',
      name: 'Growth Portfolio',
      description: 'High growth stocks',
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
    },
    {
      id: '2',
      name: 'Conservative Portfolio',
      description: 'Low risk investments',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      assets: [],
    },
  ]

  const duplicatedPortfolio = {
    id: '3',
    name: 'Growth Portfolio (Copy)',
    description: 'High growth stocks',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    assets: [
      {
        id: '3',
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
        id: '4',
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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful Duplication Flow', () => {
    it('completes full duplication workflow with assets', async () => {
      const user = userEvent.setup()
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Growth Portfolio (Copy)',
                copyAssets: true,
              },
            },
          },
          result: {
            data: {
              duplicatePortfolio: duplicatedPortfolio,
            },
          },
        },
      ]

      render(
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            <PortfoliosPage />
          </MockedProvider>
        </BrowserRouter>
      )

      // Wait for portfolios to load
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Find and click the duplicate button for the first portfolio
      const portfolioCards = screen.getAllByTestId('portfolio-card')
      const firstCard = portfolioCards[0]
      
      // Click the dropdown menu
      const dropdownTrigger = firstCard.querySelector('[data-testid="dropdown-trigger"]')
      await user.click(dropdownTrigger!)

      // Click duplicate option
      const duplicateOption = screen.getByText('Duplicate')
      await user.click(duplicateOption)

      // Verify duplicate dialog opens
      await waitFor(() => {
        expect(screen.getByText('Duplicate Portfolio')).toBeInTheDocument()
      })

      // Verify source portfolio information is displayed
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('High growth stocks')).toBeInTheDocument()
      expect(screen.getByText('2 assets')).toBeInTheDocument()

      // Verify suggested name is populated
      const nameInput = screen.getByDisplayValue('Growth Portfolio (Copy)')
      expect(nameInput).toBeInTheDocument()

      // Verify copy assets checkbox is checked by default
      const copyAssetsCheckbox = screen.getByRole('checkbox', { name: /copy assets/i })
      expect(copyAssetsCheckbox).toBeChecked()

      // Submit the form
      const duplicateButton = screen.getByRole('button', { name: 'Duplicate Portfolio' })
      await user.click(duplicateButton)

      // Verify success message appears
      await waitFor(() => {
        expect(screen.getByText('Portfolio duplicated successfully! Redirecting...')).toBeInTheDocument()
      })

      // Verify button text changes
      expect(screen.getByText('Duplicated!')).toBeInTheDocument()

      // Verify dialog closes after delay
      await waitFor(() => {
        expect(screen.queryByText('Duplicate Portfolio')).not.toBeInTheDocument()
      }, { timeout: 2000 })

      // Verify new portfolio appears in the list
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio (Copy)')).toBeInTheDocument()
      })

      // Verify toast notification
      const { toast } = require('sonner')
      expect(toast.success).toHaveBeenCalledWith(
        'Portfolio duplicated successfully',
        expect.objectContaining({
          description: 'Created "Growth Portfolio (Copy)" with assets copied',
        })
      )
    })

    it('completes duplication workflow without assets', async () => {
      const user = userEvent.setup()
      
      const duplicatedPortfolioNoAssets = {
        ...duplicatedPortfolio,
        name: 'Empty Copy',
        assets: [],
      }

      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Empty Copy',
                copyAssets: false,
              },
            },
          },
          result: {
            data: {
              duplicatePortfolio: duplicatedPortfolioNoAssets,
            },
          },
        },
      ]

      render(
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            <PortfoliosPage />
          </MockedProvider>
        </BrowserRouter>
      )

      // Wait for portfolios to load
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Open duplicate dialog
      const portfolioCards = screen.getAllByTestId('portfolio-card')
      const firstCard = portfolioCards[0]
      const dropdownTrigger = firstCard.querySelector('[data-testid="dropdown-trigger"]')
      await user.click(dropdownTrigger!)
      
      const duplicateOption = screen.getByText('Duplicate')
      await user.click(duplicateOption)

      // Wait for dialog to open
      await waitFor(() => {
        expect(screen.getByText('Duplicate Portfolio')).toBeInTheDocument()
      })

      // Change the name
      const nameInput = screen.getByDisplayValue('Growth Portfolio (Copy)')
      await user.clear(nameInput)
      await user.type(nameInput, 'Empty Copy')

      // Uncheck copy assets
      const copyAssetsCheckbox = screen.getByRole('checkbox', { name: /copy assets/i })
      await user.click(copyAssetsCheckbox)

      // Verify preview updates
      expect(screen.getByText('Skipped')).toBeInTheDocument()

      // Submit the form
      const duplicateButton = screen.getByRole('button', { name: 'Duplicate Portfolio' })
      await user.click(duplicateButton)

      // Verify success
      await waitFor(() => {
        expect(screen.getByText('Portfolio duplicated successfully! Redirecting...')).toBeInTheDocument()
      })

      // Verify toast notification
      const { toast } = require('sonner')
      expect(toast.success).toHaveBeenCalledWith(
        'Portfolio duplicated successfully',
        expect.objectContaining({
          description: 'Created "Empty Copy" with no assets',
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('handles name conflict errors', async () => {
      const user = userEvent.setup()
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Conservative Portfolio', // Existing name
                copyAssets: true,
              },
            },
          },
          error: new Error('Portfolio name already exists'),
        },
      ]

      render(
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            <PortfoliosPage />
          </MockedProvider>
        </BrowserRouter>
      )

      // Wait for portfolios to load
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      // Open duplicate dialog
      const portfolioCards = screen.getAllByTestId('portfolio-card')
      const firstCard = portfolioCards[0]
      const dropdownTrigger = firstCard.querySelector('[data-testid="dropdown-trigger"]')
      await user.click(dropdownTrigger!)
      
      const duplicateOption = screen.getByText('Duplicate')
      await user.click(duplicateOption)

      // Wait for dialog to open
      await waitFor(() => {
        expect(screen.getByText('Duplicate Portfolio')).toBeInTheDocument()
      })

      // Change name to existing portfolio name
      const nameInput = screen.getByDisplayValue('Growth Portfolio (Copy)')
      await user.clear(nameInput)
      await user.type(nameInput, 'Conservative Portfolio')

      // Submit the form
      const duplicateButton = screen.getByRole('button', { name: 'Duplicate Portfolio' })
      await user.click(duplicateButton)

      // Verify error message appears
      await waitFor(() => {
        expect(screen.getByText('A portfolio with this name already exists. Please choose a different name.')).toBeInTheDocument()
      })

      // Verify dialog remains open
      expect(screen.getByText('Duplicate Portfolio')).toBeInTheDocument()

      // Verify no success toast
      const { toast } = require('sonner')
      expect(toast.success).not.toHaveBeenCalled()
    })

    it('handles validation errors', async () => {
      const user = userEvent.setup()
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'AB', // Too short
                copyAssets: true,
              },
            },
          },
          error: new Error('Validation failed'),
        },
      ]

      render(
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            <PortfoliosPage />
          </MockedProvider>
        </BrowserRouter>
      )

      // Wait for portfolios to load and open dialog
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      const portfolioCards = screen.getAllByTestId('portfolio-card')
      const firstCard = portfolioCards[0]
      const dropdownTrigger = firstCard.querySelector('[data-testid="dropdown-trigger"]')
      await user.click(dropdownTrigger!)
      
      const duplicateOption = screen.getByText('Duplicate')
      await user.click(duplicateOption)

      await waitFor(() => {
        expect(screen.getByText('Duplicate Portfolio')).toBeInTheDocument()
      })

      // Enter invalid name
      const nameInput = screen.getByDisplayValue('Growth Portfolio (Copy)')
      await user.clear(nameInput)
      await user.type(nameInput, 'AB')

      // Submit the form
      const duplicateButton = screen.getByRole('button', { name: 'Duplicate Portfolio' })
      await user.click(duplicateButton)

      // Verify error message appears
      await waitFor(() => {
        expect(screen.getByText('Invalid portfolio data. Please check your inputs and try again.')).toBeInTheDocument()
      })
    })

    it('handles network errors', async () => {
      const user = userEvent.setup()
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Network Error Test',
                copyAssets: true,
              },
            },
          },
          networkError: new Error('Network error'),
        },
      ]

      render(
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            <PortfoliosPage />
          </MockedProvider>
        </BrowserRouter>
      )

      // Wait for portfolios to load and open dialog
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      const portfolioCards = screen.getAllByTestId('portfolio-card')
      const firstCard = portfolioCards[0]
      const dropdownTrigger = firstCard.querySelector('[data-testid="dropdown-trigger"]')
      await user.click(dropdownTrigger!)
      
      const duplicateOption = screen.getByText('Duplicate')
      await user.click(duplicateOption)

      await waitFor(() => {
        expect(screen.getByText('Duplicate Portfolio')).toBeInTheDocument()
      })

      // Change name
      const nameInput = screen.getByDisplayValue('Growth Portfolio (Copy)')
      await user.clear(nameInput)
      await user.type(nameInput, 'Network Error Test')

      // Submit the form
      const duplicateButton = screen.getByRole('button', { name: 'Duplicate Portfolio' })
      await user.click(duplicateButton)

      // Verify generic error message appears
      await waitFor(() => {
        expect(screen.getByText('Failed to duplicate portfolio. Please try again.')).toBeInTheDocument()
      })
    })
  })

  describe('User Experience', () => {
    it('shows loading states during duplication', async () => {
      const user = userEvent.setup()
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
        {
          request: {
            query: DUPLICATE_PORTFOLIO_MUTATION,
            variables: {
              input: {
                sourcePortfolioID: '1',
                newName: 'Loading Test',
                copyAssets: true,
              },
            },
          },
          result: {
            data: {
              duplicatePortfolio: {
                ...duplicatedPortfolio,
                name: 'Loading Test',
              },
            },
          },
          delay: 1000, // Simulate slow network
        },
      ]

      render(
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            <PortfoliosPage />
          </MockedProvider>
        </BrowserRouter>
      )

      // Open dialog and submit
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      const portfolioCards = screen.getAllByTestId('portfolio-card')
      const firstCard = portfolioCards[0]
      const dropdownTrigger = firstCard.querySelector('[data-testid="dropdown-trigger"]')
      await user.click(dropdownTrigger!)
      
      const duplicateOption = screen.getByText('Duplicate')
      await user.click(duplicateOption)

      await waitFor(() => {
        expect(screen.getByText('Duplicate Portfolio')).toBeInTheDocument()
      })

      const nameInput = screen.getByDisplayValue('Growth Portfolio (Copy)')
      await user.clear(nameInput)
      await user.type(nameInput, 'Loading Test')

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate Portfolio' })
      await user.click(duplicateButton)

      // Verify loading state
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
      expect(duplicateButton).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Duplicated!')).toBeInTheDocument()
      })
    })

    it('allows canceling the duplication dialog', async () => {
      const user = userEvent.setup()
      
      const mocks = [
        {
          request: {
            query: GET_PORTFOLIOS_QUERY,
            variables: { userID: 'user-1' },
          },
          result: {
            data: {
              portfolios: mockPortfolios,
            },
          },
        },
      ]

      render(
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            <PortfoliosPage />
          </MockedProvider>
        </BrowserRouter>
      )

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })

      const portfolioCards = screen.getAllByTestId('portfolio-card')
      const firstCard = portfolioCards[0]
      const dropdownTrigger = firstCard.querySelector('[data-testid="dropdown-trigger"]')
      await user.click(dropdownTrigger!)
      
      const duplicateOption = screen.getByText('Duplicate')
      await user.click(duplicateOption)

      await waitFor(() => {
        expect(screen.getByText('Duplicate Portfolio')).toBeInTheDocument()
      })

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)

      // Verify dialog closes
      await waitFor(() => {
        expect(screen.queryByText('Duplicate Portfolio')).not.toBeInTheDocument()
      })
    })
  })
})
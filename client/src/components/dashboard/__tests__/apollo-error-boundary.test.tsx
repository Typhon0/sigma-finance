import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApolloError } from '@apollo/client'
import { ApolloErrorBoundary, useApolloErrorBoundary } from '../apollo-error-boundary'
import { renderHook, act } from '@testing-library/react'

describe('ApolloErrorBoundary', () => {
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    mockOnRetry.mockClear()
  })

  it('should render network error UI', () => {
    const networkError = new ApolloError({
      networkError: new Error('Failed to fetch'),
      errorMessage: 'Network error',
    })

    render(
      <ApolloErrorBoundary
        error={networkError}
        onRetry={mockOnRetry}
        sectionName="Test Section"
      />
    )

    expect(screen.getByText('Connection Error')).toBeInTheDocument()
    expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /check connection/i })).toBeInTheDocument()
  })

  it('should render GraphQL error UI', () => {
    const graphqlError = new ApolloError({
      graphQLErrors: [{ message: 'Field validation failed' } as any],
      errorMessage: 'GraphQL error',
    })

    render(
      <ApolloErrorBoundary
        error={graphqlError}
        onRetry={mockOnRetry}
        sectionName="Test Section"
      />
    )

    expect(screen.getByText('Data Error')).toBeInTheDocument()
    expect(screen.getByText(/There was an issue retrieving your data/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check connection/i })).not.toBeInTheDocument()
  })

  it('should render generic error UI', () => {
    const genericError = new ApolloError({
      errorMessage: 'Something went wrong',
    })

    render(
      <ApolloErrorBoundary
        error={genericError}
        onRetry={mockOnRetry}
        sectionName="Test Section"
      />
    )

    expect(screen.getByText('Error loading Test Section')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should call onRetry when retry button is clicked', () => {
    const error = new ApolloError({
      errorMessage: 'Test error',
    })

    render(
      <ApolloErrorBoundary
        error={error}
        onRetry={mockOnRetry}
      />
    )

    const retryButton = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryButton)

    expect(mockOnRetry).toHaveBeenCalledOnce()
  })

  it('should disable retry button when loading', () => {
    const error = new ApolloError({
      errorMessage: 'Test error',
    })

    render(
      <ApolloErrorBoundary
        error={error}
        onRetry={mockOnRetry}
        loading={true}
      />
    )

    const retryButton = screen.getByRole('button', { name: /retrying/i })
    expect(retryButton).toBeDisabled()
  })

  it('should show development error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const error = new ApolloError({
      networkError: new Error('Network failed'),
      graphQLErrors: [{ message: 'GraphQL error' } as any],
      errorMessage: 'Combined error',
    })

    render(
      <ApolloErrorBoundary
        error={error}
        onRetry={mockOnRetry}
      />
    )

    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('should handle check connection button for network errors', () => {
    const networkError = new ApolloError({
      networkError: new Error('Failed to fetch'),
      errorMessage: 'Network error',
    })

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })

    render(
      <ApolloErrorBoundary
        error={networkError}
        onRetry={mockOnRetry}
      />
    )

    const checkConnectionButton = screen.getByRole('button', { name: /check connection/i })
    fireEvent.click(checkConnectionButton)

    expect(mockOnRetry).toHaveBeenCalledOnce()
  })

  it('should show offline alert when checking connection while offline', () => {
    const networkError = new ApolloError({
      networkError: new Error('Failed to fetch'),
      errorMessage: 'Network error',
    })

    // Mock navigator.onLine as false
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    })

    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(
      <ApolloErrorBoundary
        error={networkError}
        onRetry={mockOnRetry}
      />
    )

    const checkConnectionButton = screen.getByRole('button', { name: /check connection/i })
    fireEvent.click(checkConnectionButton)

    expect(alertSpy).toHaveBeenCalledWith('You appear to be offline. Please check your internet connection.')
    expect(mockOnRetry).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })
})

describe('useApolloErrorBoundary', () => {
  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useApolloErrorBoundary())

    expect(result.current.retryCount).toBe(0)
    expect(result.current.maxRetries).toBe(3)
    expect(result.current.isRetrying).toBe(false)
    expect(result.current.canRetry).toBe(true)
  })

  it('should handle retry with refetch function', async () => {
    const mockRefetch = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() => useApolloErrorBoundary(mockRefetch, 2))

    await act(async () => {
      await result.current.handleRetry()
    })

    expect(mockRefetch).toHaveBeenCalledOnce()
    expect(result.current.retryCount).toBe(1)
    expect(result.current.isRetrying).toBe(false)
  })

  it('should handle retry failure', async () => {
    const mockRefetch = vi.fn().mockRejectedValue(new Error('Refetch failed'))
    const { result } = renderHook(() => useApolloErrorBoundary(mockRefetch))

    await act(async () => {
      await result.current.handleRetry()
    })

    expect(result.current.retryCount).toBe(1)
    expect(result.current.isRetrying).toBe(false)
  })

  it('should respect max retries limit', async () => {
    const mockRefetch = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() => useApolloErrorBoundary(mockRefetch, 2))

    // Exhaust retries
    await act(async () => {
      await result.current.handleRetry() // retry 1
    })
    await act(async () => {
      await result.current.handleRetry() // retry 2
    })

    expect(result.current.canRetry).toBe(false)

    // Should not call refetch again
    await act(async () => {
      await result.current.handleRetry()
    })

    expect(mockRefetch).toHaveBeenCalledTimes(2)
  })

  it('should reset retry state', () => {
    const { result } = renderHook(() => useApolloErrorBoundary())

    act(() => {
      // Simulate some retries
      result.current.handleRetry()
    })

    act(() => {
      result.current.resetRetry()
    })

    expect(result.current.retryCount).toBe(0)
    expect(result.current.isRetrying).toBe(false)
  })

  it('should not retry without refetch function', async () => {
    const { result } = renderHook(() => useApolloErrorBoundary())

    await act(async () => {
      await result.current.handleRetry()
    })

    expect(result.current.retryCount).toBe(0) // Should not increment without refetch
  })

  it('should handle concurrent retry attempts', async () => {
    const mockRefetch = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Second attempt failed'))
    
    const { result } = renderHook(() => useApolloErrorBoundary(mockRefetch, 5))

    // First retry should succeed
    await act(async () => {
      await result.current.handleRetry()
    })
    expect(result.current.retryCount).toBe(1)

    // Second retry should fail
    await act(async () => {
      await result.current.handleRetry()
    })
    expect(result.current.retryCount).toBe(2)
    expect(mockRefetch).toHaveBeenCalledTimes(2)
  })

  it('should set isRetrying state correctly during retry', async () => {
    let resolveRefetch: () => void
    const mockRefetch = vi.fn(() => new Promise<void>(resolve => {
      resolveRefetch = resolve
    }))
    
    const { result } = renderHook(() => useApolloErrorBoundary(mockRefetch))

    // Start retry
    const retryPromise = act(async () => {
      await result.current.handleRetry()
    })

    // Should be retrying
    expect(result.current.isRetrying).toBe(true)

    // Resolve the refetch
    resolveRefetch!()
    await retryPromise

    // Should no longer be retrying
    expect(result.current.isRetrying).toBe(false)
  })
})

// Comprehensive error boundary integration tests
describe('Apollo Error Boundary Integration', () => {
  const MockApolloComponent = ({ 
    error, 
    loading, 
    onRetry 
  }: { 
    error?: ApolloError | null
    loading?: boolean
    onRetry: () => void 
  }) => {
    if (error) {
      return (
        <ApolloErrorBoundary
          error={error}
          onRetry={onRetry}
          loading={loading}
          sectionName="Mock Section"
        />
      )
    }
    return <div>Data loaded successfully</div>
  }

  it('should handle network error recovery flow', async () => {
    const onRetry = vi.fn()
    let hasError = true
    
    const networkError = new ApolloError({
      networkError: new Error('Failed to fetch'),
      errorMessage: 'Network error',
    })

    const { rerender } = render(
      <MockApolloComponent 
        error={hasError ? networkError : null} 
        onRetry={onRetry}
      />
    )

    // Should show network error
    expect(screen.getByText('Connection Error')).toBeInTheDocument()

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()

    // Simulate successful retry
    hasError = false
    rerender(
      <MockApolloComponent 
        error={hasError ? networkError : null} 
        onRetry={onRetry}
      />
    )

    expect(screen.getByText('Data loaded successfully')).toBeInTheDocument()
  })

  it('should handle GraphQL error recovery flow', async () => {
    const onRetry = vi.fn()
    let hasError = true
    
    const graphqlError = new ApolloError({
      graphQLErrors: [{ message: 'Validation failed' } as any],
      errorMessage: 'GraphQL error',
    })

    const { rerender } = render(
      <MockApolloComponent 
        error={hasError ? graphqlError : null} 
        onRetry={onRetry}
      />
    )

    // Should show GraphQL error
    expect(screen.getByText('Data Error')).toBeInTheDocument()

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()

    // Simulate successful retry
    hasError = false
    rerender(
      <MockApolloComponent 
        error={hasError ? graphqlError : null} 
        onRetry={onRetry}
      />
    )

    expect(screen.getByText('Data loaded successfully')).toBeInTheDocument()
  })

  it('should show loading state during retry', () => {
    const error = new ApolloError({
      errorMessage: 'Test error',
    })

    render(
      <MockApolloComponent 
        error={error} 
        loading={true}
        onRetry={vi.fn()}
      />
    )

    const retryButton = screen.getByRole('button', { name: /retrying/i })
    expect(retryButton).toBeDisabled()
    expect(retryButton).toHaveTextContent('Retrying...')
  })

  it('should handle mixed error types in dashboard sections', () => {
    const networkError = new ApolloError({
      networkError: new Error('Network failed'),
      errorMessage: 'Network error',
    })

    const graphqlError = new ApolloError({
      graphQLErrors: [{ message: 'GraphQL failed' } as any],
      errorMessage: 'GraphQL error',
    })

    render(
      <div>
        <div data-testid="section-1">
          <MockApolloComponent error={networkError} onRetry={vi.fn()} />
        </div>
        <div data-testid="section-2">
          <MockApolloComponent error={graphqlError} onRetry={vi.fn()} />
        </div>
        <div data-testid="section-3">
          <MockApolloComponent error={null} onRetry={vi.fn()} />
        </div>
      </div>
    )

    // Section 1 should show network error
    expect(screen.getByText('Connection Error')).toBeInTheDocument()
    
    // Section 2 should show GraphQL error
    expect(screen.getByText('Data Error')).toBeInTheDocument()
    
    // Section 3 should work normally
    expect(screen.getByText('Data loaded successfully')).toBeInTheDocument()

    // Should have 2 retry buttons (one for each error)
    expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(2)
  })
})
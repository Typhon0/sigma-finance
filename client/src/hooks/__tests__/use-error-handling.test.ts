import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ApolloError } from '@apollo/client'
import { 
  useErrorHandling, 
  useApolloErrorHandling,
  isNetworkError,
  isGraphQLError,
  getErrorMessage
} from '../use-error-handling'

// Mock console.error
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  vi.clearAllTimers()
})

describe('useErrorHandling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with no error state', () => {
    const { result } = renderHook(() => useErrorHandling())
    
    expect(result.current.hasError).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.isRetrying).toBe(false)
    expect(result.current.retryCount).toBe(0)
    expect(result.current.canRetry).toBe(true)
  })

  it('should handle errors correctly', () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useErrorHandling({ onError }))
    
    const testError = new Error('Test error')
    
    act(() => {
      result.current.handleError(testError)
    })
    
    expect(result.current.hasError).toBe(true)
    expect(result.current.error).toBe(testError)
    expect(result.current.isRetrying).toBe(false)
    expect(onError).toHaveBeenCalledWith(testError)
    expect(console.error).toHaveBeenCalledWith('Dashboard section error:', testError)
  })

  it('should retry with delay', async () => {
    const retryFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useErrorHandling({ retryDelay: 1000 }))
    
    // Set error state first
    act(() => {
      result.current.handleError(new Error('Test error'))
    })
    
    // Start retry
    act(() => {
      result.current.retry(retryFn)
    })
    
    expect(result.current.isRetrying).toBe(true)
    
    // Fast-forward time
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()
    })
    
    expect(retryFn).toHaveBeenCalled()
    expect(result.current.hasError).toBe(false)
    expect(result.current.isRetrying).toBe(false)
    expect(result.current.retryCount).toBe(0)
  })

  it('should handle retry failures', async () => {
    const retryError = new Error('Retry failed')
    const retryFn = vi.fn().mockRejectedValue(retryError)
    const { result } = renderHook(() => useErrorHandling({ maxRetries: 2 }))
    
    // Set error state first
    act(() => {
      result.current.handleError(new Error('Initial error'))
    })
    
    // Attempt retry
    await act(async () => {
      await result.current.retry(retryFn)
    })
    
    expect(result.current.retryCount).toBe(1)
    expect(result.current.hasError).toBe(true)
    expect(result.current.error).toBe(retryError)
  })

  it('should respect max retries limit', async () => {
    const retryFn = vi.fn().mockRejectedValue(new Error('Always fails'))
    const { result } = renderHook(() => useErrorHandling({ maxRetries: 2 }))
    
    // Set error state
    act(() => {
      result.current.handleError(new Error('Initial error'))
    })
    
    // Exhaust retries
    await act(async () => {
      await result.current.retry(retryFn) // retry 1
    })
    await act(async () => {
      await result.current.retry(retryFn) // retry 2
    })
    
    expect(result.current.retryCount).toBe(2)
    expect(result.current.canRetry).toBe(false)
    
    // Should not retry again
    await act(async () => {
      await result.current.retry(retryFn)
    })
    
    expect(retryFn).toHaveBeenCalledTimes(2) // Should not be called a third time
  })

  it('should clear error state', () => {
    const { result } = renderHook(() => useErrorHandling())
    
    // Set error state
    act(() => {
      result.current.handleError(new Error('Test error'))
    })
    
    expect(result.current.hasError).toBe(true)
    
    // Clear error
    act(() => {
      result.current.clearError()
    })
    
    expect(result.current.hasError).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.retryCount).toBe(0)
  })
})

describe('useApolloErrorHandling', () => {
  it('should handle Apollo errors specifically', () => {
    const { result } = renderHook(() => useApolloErrorHandling())
    
    const apolloError = new ApolloError({
      errorMessage: 'GraphQL error',
      graphQLErrors: [{ message: 'Field error' } as any],
      networkError: null,
    })
    
    act(() => {
      result.current.handleApolloError(apolloError)
    })
    
    expect(result.current.hasError).toBe(true)
    expect(result.current.error).toBe(apolloError)
    expect(result.current.isNetworkError).toBe(false)
    expect(result.current.isGraphQLError).toBe(true)
    expect(result.current.userFriendlyMessage).toBe('Field error')
  })

  it('should identify network errors correctly', () => {
    const { result } = renderHook(() => useApolloErrorHandling())
    
    const networkError = new ApolloError({
      networkError: new Error('Failed to fetch'),
      errorMessage: 'Network error',
    })
    
    act(() => {
      result.current.handleApolloError(networkError)
    })
    
    expect(result.current.isNetworkError).toBe(true)
    expect(result.current.isGraphQLError).toBe(false)
    expect(result.current.userFriendlyMessage).toBe('Unable to connect to server. Please check your internet connection.')
  })

  it('should handle mixed Apollo errors', () => {
    const { result } = renderHook(() => useApolloErrorHandling())
    
    const mixedError = new ApolloError({
      networkError: new Error('Network issue'),
      graphQLErrors: [{ message: 'GraphQL issue' } as any],
      errorMessage: 'Mixed error',
    })
    
    act(() => {
      result.current.handleApolloError(mixedError)
    })
    
    // Network errors take precedence
    expect(result.current.isNetworkError).toBe(true)
    expect(result.current.isGraphQLError).toBe(true)
    expect(result.current.userFriendlyMessage).toBe('Unable to connect to server. Please check your internet connection.')
  })
})

// Comprehensive error handling integration tests
describe('Error handling integration scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should handle cascading failures with different retry strategies', async () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useErrorHandling({ 
      onError, 
      maxRetries: 2,
      retryDelay: 1000 
    }))
    
    // First failure
    const error1 = new Error('First failure')
    act(() => {
      result.current.handleError(error1)
    })
    
    expect(result.current.hasError).toBe(true)
    expect(result.current.retryCount).toBe(0)
    
    // First retry fails
    const retryFn1 = vi.fn().mockRejectedValue(new Error('Retry 1 failed'))
    await act(async () => {
      await result.current.retry(retryFn1)
    })
    
    expect(result.current.retryCount).toBe(1)
    expect(result.current.canRetry).toBe(true)
    
    // Second retry succeeds
    const retryFn2 = vi.fn().mockResolvedValue(undefined)
    await act(async () => {
      await result.current.retry(retryFn2)
    })
    
    expect(result.current.hasError).toBe(false)
    expect(result.current.retryCount).toBe(0)
    expect(onError).toHaveBeenCalledTimes(2) // Original error + retry failure
  })

  it('should handle rapid error succession', () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useErrorHandling({ onError }))
    
    // Rapid succession of errors
    const errors = [
      new Error('Error 1'),
      new Error('Error 2'),
      new Error('Error 3'),
    ]
    
    errors.forEach(error => {
      act(() => {
        result.current.handleError(error)
      })
    })
    
    // Should only track the last error
    expect(result.current.error?.message).toBe('Error 3')
    expect(onError).toHaveBeenCalledTimes(3)
  })

  it('should handle error recovery with state cleanup', async () => {
    const { result } = renderHook(() => useErrorHandling({ retryDelay: 500 }))
    
    // Set error state
    act(() => {
      result.current.handleError(new Error('Test error'))
    })
    
    expect(result.current.hasError).toBe(true)
    
    // Successful retry should clean up state
    const successfulRetry = vi.fn().mockResolvedValue(undefined)
    await act(async () => {
      await result.current.retry(successfulRetry)
    })
    
    expect(result.current.hasError).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.isRetrying).toBe(false)
    expect(result.current.retryCount).toBe(0)
  })

  it('should handle timeout scenarios during retry', async () => {
    const { result } = renderHook(() => useErrorHandling({ retryDelay: 2000 }))
    
    act(() => {
      result.current.handleError(new Error('Timeout test'))
    })
    
    // Start retry with long-running operation
    let resolveRetry: () => void
    const longRunningRetry = vi.fn(() => new Promise<void>(resolve => {
      resolveRetry = resolve
    }))
    
    const retryPromise = act(async () => {
      await result.current.retry(longRunningRetry)
    })
    
    // Should be in retrying state
    expect(result.current.isRetrying).toBe(true)
    
    // Fast-forward past retry delay
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    // Still retrying until operation completes
    expect(result.current.isRetrying).toBe(true)
    
    // Complete the operation
    resolveRetry!()
    await retryPromise
    
    expect(result.current.isRetrying).toBe(false)
    expect(result.current.hasError).toBe(false)
  })

  it('should handle memory cleanup on unmount', () => {
    const { result, unmount } = renderHook(() => useErrorHandling({ retryDelay: 1000 }))
    
    act(() => {
      result.current.handleError(new Error('Cleanup test'))
    })
    
    // Start retry
    const retryFn = vi.fn().mockResolvedValue(undefined)
    act(() => {
      result.current.retry(retryFn)
    })
    
    // Unmount during retry
    unmount()
    
    // Should not cause memory leaks or errors
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    // No assertions needed - test passes if no errors thrown
  })
})

describe('Error utility functions', () => {
  describe('isNetworkError', () => {
    it('should identify Apollo network errors', () => {
      const networkError = new ApolloError({
        networkError: new Error('Network failed'),
        errorMessage: 'Network error',
      })
      
      expect(isNetworkError(networkError)).toBe(true)
    })

    it('should identify generic network errors', () => {
      const networkError = new Error('Network connection failed')
      expect(isNetworkError(networkError)).toBe(true)
      
      const fetchError = new Error('Failed to fetch')
      expect(isNetworkError(fetchError)).toBe(true)
    })

    it('should not identify non-network errors', () => {
      const regularError = new Error('Regular error')
      expect(isNetworkError(regularError)).toBe(false)
      
      const apolloError = new ApolloError({
        graphQLErrors: [{ message: 'GraphQL error' } as any],
        errorMessage: 'GraphQL error',
      })
      expect(isNetworkError(apolloError)).toBe(false)
    })
  })

  describe('isGraphQLError', () => {
    it('should identify Apollo GraphQL errors', () => {
      const graphqlError = new ApolloError({
        graphQLErrors: [{ message: 'Field error' } as any],
        errorMessage: 'GraphQL error',
      })
      
      expect(isGraphQLError(graphqlError)).toBe(true)
    })

    it('should not identify non-GraphQL errors', () => {
      const regularError = new Error('Regular error')
      expect(isGraphQLError(regularError)).toBe(false)
      
      const networkError = new ApolloError({
        networkError: new Error('Network failed'),
        errorMessage: 'Network error',
      })
      expect(isGraphQLError(networkError)).toBe(false)
    })
  })

  describe('getErrorMessage', () => {
    it('should return network error messages', () => {
      const networkError = new ApolloError({
        networkError: new Error('Failed to fetch'),
        errorMessage: 'Network error',
      })
      
      expect(getErrorMessage(networkError)).toBe('Unable to connect to server. Please check your internet connection.')
    })

    it('should return GraphQL error messages', () => {
      const graphqlError = new ApolloError({
        graphQLErrors: [{ message: 'Field validation failed' } as any],
        errorMessage: 'GraphQL error',
      })
      
      expect(getErrorMessage(graphqlError)).toBe('Field validation failed')
    })

    it('should return generic error messages', () => {
      const regularError = new Error('Something went wrong')
      expect(getErrorMessage(regularError)).toBe('Something went wrong')
    })

    it('should return fallback message for empty errors', () => {
      const emptyError = new Error('')
      expect(getErrorMessage(emptyError)).toBe('An unexpected error occurred.')
    })
  })
})
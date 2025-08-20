import React from 'react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ApolloError } from '@apollo/client'
import { DashboardErrorBoundary } from '../dashboard-error-boundary'
import { ApolloErrorBoundary } from '../apollo-error-boundary'
import { SectionErrorWrapper } from '../section-error-wrapper'
import { StaleDataIndicator } from '../stale-data-indicator'
import { useErrorHandling, useApolloErrorHandling } from '@/hooks/use-error-handling'
import { useOfflineStatus } from '@/hooks/use-offline-status'

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error
const originalReportError = (window as any).reportError

beforeEach(() => {
  console.error = vi.fn()
  ;(window as any).reportError = vi.fn()
  navigator.onLine = true
  vi.useFakeTimers()
})

afterEach(() => {
  console.error = originalConsoleError
  ;(window as any).reportError = originalReportError
  vi.useRealTimers()
})

/**
 * Comprehensive integration tests for error handling across dashboard components
 * Tests Requirements 8.4 and 8.5: Error handling and partial loading scenarios
 */
describe('Error Handling Integration Tests', () => {
  // Mock dashboard component that can simulate various error states
  const MockDashboardSection = ({ 
    sectionName,
    shouldFail = false,
    failureType = 'component',
    apolloError = null,
    loading = false,
    onRetry = vi.fn(),
    children = null
  }: {
    sectionName: string
    shouldFail?: boolean
    failureType?: 'component' | 'apollo'
    apolloError?: ApolloError | null
    loading?: boolean
    onRetry?: () => void
    children?: React.ReactNode
  }) => {
    const errorHandling = useErrorHandling()

    React.useEffect(() => {
      if (shouldFail && failureType === 'component') {
        errorHandling.handleError(new Error(`${sectionName} component error`))
      }
    }, [shouldFail, failureType, sectionName])

    if (failureType === 'apollo' && apolloError) {
      return (
        <SectionErrorWrapper
          sectionName={sectionName}
          error={apolloError}
          loading={loading}
          onRetry={onRetry}
        >
          {children || <div>{sectionName} content</div>}
        </SectionErrorWrapper>
      )
    }

    if (errorHandling.hasError) {
      return (
        <SectionErrorWrapper
          sectionName={sectionName}
          error={errorHandling.error}
          onRetry={() => {
            errorHandling.clearError()
            onRetry()
          }}
        >
          {children || <div>{sectionName} content</div>}
        </SectionErrorWrapper>
      )
    }

    return (
      <DashboardErrorBoundary sectionName={sectionName} onRetry={onRetry}>
        {children || <div>{sectionName} content</div>}
      </DashboardErrorBoundary>
    )
  }

  describe('Partial Loading Scenarios', () => {
    it('should allow partial dashboard functionality when some sections fail', () => {
      const networkError = new ApolloError({
        networkError: new Error('Failed to fetch portfolio data'),
        errorMessage: 'Network error',
      })

      const graphqlError = new ApolloError({
        graphQLErrors: [{ message: 'Invalid user permissions' } as any],
        errorMessage: 'GraphQL error',
      })

      render(
        <div data-testid="dashboard">
          <MockDashboardSection 
            sectionName="Portfolio Overview"
            failureType="apollo"
            apolloError={networkError}
          />
          
          <MockDashboardSection 
            sectionName="Asset Performance"
            failureType="apollo"
            apolloError={graphqlError}
          />
          
          <MockDashboardSection 
            sectionName="Recent Transactions"
            shouldFail={false}
          />
          
          <MockDashboardSection 
            sectionName="Quick Actions"
            shouldFail={false}
          />
        </div>
      )

      // Portfolio Overview should show network error
      expect(screen.getByText('Connection Error')).toBeInTheDocument()
      expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument()

      // Asset Performance should show GraphQL error
      expect(screen.getByText('Data Error')).toBeInTheDocument()
      expect(screen.getByText(/There was an issue retrieving your data/)).toBeInTheDocument()

      // Working sections should display normally
      expect(screen.getByText('Recent Transactions content')).toBeInTheDocument()
      expect(screen.getByText('Quick Actions content')).toBeInTheDocument()

      // Should have retry buttons for failed sections only
      const retryButtons = screen.getAllByRole('button', { name: /retry/i })
      expect(retryButtons).toHaveLength(2)
    })

    it('should handle progressive section recovery', async () => {
      const onRetryPortfolio = vi.fn()
      const onRetryAssets = vi.fn()

      let portfolioFixed = false
      let assetsFixed = false

      const { rerender } = render(
        <div>
          <MockDashboardSection 
            sectionName="Portfolio Overview"
            shouldFail={!portfolioFixed}
            onRetry={onRetryPortfolio}
          />
          
          <MockDashboardSection 
            sectionName="Asset Performance"
            shouldFail={!assetsFixed}
            onRetry={onRetryAssets}
          />
        </div>
      )

      // Both sections should show errors initially
      expect(screen.getAllByText(/Section Error/)).toHaveLength(2)

      // Fix portfolio section
      portfolioFixed = true
      const portfolioRetryButton = screen.getAllByRole('button', { name: /retry/i })[0]
      fireEvent.click(portfolioRetryButton)

      rerender(
        <div>
          <MockDashboardSection 
            sectionName="Portfolio Overview"
            shouldFail={!portfolioFixed}
            onRetry={onRetryPortfolio}
          />
          
          <MockDashboardSection 
            sectionName="Asset Performance"
            shouldFail={!assetsFixed}
            onRetry={onRetryAssets}
          />
        </div>
      )

      // Portfolio should be fixed, assets still broken
      expect(screen.getByText('Portfolio Overview content')).toBeInTheDocument()
      expect(screen.getByText(/Error loading Asset Performance/)).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(1)

      // Fix assets section
      assetsFixed = true
      const assetsRetryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(assetsRetryButton)

      rerender(
        <div>
          <MockDashboardSection 
            sectionName="Portfolio Overview"
            shouldFail={!portfolioFixed}
            onRetry={onRetryPortfolio}
          />
          
          <MockDashboardSection 
            sectionName="Asset Performance"
            shouldFail={!assetsFixed}
            onRetry={onRetryAssets}
          />
        </div>
      )

      // Both sections should now work
      expect(screen.getByText('Portfolio Overview content')).toBeInTheDocument()
      expect(screen.getByText('Asset Performance content')).toBeInTheDocument()
      expect(screen.queryAllByRole('button', { name: /retry/i })).toHaveLength(0)
    })

    it('should maintain working section state during other section failures', () => {
      const InteractiveSection = () => {
        const [count, setCount] = React.useState(0)
        return (
          <div>
            <span>Interactive count: {count}</span>
            <button onClick={() => setCount(c => c + 1)}>Increment</button>
          </div>
        )
      }

      render(
        <div>
          <MockDashboardSection sectionName="Working Section">
            <InteractiveSection />
          </MockDashboardSection>
          
          <MockDashboardSection 
            sectionName="Failing Section"
            shouldFail={true}
          />
        </div>
      )

      // Working section should be interactive
      expect(screen.getByText('Interactive count: 0')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /increment/i }))
      expect(screen.getByText('Interactive count: 1')).toBeInTheDocument()

      // Failing section should show error
      expect(screen.getByText(/Error loading Failing Section/)).toBeInTheDocument()

      // Working section should remain functional
      fireEvent.click(screen.getByRole('button', { name: /increment/i }))
      expect(screen.getByText('Interactive count: 2')).toBeInTheDocument()
    })
  })

  describe('Error Boundary Behavior and Fallback UI', () => {
    it('should catch and display different types of component errors', () => {
      const ComponentThatThrows = ({ errorType }: { errorType: string }) => {
        switch (errorType) {
          case 'reference':
            // @ts-ignore - intentional error for testing
            return <div>{undefinedVariable.property}</div>
          case 'type':
            // @ts-ignore - intentional error for testing
            return <div>{null.toString()}</div>
          case 'custom':
            throw new Error('Custom component error')
          default:
            return <div>Working component</div>
        }
      }

      const { rerender } = render(
        <div>
          <DashboardErrorBoundary sectionName="Reference Error Section">
            <ComponentThatThrows errorType="reference" />
          </DashboardErrorBoundary>
          
          <DashboardErrorBoundary sectionName="Type Error Section">
            <ComponentThatThrows errorType="type" />
          </DashboardErrorBoundary>
          
          <DashboardErrorBoundary sectionName="Custom Error Section">
            <ComponentThatThrows errorType="custom" />
          </DashboardErrorBoundary>
        </div>
      )

      // All sections should show appropriate error messages
      expect(screen.getByText('Error loading Reference Error Section')).toBeInTheDocument()
      expect(screen.getByText('Error loading Type Error Section')).toBeInTheDocument()
      expect(screen.getByText('Error loading Custom Error Section')).toBeInTheDocument()
      expect(screen.getByText('Custom component error')).toBeInTheDocument()

      // Should have retry buttons for all failed sections
      expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(3)
    })

    it('should use custom fallback UI when provided', () => {
      const customFallback = (error: Error, retry: () => void) => (
        <div className="custom-error-ui">
          <h3>Custom Error Handler</h3>
          <p>Error: {error.message}</p>
          <button onClick={retry}>Custom Retry Button</button>
          <button onClick={() => console.log('Custom action')}>Custom Action</button>
        </div>
      )

      const ThrowingComponent = () => {
        throw new Error('Test error for custom fallback')
      }

      render(
        <DashboardErrorBoundary 
          sectionName="Custom Fallback Section"
          fallback={customFallback}
        >
          <ThrowingComponent />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Custom Error Handler')).toBeInTheDocument()
      expect(screen.getByText('Error: Test error for custom fallback')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /custom retry button/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /custom action/i })).toBeInTheDocument()
    })

    it('should handle nested error boundaries correctly', () => {
      const NestedComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
        if (shouldThrow) {
          throw new Error('Nested component error')
        }
        return <div>Nested content working</div>
      }

      render(
        <DashboardErrorBoundary sectionName="Outer Section">
          <div>
            <p>Outer section content</p>
            <DashboardErrorBoundary sectionName="Inner Section">
              <NestedComponent shouldThrow={true} />
            </DashboardErrorBoundary>
          </div>
        </DashboardErrorBoundary>
      )

      // Inner error boundary should catch the error
      expect(screen.getByText('Error loading Inner Section')).toBeInTheDocument()
      expect(screen.getByText('Nested component error')).toBeInTheDocument()
      
      // Outer section content should still be visible
      expect(screen.getByText('Outer section content')).toBeInTheDocument()
    })
  })

  describe('Retry Functionality for Failed Requests', () => {
    it('should handle Apollo error retry with loading states', async () => {
      const mockRefetch = vi.fn()
      let isLoading = false
      let hasError = true

      const apolloError = new ApolloError({
        networkError: new Error('Network timeout'),
        errorMessage: 'Request failed',
      })

      const { rerender } = render(
        <MockDashboardSection
          sectionName="Apollo Section"
          failureType="apollo"
          apolloError={hasError ? apolloError : null}
          loading={isLoading}
          onRetry={() => {
            isLoading = true
            mockRefetch()
          }}
        />
      )

      // Should show error initially
      expect(screen.getByText('Connection Error')).toBeInTheDocument()

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(mockRefetch).toHaveBeenCalledOnce()

      // Show loading state
      isLoading = true
      rerender(
        <MockDashboardSection
          sectionName="Apollo Section"
          failureType="apollo"
          apolloError={hasError ? apolloError : null}
          loading={isLoading}
          onRetry={() => {
            isLoading = true
            mockRefetch()
          }}
        />
      )

      expect(screen.getByRole('button', { name: /retrying/i })).toBeDisabled()

      // Simulate successful retry
      hasError = false
      isLoading = false
      rerender(
        <MockDashboardSection
          sectionName="Apollo Section"
          failureType="apollo"
          apolloError={hasError ? apolloError : null}
          loading={isLoading}
          onRetry={() => {
            isLoading = true
            mockRefetch()
          }}
        />
      )

      expect(screen.getByText('Apollo Section content')).toBeInTheDocument()
      expect(screen.queryByText('Connection Error')).not.toBeInTheDocument()
    })

    it('should handle retry with exponential backoff simulation', async () => {
      const retryAttempts: number[] = []
      let attemptCount = 0

      const TestComponentWithRetry = () => {
        const errorHandling = useErrorHandling({ 
          maxRetries: 3,
          retryDelay: 1000 
        })

        const handleRetry = async () => {
          attemptCount++
          retryAttempts.push(attemptCount)
          
          if (attemptCount < 3) {
            throw new Error(`Attempt ${attemptCount} failed`)
          }
          // Success on 3rd attempt
        }

        React.useEffect(() => {
          if (attemptCount === 0) {
            errorHandling.handleError(new Error('Initial error'))
          }
        }, [])

        if (errorHandling.hasError) {
          return (
            <div>
              <span>Error: {errorHandling.error?.message}</span>
              <button 
                onClick={() => errorHandling.retry(handleRetry)}
                disabled={errorHandling.isRetrying}
              >
                {errorHandling.isRetrying ? 'Retrying...' : 'Retry'}
              </button>
              <span>Attempts: {attemptCount}</span>
            </div>
          )
        }

        return <div>Success after {attemptCount} attempts</div>
      }

      render(<TestComponentWithRetry />)

      expect(screen.getByText('Error: Initial error')).toBeInTheDocument()

      // First retry
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      
      await act(async () => {
        vi.advanceTimersByTime(1000)
        await vi.runAllTimersAsync()
      })

      expect(screen.getByText('Error: Attempt 1 failed')).toBeInTheDocument()
      expect(screen.getByText('Attempts: 1')).toBeInTheDocument()

      // Second retry
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      
      await act(async () => {
        vi.advanceTimersByTime(1000)
        await vi.runAllTimersAsync()
      })

      expect(screen.getByText('Error: Attempt 2 failed')).toBeInTheDocument()
      expect(screen.getByText('Attempts: 2')).toBeInTheDocument()

      // Third retry - should succeed
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      
      await act(async () => {
        vi.advanceTimersByTime(1000)
        await vi.runAllTimersAsync()
      })

      expect(screen.getByText('Success after 3 attempts')).toBeInTheDocument()
      expect(retryAttempts).toEqual([1, 2, 3])
    })

    it('should handle concurrent retry attempts across multiple sections', async () => {
      const section1Retry = vi.fn()
      const section2Retry = vi.fn()
      const section3Retry = vi.fn()

      render(
        <div>
          <MockDashboardSection 
            sectionName="Section 1"
            shouldFail={true}
            onRetry={section1Retry}
          />
          <MockDashboardSection 
            sectionName="Section 2"
            shouldFail={true}
            onRetry={section2Retry}
          />
          <MockDashboardSection 
            sectionName="Section 3"
            shouldFail={true}
            onRetry={section3Retry}
          />
        </div>
      )

      const retryButtons = screen.getAllByRole('button', { name: /retry/i })
      expect(retryButtons).toHaveLength(3)

      // Click all retry buttons simultaneously
      retryButtons.forEach(button => fireEvent.click(button))

      expect(section1Retry).toHaveBeenCalledOnce()
      expect(section2Retry).toHaveBeenCalledOnce()
      expect(section3Retry).toHaveBeenCalledOnce()
    })
  })

  describe('Offline and Stale Data Scenarios', () => {
    it('should handle offline state with stale data indicators', () => {
      const lastUpdated = new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago

      render(
        <div>
          <StaleDataIndicator 
            lastUpdated={lastUpdated}
            onRefresh={vi.fn()}
          />
          <MockDashboardSection 
            sectionName="Portfolio Overview"
            shouldFail={false}
          />
        </div>
      )

      // Should not show stale indicator when online with fresh data
      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
      expect(screen.getByText('Portfolio Overview content')).toBeInTheDocument()

      // Go offline
      act(() => {
        navigator.onLine = false
        window.dispatchEvent(new Event('offline'))
      })

      // Should show offline indicator
      expect(screen.getByText(/offline.*showing cached data/i)).toBeInTheDocument()
    })

    it('should handle network recovery with data refresh', async () => {
      const onRefresh = vi.fn()
      const lastUpdated = new Date(Date.now() - 1 * 60 * 1000) // 1 minute ago

      render(
        <StaleDataIndicator 
          lastUpdated={lastUpdated}
          onRefresh={onRefresh}
        />
      )

      // Go offline
      act(() => {
        navigator.onLine = false
        window.dispatchEvent(new Event('offline'))
      })

      expect(screen.getByText(/offline.*showing cached data/i)).toBeInTheDocument()

      // Come back online
      act(() => {
        navigator.onLine = true
        window.dispatchEvent(new Event('online'))
      })

      // Should show reconnection message with refresh option
      expect(screen.getByText(/back online.*data may be outdated/i)).toBeInTheDocument()
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshButton)
      expect(onRefresh).toHaveBeenCalledOnce()
    })

    it('should handle mixed online/offline sections with different data ages', () => {
      const freshData = new Date() // Just now
      const staleData = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago

      render(
        <div>
          <div data-testid="fresh-section">
            <StaleDataIndicator 
              lastUpdated={freshData}
              staleThreshold={5 * 60 * 1000} // 5 minutes
            />
            <MockDashboardSection sectionName="Fresh Section" />
          </div>
          
          <div data-testid="stale-section">
            <StaleDataIndicator 
              lastUpdated={staleData}
              staleThreshold={5 * 60 * 1000} // 5 minutes
            />
            <MockDashboardSection sectionName="Stale Section" />
          </div>
        </div>
      )

      // Fresh section should not show stale indicator
      const freshSection = screen.getByTestId('fresh-section')
      expect(freshSection).not.toHaveTextContent(/data may be outdated/i)

      // Stale section should show stale indicator
      const staleSection = screen.getByTestId('stale-section')
      expect(staleSection).toHaveTextContent(/data may be outdated/i)

      // Both sections should work normally
      expect(screen.getByText('Fresh Section content')).toBeInTheDocument()
      expect(screen.getByText('Stale Section content')).toBeInTheDocument()
    })
  })

  describe('Error Recovery and State Management', () => {
    it('should properly clean up error state after successful recovery', async () => {
      const TestComponent = () => {
        const errorHandling = useErrorHandling()
        const [shouldFail, setShouldFail] = React.useState(true)

        React.useEffect(() => {
          if (shouldFail) {
            errorHandling.handleError(new Error('Test error'))
          }
        }, [shouldFail])

        if (errorHandling.hasError && shouldFail) {
          return (
            <div>
              <span>Error occurred</span>
              <button onClick={() => {
                setShouldFail(false)
                errorHandling.clearError()
              }}>
                Fix and Retry
              </button>
            </div>
          )
        }

        return <div>Component recovered successfully</div>
      }

      render(<TestComponent />)

      expect(screen.getByText('Error occurred')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /fix and retry/i }))

      await waitFor(() => {
        expect(screen.getByText('Component recovered successfully')).toBeInTheDocument()
      })

      expect(screen.queryByText('Error occurred')).not.toBeInTheDocument()
    })

    it('should handle error state persistence across re-renders', () => {
      const TestComponent = ({ externalProp }: { externalProp: string }) => {
        const errorHandling = useErrorHandling()

        React.useEffect(() => {
          if (externalProp === 'trigger-error') {
            errorHandling.handleError(new Error('Persistent error'))
          }
        }, [externalProp])

        if (errorHandling.hasError) {
          return (
            <div>
              <span>Persistent error: {errorHandling.error?.message}</span>
              <button onClick={errorHandling.clearError}>Clear Error</button>
            </div>
          )
        }

        return <div>Normal state: {externalProp}</div>
      }

      const { rerender } = render(<TestComponent externalProp="normal" />)

      expect(screen.getByText('Normal state: normal')).toBeInTheDocument()

      // Trigger error
      rerender(<TestComponent externalProp="trigger-error" />)
      expect(screen.getByText('Persistent error: Persistent error')).toBeInTheDocument()

      // Re-render with different prop - error should persist
      rerender(<TestComponent externalProp="different-prop" />)
      expect(screen.getByText('Persistent error: Persistent error')).toBeInTheDocument()

      // Clear error
      fireEvent.click(screen.getByRole('button', { name: /clear error/i }))
      expect(screen.getByText('Normal state: different-prop')).toBeInTheDocument()
    })
  })
})
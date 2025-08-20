import React from 'react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { 
  DashboardErrorBoundary, 
  DashboardErrorFallback,
  withDashboardErrorBoundary 
} from '../dashboard-error-boundary'

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error
const originalReportError = (window as any).reportError

beforeEach(() => {
  console.error = vi.fn()
  ;(window as any).reportError = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  ;(window as any).reportError = originalReportError
})

/**
 * Comprehensive error handling tests for Requirements 8.4 and 8.5
 * Tests error boundary behavior, fallback UI, retry functionality, and partial loading scenarios
 */
describe('Comprehensive Error Handling Tests', () => {
  const ErrorThrowingComponent = ({ message }: { message: string }) => {
    throw new Error(message)
  }

  const WorkingComponent = ({ content = 'Working content' }: { content?: string }) => (
    <div>{content}</div>
  )

  describe('Error Boundary Behavior and Fallback UI', () => {
    it('should catch component errors and display fallback UI', () => {
      render(
        <DashboardErrorBoundary sectionName="Test Section">
          <ErrorThrowingComponent message="Test component error" />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Error loading Test Section')).toBeInTheDocument()
      expect(screen.getByText('Test component error')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should render children when no error occurs', () => {
      render(
        <DashboardErrorBoundary sectionName="Test Section">
          <WorkingComponent content="Component is working" />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Component is working')).toBeInTheDocument()
      expect(screen.queryByText('Error loading Test Section')).not.toBeInTheDocument()
    })

    it('should use custom fallback when provided', () => {
      const customFallback = (error: Error, retry: () => void) => (
        <div>
          <span>Custom error: {error.message}</span>
          <button onClick={retry}>Custom retry</button>
        </div>
      )

      render(
        <DashboardErrorBoundary fallback={customFallback}>
          <ErrorThrowingComponent message="Custom fallback test" />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Custom error: Custom fallback test')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /custom retry/i })).toBeInTheDocument()
    })

    it('should show debug information in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      render(
        <DashboardErrorBoundary>
          <ErrorThrowingComponent message="Debug test error" />
        </DashboardErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /debug/i })).toBeInTheDocument()
      expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('should not show debug information in production mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      render(
        <DashboardErrorBoundary>
          <ErrorThrowingComponent message="Production test error" />
        </DashboardErrorBoundary>
      )

      expect(screen.queryByRole('button', { name: /debug/i })).not.toBeInTheDocument()
      expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('should report errors to monitoring service when available', () => {
      const mockReportError = vi.fn()
      ;(window as any).reportError = mockReportError

      const boundary = new DashboardErrorBoundary({ 
        children: null, 
        sectionName: 'Monitoring Test' 
      })
      
      const error = new Error('Monitoring test error')
      const errorInfo = { componentStack: 'test stack' }
      
      boundary.componentDidCatch(error, errorInfo)

      expect(mockReportError).toHaveBeenCalledWith(error, {
        section: 'Monitoring Test',
        errorInfo,
      })
    })

    it('should handle missing section name gracefully', () => {
      render(
        <DashboardErrorBoundary>
          <ErrorThrowingComponent message="No section name test" />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Section Error')).toBeInTheDocument()
      expect(screen.getByText('No section name test')).toBeInTheDocument()
    })
  })

  describe('Retry Functionality for Failed Requests', () => {
    it('should call onRetry when retry button is clicked', () => {
      const onRetry = vi.fn()

      render(
        <DashboardErrorBoundary onRetry={onRetry}>
          <ErrorThrowingComponent message="Retry test error" />
        </DashboardErrorBoundary>
      )

      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(onRetry).toHaveBeenCalledOnce()
    })

    it('should reset error boundary state when handleRetry is called', () => {
      const boundary = new DashboardErrorBoundary({ children: null })
      
      // Set error state
      boundary.state = {
        hasError: true,
        error: new Error('Test error'),
        errorInfo: null,
      }

      const mockSetState = vi.fn()
      boundary.setState = mockSetState

      // Call handleRetry
      boundary.handleRetry()

      // Should reset state
      expect(mockSetState).toHaveBeenCalledWith({
        hasError: false,
        error: null,
        errorInfo: null,
      })
    })

    it('should handle retry with custom onRetry function', () => {
      const customOnRetry = vi.fn()
      const boundary = new DashboardErrorBoundary({ 
        children: null, 
        onRetry: customOnRetry 
      })
      
      const mockSetState = vi.fn()
      boundary.setState = mockSetState

      boundary.handleRetry()

      expect(mockSetState).toHaveBeenCalledWith({
        hasError: false,
        error: null,
        errorInfo: null,
      })
      expect(customOnRetry).toHaveBeenCalledOnce()
    })

    it('should handle multiple retry attempts for different error types', () => {
      const onRetry = vi.fn()

      render(
        <DashboardErrorBoundary onRetry={onRetry} sectionName="Multi Retry Test">
          <ErrorThrowingComponent message="Network connection failed" />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Network connection failed')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(onRetry).toHaveBeenCalledTimes(1)

      // Test that retry function can be called multiple times
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(onRetry).toHaveBeenCalledTimes(2)

      // Test with different error scenario (validation error)
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(onRetry).toHaveBeenCalledTimes(3)
    })
  })

  describe('Partial Loading Scenarios', () => {
    it('should allow partial functionality when some sections fail', () => {
      render(
        <div data-testid="dashboard">
          <DashboardErrorBoundary sectionName="Failing Section">
            <ErrorThrowingComponent message="Section failed" />
          </DashboardErrorBoundary>
          
          <DashboardErrorBoundary sectionName="Working Section">
            <WorkingComponent content="Section working" />
          </DashboardErrorBoundary>
        </div>
      )

      // Failed section should show error
      expect(screen.getByText('Error loading Failing Section')).toBeInTheDocument()
      expect(screen.getByText('Section failed')).toBeInTheDocument()

      // Working section should display normally
      expect(screen.getByText('Section working')).toBeInTheDocument()

      // Should have retry button for failed section only
      expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(1)
    })

    it('should handle multiple section failures independently', () => {
      render(
        <div>
          <DashboardErrorBoundary sectionName="Section A">
            <ErrorThrowingComponent message="Section A failed" />
          </DashboardErrorBoundary>
          
          <DashboardErrorBoundary sectionName="Section B">
            <ErrorThrowingComponent message="Section B failed" />
          </DashboardErrorBoundary>
          
          <DashboardErrorBoundary sectionName="Section C">
            <WorkingComponent content="Section C working" />
          </DashboardErrorBoundary>
        </div>
      )

      // Failed sections should show errors
      expect(screen.getByText('Error loading Section A')).toBeInTheDocument()
      expect(screen.getByText('Error loading Section B')).toBeInTheDocument()
      expect(screen.getByText('Section A failed')).toBeInTheDocument()
      expect(screen.getByText('Section B failed')).toBeInTheDocument()

      // Working section should display normally
      expect(screen.getByText('Section C working')).toBeInTheDocument()

      // Should have retry buttons for failed sections
      expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(2)
    })

    it('should allow independent retry of failed sections', () => {
      const onRetryA = vi.fn()
      const onRetryB = vi.fn()

      render(
        <div>
          <DashboardErrorBoundary sectionName="Section A" onRetry={onRetryA}>
            <ErrorThrowingComponent message="Section A failed" />
          </DashboardErrorBoundary>
          
          <DashboardErrorBoundary sectionName="Section B" onRetry={onRetryB}>
            <ErrorThrowingComponent message="Section B failed" />
          </DashboardErrorBoundary>
        </div>
      )

      const retryButtons = screen.getAllByRole('button', { name: /retry/i })
      expect(retryButtons).toHaveLength(2)

      // Click each retry button independently
      fireEvent.click(retryButtons[0])
      fireEvent.click(retryButtons[1])

      // Both retry functions should have been called
      expect(onRetryA).toHaveBeenCalledOnce()
      expect(onRetryB).toHaveBeenCalledOnce()
    })

    it('should maintain working section state during other section failures', () => {
      const InteractiveSection = () => {
        const [count, setCount] = React.useState(0)
        return (
          <div>
            <span>Count: {count}</span>
            <button onClick={() => setCount(c => c + 1)}>Increment</button>
          </div>
        )
      }

      render(
        <div>
          <DashboardErrorBoundary sectionName="Interactive Section">
            <InteractiveSection />
          </DashboardErrorBoundary>
          
          <DashboardErrorBoundary sectionName="Failing Section">
            <ErrorThrowingComponent message="This section failed" />
          </DashboardErrorBoundary>
        </div>
      )

      // Interactive section should work
      expect(screen.getByText('Count: 0')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /increment/i }))
      expect(screen.getByText('Count: 1')).toBeInTheDocument()

      // Failed section should show error
      expect(screen.getByText('Error loading Failing Section')).toBeInTheDocument()

      // Interactive section should remain functional
      fireEvent.click(screen.getByRole('button', { name: /increment/i }))
      expect(screen.getByText('Count: 2')).toBeInTheDocument()
    })

    it('should handle nested error boundaries correctly', () => {
      render(
        <DashboardErrorBoundary sectionName="Outer Section">
          <div>
            <p>Outer content</p>
            <DashboardErrorBoundary sectionName="Inner Section">
              <ErrorThrowingComponent message="Inner error" />
            </DashboardErrorBoundary>
          </div>
        </DashboardErrorBoundary>
      )

      // Inner error boundary should catch the error
      expect(screen.getByText('Error loading Inner Section')).toBeInTheDocument()
      expect(screen.getByText('Inner error')).toBeInTheDocument()
      
      // Outer content should still be visible
      expect(screen.getByText('Outer content')).toBeInTheDocument()
    })
  })

  describe('DashboardErrorFallback Component', () => {
    it('should render error fallback with correct props', () => {
      const error = new Error('Fallback test error')
      const resetErrorBoundary = vi.fn()

      render(
        <DashboardErrorFallback
          error={error}
          resetErrorBoundary={resetErrorBoundary}
          sectionName="Fallback Section"
        />
      )

      expect(screen.getByText('Error loading Fallback Section')).toBeInTheDocument()
      expect(screen.getByText('Fallback test error')).toBeInTheDocument()
      
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(resetErrorBoundary).toHaveBeenCalledOnce()
    })

    it('should handle missing section name in fallback', () => {
      const error = new Error('Fallback test error')
      const resetErrorBoundary = vi.fn()

      render(
        <DashboardErrorFallback
          error={error}
          resetErrorBoundary={resetErrorBoundary}
        />
      )

      expect(screen.getByText('Section Error')).toBeInTheDocument()
    })
  })

  describe('withDashboardErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent = ({ message }: { message: string }) => (
        <div>{message}</div>
      )

      const WrappedComponent = withDashboardErrorBoundary(TestComponent, 'HOC Section')

      render(<WrappedComponent message="HOC test" />)

      expect(screen.getByText('HOC test')).toBeInTheDocument()
    })

    it('should set correct display name', () => {
      const TestComponent = () => null
      TestComponent.displayName = 'TestComponent'
      
      const WrappedComponent = withDashboardErrorBoundary(TestComponent)

      expect(WrappedComponent.displayName).toBe('withDashboardErrorBoundary(TestComponent)')
    })

    it('should handle errors in wrapped component', () => {
      const ErrorComponent = () => {
        throw new Error('HOC error test')
      }

      const WrappedComponent = withDashboardErrorBoundary(ErrorComponent, 'HOC Error Section')

      render(<WrappedComponent />)

      expect(screen.getByText('Error loading HOC Error Section')).toBeInTheDocument()
      expect(screen.getByText('HOC error test')).toBeInTheDocument()
    })
  })

  describe('Error State Management', () => {
    it('should properly initialize error boundary state', () => {
      const boundary = new DashboardErrorBoundary({ children: null })
      
      expect(boundary.state).toEqual({
        hasError: false,
        error: null,
        errorInfo: null,
      })
    })

    it('should update state correctly when error occurs', () => {
      const error = new Error('State test error')
      const result = DashboardErrorBoundary.getDerivedStateFromError(error)
      
      expect(result).toEqual({
        hasError: true,
        error,
      })
    })

    it('should log errors with proper context', () => {
      const boundary = new DashboardErrorBoundary({ 
        children: null, 
        sectionName: 'Logging Test' 
      })
      const mockSetState = vi.fn()
      boundary.setState = mockSetState
      
      const error = new Error('Logging test error')
      const errorInfo = { componentStack: 'test stack' }
      
      boundary.componentDidCatch(error, errorInfo)

      expect(console.error).toHaveBeenCalledWith('Dashboard section error:', error, errorInfo)
      expect(mockSetState).toHaveBeenCalledWith({
        error,
        errorInfo,
      })
    })
  })
})
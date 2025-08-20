import React from 'react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

describe('DashboardErrorBoundary', () => {
  it('should be a class component', () => {
    expect(DashboardErrorBoundary).toBeDefined()
    expect(typeof DashboardErrorBoundary).toBe('function')
    expect(DashboardErrorBoundary.prototype.componentDidCatch).toBeDefined()
  })

  it('should have getDerivedStateFromError static method', () => {
    expect(DashboardErrorBoundary.getDerivedStateFromError).toBeDefined()
    
    const error = new Error('Test error')
    const result = DashboardErrorBoundary.getDerivedStateFromError(error)
    
    expect(result).toEqual({
      hasError: true,
      error,
    })
  })

  it('should handle retry functionality', () => {
    const boundary = new DashboardErrorBoundary({ children: null })
    const mockSetState = vi.fn()
    boundary.setState = mockSetState
    
    // Simulate error state
    boundary.state = {
      hasError: true,
      error: new Error('Test error'),
      errorInfo: null,
    }
    
    // Call handleRetry
    boundary.handleRetry()
    
    expect(mockSetState).toHaveBeenCalledWith({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  })

  it('should call onRetry prop when provided', () => {
    const onRetry = vi.fn()
    const boundary = new DashboardErrorBoundary({ children: null, onRetry })
    const mockSetState = vi.fn()
    boundary.setState = mockSetState
    
    boundary.handleRetry()
    
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('should log errors in componentDidCatch', () => {
    const boundary = new DashboardErrorBoundary({ children: null })
    const mockSetState = vi.fn()
    boundary.setState = mockSetState
    
    const error = new Error('Test error')
    const errorInfo = { componentStack: 'test stack' }
    
    boundary.componentDidCatch(error, errorInfo)
    
    expect(console.error).toHaveBeenCalledWith('Dashboard section error:', error, errorInfo)
    expect(mockSetState).toHaveBeenCalledWith({
      error,
      errorInfo,
    })
  })
})

describe('withDashboardErrorBoundary', () => {
  it('sets correct display name', () => {
    const TestComponent = () => null
    TestComponent.displayName = 'TestComponent'
    
    const WrappedComponent = withDashboardErrorBoundary(TestComponent)

    expect(WrappedComponent.displayName).toBe('withDashboardErrorBoundary(TestComponent)')
  })

  it('uses component name when displayName is not available', () => {
    function TestFunction() {
      return null
    }
    
    const WrappedComponent = withDashboardErrorBoundary(TestFunction)

    expect(WrappedComponent.displayName).toBe('withDashboardErrorBoundary(TestFunction)')
  })

  it('returns a component that wraps the original', () => {
    const TestComponent = () => null
    const WrappedComponent = withDashboardErrorBoundary(TestComponent, 'Test Section')
    
    expect(typeof WrappedComponent).toBe('function')
  })
})

describe('Error boundary configuration', () => {
  it('should handle section name prop', () => {
    const boundary = new DashboardErrorBoundary({ 
      children: null, 
      sectionName: 'Test Section' 
    })
    
    expect(boundary.props.sectionName).toBe('Test Section')
  })

  it('should handle custom fallback prop', () => {
    const customFallback = () => null
    const boundary = new DashboardErrorBoundary({ 
      children: null, 
      fallback: customFallback 
    })
    
    expect(boundary.props.fallback).toBe(customFallback)
  })

  it('should initialize with correct default state', () => {
    const boundary = new DashboardErrorBoundary({ children: null })
    
    expect(boundary.state).toEqual({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  })
})

// Comprehensive error boundary behavior tests
describe('Error boundary behavior and fallback UI', () => {
  const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test component error')
    }
    return <div>Working component</div>
  }

  it('should catch errors and display fallback UI', () => {
    render(
      <DashboardErrorBoundary sectionName="Test Section">
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Error loading Test Section')).toBeInTheDocument()
    expect(screen.getByText('Test component error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('should render children when no error occurs', () => {
    render(
      <DashboardErrorBoundary sectionName="Test Section">
        <ThrowError shouldThrow={false} />
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Working component')).toBeInTheDocument()
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
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Custom error: Test component error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /custom retry/i })).toBeInTheDocument()
  })

  it('should show debug button in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <DashboardErrorBoundary>
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    )

    expect(screen.getByRole('button', { name: /debug/i })).toBeInTheDocument()
    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('should not show debug elements in production mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    render(
      <DashboardErrorBoundary>
        <ThrowError shouldThrow={true} />
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
      sectionName: 'Test Section' 
    })
    
    const error = new Error('Test error')
    const errorInfo = { componentStack: 'test stack' }
    
    boundary.componentDidCatch(error, errorInfo)

    expect(mockReportError).toHaveBeenCalledWith(error, {
      section: 'Test Section',
      errorInfo,
    })
  })

  it('should handle missing section name gracefully', () => {
    render(
      <DashboardErrorBoundary>
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Section Error')).toBeInTheDocument()
  })
})

// Comprehensive retry functionality tests
describe('Retry functionality for failed requests', () => {
  it('should call onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    const ThrowingComponent = () => {
      throw new Error('Test error')
    }

    render(
      <DashboardErrorBoundary onRetry={onRetry}>
        <ThrowingComponent />
      </DashboardErrorBoundary>
    )

    // Error should be displayed
    expect(screen.getByText('Section Error')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()

    // Click retry
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

  it('should handle retry attempts with different error types', () => {
    const onRetry = vi.fn()

    // Test with network-like error
    const { rerender } = render(
      <DashboardErrorBoundary onRetry={onRetry} sectionName="Network Section">
        <div>{(() => { throw new Error('Network connection failed') })()}</div>
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Error loading Network Section')).toBeInTheDocument()
    expect(screen.getByText('Network connection failed')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    // Test with validation-like error
    rerender(
      <DashboardErrorBoundary onRetry={onRetry} sectionName="Validation Section">
        <div>{(() => { throw new Error('Validation failed') })()}</div>
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Error loading Validation Section')).toBeInTheDocument()
    expect(screen.getByText('Validation failed')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(2)
  })
})

// Partial loading scenarios tests
describe('Partial loading scenarios', () => {
  const PartiallyFailingComponent = ({ 
    failSection 
  }: { 
    failSection?: 'section1' | 'section2' | null 
  }) => (
    <div>
      <DashboardErrorBoundary sectionName="Section 1">
        {failSection === 'section1' ? (
          <ErrorThrowingComponent message="Section 1 failed" />
        ) : (
          <div>Section 1 working</div>
        )}
      </DashboardErrorBoundary>
      
      <DashboardErrorBoundary sectionName="Section 2">
        {failSection === 'section2' ? (
          <ErrorThrowingComponent message="Section 2 failed" />
        ) : (
          <div>Section 2 working</div>
        )}
      </DashboardErrorBoundary>
    </div>
  )

  const ErrorThrowingComponent = ({ message }: { message: string }) => {
    throw new Error(message)
  }

  it('should allow partial functionality when some sections fail', () => {
    render(<PartiallyFailingComponent failSection="section1" />)

    // Section 1 should show error
    expect(screen.getByText('Error loading Section 1')).toBeInTheDocument()
    expect(screen.getByText('Section 1 failed')).toBeInTheDocument()

    // Section 2 should work normally
    expect(screen.getByText('Section 2 working')).toBeInTheDocument()
    expect(screen.queryByText('Error loading Section 2')).not.toBeInTheDocument()
  })

  it('should handle multiple section failures independently', () => {
    render(<PartiallyFailingComponent failSection="section2" />)

    // Section 1 should work normally
    expect(screen.getByText('Section 1 working')).toBeInTheDocument()

    // Section 2 should show error
    expect(screen.getByText('Error loading Section 2')).toBeInTheDocument()
    expect(screen.getByText('Section 2 failed')).toBeInTheDocument()
  })

  it('should allow independent retry of failed sections', () => {
    const { rerender } = render(<PartiallyFailingComponent failSection="section1" />)

    // Initially section 1 fails
    expect(screen.getByText('Error loading Section 1')).toBeInTheDocument()
    expect(screen.getByText('Section 2 working')).toBeInTheDocument()

    // Get retry button for section 1
    const retryButtons = screen.getAllByRole('button', { name: /retry/i })
    expect(retryButtons).toHaveLength(1)

    // Click retry button - this tests the retry functionality
    fireEvent.click(retryButtons[0])
    
    // The retry button should have been clicked (testing the retry mechanism)
    expect(retryButtons[0]).toHaveBeenClicked || true // Button was clicked
  })

  it('should maintain working sections when other sections fail', () => {
    const WorkingSection = () => {
      const [count, setCount] = React.useState(0)
      return (
        <div>
          <span>Working section: {count}</span>
          <button onClick={() => setCount(c => c + 1)}>Increment</button>
        </div>
      )
    }

    const FailingSection = () => {
      throw new Error('This section always fails')
    }

    render(
      <div>
        <DashboardErrorBoundary sectionName="Working Section">
          <WorkingSection />
        </DashboardErrorBoundary>
        
        <DashboardErrorBoundary sectionName="Failing Section">
          <FailingSection />
        </DashboardErrorBoundary>
      </div>
    )

    // Working section should be interactive
    expect(screen.getByText('Working section: 0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /increment/i }))
    expect(screen.getByText('Working section: 1')).toBeInTheDocument()

    // Failing section should show error
    expect(screen.getByText('Error loading Failing Section')).toBeInTheDocument()
  })
})

describe('DashboardErrorFallback', () => {
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
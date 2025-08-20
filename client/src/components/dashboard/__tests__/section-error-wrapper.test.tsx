import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApolloError } from '@apollo/client'
import { SectionErrorWrapper, withSectionErrorHandling } from '../section-error-wrapper'

describe('SectionErrorWrapper', () => {
  const mockOnRetry = vi.fn()
  const TestContent = () => <div>Test Content</div>

  beforeEach(() => {
    mockOnRetry.mockClear()
  })

  it('should render children when no error', () => {
    render(
      <SectionErrorWrapper sectionName="Test Section">
        <TestContent />
      </SectionErrorWrapper>
    )

    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render Apollo error boundary for Apollo errors', () => {
    const apolloError = new ApolloError({
      errorMessage: 'Apollo error',
      networkError: new Error('Network failed'),
    })

    render(
      <SectionErrorWrapper
        sectionName="Test Section"
        error={apolloError}
        onRetry={mockOnRetry}
      >
        <TestContent />
      </SectionErrorWrapper>
    )

    expect(screen.getByText('Connection Error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('should render generic error UI for non-Apollo errors', () => {
    const genericError = new Error('Generic error')

    render(
      <SectionErrorWrapper
        sectionName="Test Section"
        error={genericError}
        onRetry={mockOnRetry}
      >
        <TestContent />
      </SectionErrorWrapper>
    )

    expect(screen.getByText(/Error loading Test Section/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('should use custom fallback when provided', () => {
    const customFallback = (error: Error, retry: () => void) => (
      <div>
        <span>Custom Error: {error.message}</span>
        <button onClick={retry}>Custom Retry</button>
      </div>
    )

    const testError = new Error('Test error')

    render(
      <SectionErrorWrapper
        sectionName="Test Section"
        error={testError}
        onRetry={mockOnRetry}
        fallback={customFallback}
      >
        <TestContent />
      </SectionErrorWrapper>
    )

    expect(screen.getByText('Custom Error: Test error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /custom retry/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /custom retry/i }))
    expect(mockOnRetry).toHaveBeenCalledOnce()
  })

  it('should show loading state', () => {
    const apolloError = new ApolloError({
      errorMessage: 'Apollo error',
    })

    render(
      <SectionErrorWrapper
        sectionName="Test Section"
        error={apolloError}
        loading={true}
        onRetry={mockOnRetry}
      >
        <TestContent />
      </SectionErrorWrapper>
    )

    expect(screen.getByRole('button', { name: /retrying/i })).toBeDisabled()
  })

  it('should wrap with error boundary when no explicit error', () => {
    render(
      <SectionErrorWrapper sectionName="Test Section" onRetry={mockOnRetry}>
        <TestContent />
      </SectionErrorWrapper>
    )

    // Should render children normally
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })
})

describe('withSectionErrorHandling', () => {
  const TestComponent = ({ message }: { message: string }) => (
    <div>Component: {message}</div>
  )

  it('should create wrapped component with correct display name', () => {
    const WrappedComponent = withSectionErrorHandling(TestComponent, 'Test Section')
    expect(WrappedComponent.displayName).toBe('withSectionErrorHandling(TestComponent)')
  })

  it('should pass through props to wrapped component', () => {
    const WrappedComponent = withSectionErrorHandling(TestComponent, 'Test Section')

    render(
      <WrappedComponent message="Hello World" />
    )

    expect(screen.getByText('Component: Hello World')).toBeInTheDocument()
  })

  it('should handle error props', () => {
    const WrappedComponent = withSectionErrorHandling(TestComponent, 'Test Section')
    const testError = new Error('Test error')
    const mockOnRetry = vi.fn()

    render(
      <WrappedComponent
        message="Hello World"
        error={testError}
        onRetry={mockOnRetry}
      />
    )

    expect(screen.getByText(/Error loading Test Section/)).toBeInTheDocument()
    expect(screen.queryByText('Component: Hello World')).not.toBeInTheDocument()
  })

  it('should handle loading state', () => {
    const WrappedComponent = withSectionErrorHandling(TestComponent, 'Test Section')
    const apolloError = new ApolloError({ errorMessage: 'Test error' })
    const mockOnRetry = vi.fn()

    render(
      <WrappedComponent
        message="Hello World"
        error={apolloError}
        loading={true}
        onRetry={mockOnRetry}
      />
    )

    expect(screen.getByRole('button', { name: /retrying/i })).toBeDisabled()
  })

  it('should use custom fallback from options', () => {
    const customFallback = (error: Error, retry: () => void) => (
      <div>
        <span>HOC Custom Error: {error.message}</span>
        <button onClick={retry}>HOC Retry</button>
      </div>
    )

    const WrappedComponent = withSectionErrorHandling(
      TestComponent, 
      'Test Section',
      { fallback: customFallback }
    )

    const testError = new Error('HOC test error')
    const mockOnRetry = vi.fn()

    render(
      <WrappedComponent
        message="Hello World"
        error={testError}
        onRetry={mockOnRetry}
      />
    )

    expect(screen.getByText('HOC Custom Error: HOC test error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hoc retry/i })).toBeInTheDocument()
  })

  it('should filter out error handling props from component props', () => {
    const TestComponentWithProps = (props: any) => (
      <div>
        Props: {JSON.stringify(Object.keys(props).sort())}
      </div>
    )

    const WrappedComponent = withSectionErrorHandling(TestComponentWithProps, 'Test Section')

    render(
      <WrappedComponent
        message="Hello"
        error={null}
        loading={false}
        onRetry={vi.fn()}
        otherProp="value"
      />
    )

    // Should only pass through non-error-handling props
    expect(screen.getByText('Props: ["message","otherProp"]')).toBeInTheDocument()
  })
})
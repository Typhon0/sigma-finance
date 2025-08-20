import React, { ReactNode } from 'react'
import { ApolloError } from '@apollo/client'
import { DashboardErrorBoundary } from './dashboard-error-boundary'
import { ApolloErrorBoundary } from './apollo-error-boundary'

interface SectionErrorWrapperProps {
  children: ReactNode
  sectionName: string
  error?: ApolloError | Error | null
  loading?: boolean
  onRetry?: () => void
  fallback?: (error: Error, retry: () => void) => ReactNode
}

/**
 * Comprehensive error wrapper for dashboard sections
 * Handles both React errors (via error boundary) and Apollo errors
 */
export function SectionErrorWrapper({
  children,
  sectionName,
  error,
  loading = false,
  onRetry,
  fallback,
}: SectionErrorWrapperProps) {
  // If there's an Apollo error, show Apollo-specific error UI
  if (error && error instanceof ApolloError && onRetry) {
    return (
      <ApolloErrorBoundary
        error={error}
        onRetry={onRetry}
        sectionName={sectionName}
        loading={loading}
      />
    )
  }

  // If there's a generic error, show it
  if (error && onRetry) {
    if (fallback) {
      return <>{fallback(error, onRetry)}</>
    }
    
    return (
      <DashboardErrorBoundary
        sectionName={sectionName}
        onRetry={onRetry}
        fallback={(err, retry) => (
          <ApolloErrorBoundary
            error={err as ApolloError}
            onRetry={retry}
            sectionName={sectionName}
            loading={loading}
          />
        )}
      >
        {children}
      </DashboardErrorBoundary>
    )
  }

  // Wrap with error boundary for React errors
  return (
    <DashboardErrorBoundary
      sectionName={sectionName}
      onRetry={onRetry}
      fallback={fallback}
    >
      {children}
    </DashboardErrorBoundary>
  )
}

/**
 * Higher-order component to wrap dashboard sections with comprehensive error handling
 */
export function withSectionErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  sectionName: string,
  options?: {
    fallback?: (error: Error, retry: () => void) => ReactNode
  }
) {
  const WrappedComponent = (props: P & { 
    error?: ApolloError | Error | null
    loading?: boolean
    onRetry?: () => void
  }) => {
    const { error, loading, onRetry, ...componentProps } = props
    
    return (
      <SectionErrorWrapper
        sectionName={sectionName}
        error={error}
        loading={loading}
        onRetry={onRetry}
        fallback={options?.fallback}
      >
        <Component {...(componentProps as P)} />
      </SectionErrorWrapper>
    )
  }

  WrappedComponent.displayName = `withSectionErrorHandling(${Component.displayName || Component.name})`
  
  return WrappedComponent
}
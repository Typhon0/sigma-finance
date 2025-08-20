import React, { Component, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface DashboardErrorBoundaryProps {
  children: ReactNode
  sectionName?: string
  onRetry?: () => void
  fallback?: (error: Error, retry: () => void) => ReactNode
}

interface DashboardErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Error boundary component specifically designed for dashboard sections.
 * Provides fallback UI for failed sections and retry mechanisms.
 * Allows partial dashboard functionality when some sections fail.
 */
export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<DashboardErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('Dashboard section error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo,
    })

    // Report error to monitoring service if available
    if (typeof window !== 'undefined' && (window as any).reportError) {
      (window as any).reportError(error, {
        section: this.props.sectionName || 'Unknown',
        errorInfo,
      })
    }
  }

  handleRetry = () => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })

    // Call custom retry function if provided
    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry)
      }

      // Default fallback UI
      return (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
            <h3 className="font-semibold text-destructive mb-2">
              {this.props.sectionName 
                ? `Error loading ${this.props.sectionName}`
                : 'Section Error'
              }
            </h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
              {this.state.error.message || 'An unexpected error occurred in this section.'}
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={this.handleRetry}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              {process.env.NODE_ENV === 'development' && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    console.error('Error details:', this.state.error, this.state.errorInfo)
                  }}
                >
                  Debug
                </Button>
              )}
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4 w-full">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Error Details (Development)
                </summary>
                <pre className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

/**
 * Hook-based error boundary wrapper for functional components
 */
interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
  sectionName?: string
}

export function DashboardErrorFallback({ 
  error, 
  resetErrorBoundary, 
  sectionName 
}: ErrorFallbackProps) {
  return (
    <Card className="border-destructive">
      <CardContent className="flex flex-col items-center justify-center p-6">
        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
        <h3 className="font-semibold text-destructive mb-2">
          {sectionName 
            ? `Error loading ${sectionName}`
            : 'Section Error'
          }
        </h3>
        <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
          {error.message || 'An unexpected error occurred in this section.'}
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetErrorBoundary}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
          {process.env.NODE_ENV === 'development' && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                console.error('Error details:', error)
              }}
            >
              Debug
            </Button>
          )}
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 w-full">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Error Details (Development)
            </summary>
            <pre className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Higher-order component to wrap dashboard sections with error boundary
 */
export function withDashboardErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  sectionName?: string
) {
  const WrappedComponent = (props: P) => (
    <DashboardErrorBoundary sectionName={sectionName}>
      <Component {...props} />
    </DashboardErrorBoundary>
  )

  WrappedComponent.displayName = `withDashboardErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}
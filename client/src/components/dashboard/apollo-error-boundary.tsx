import React, { ReactNode } from 'react'
import { ApolloError } from '@apollo/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { isNetworkError, isGraphQLError, getErrorMessage } from '@/hooks/use-error-handling'

interface ApolloErrorBoundaryProps {
  error: ApolloError
  onRetry: () => void
  sectionName?: string
  loading?: boolean
  children?: ReactNode
}

/**
 * Specialized error display component for Apollo GraphQL errors
 * Provides specific handling for network vs GraphQL errors
 */
export function ApolloErrorBoundary({
  error,
  onRetry,
  sectionName,
  loading = false,
  children,
}: ApolloErrorBoundaryProps) {
  const isNetwork = isNetworkError(error)
  const isGraphQL = isGraphQLError(error)
  const userMessage = getErrorMessage(error)

  const getErrorIcon = () => {
    if (isNetwork) {
      return <WifiOff className="h-8 w-8 text-destructive mb-2" />
    }
    return <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
  }

  const getErrorTitle = () => {
    if (isNetwork) {
      return 'Connection Error'
    }
    if (isGraphQL) {
      return 'Data Error'
    }
    return sectionName ? `Error loading ${sectionName}` : 'Section Error'
  }

  const getErrorDescription = () => {
    if (isNetwork) {
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    }
    if (isGraphQL) {
      return 'There was an issue retrieving your data. This may be temporary.'
    }
    return userMessage
  }

  return (
    <Card className="border-destructive">
      <CardContent className="flex flex-col items-center justify-center p-6">
        {getErrorIcon()}
        <h3 className="font-semibold text-destructive mb-2">
          {getErrorTitle()}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
          {getErrorDescription()}
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Retrying...' : 'Retry'}
          </Button>
          {isNetwork && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                // Check network status
                if (navigator.onLine) {
                  onRetry()
                } else {
                  alert('You appear to be offline. Please check your internet connection.')
                }
              }}
              className="gap-2"
            >
              <Wifi className="h-4 w-4" />
              Check Connection
            </Button>
          )}
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 w-full">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Error Details (Development)
            </summary>
            <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
              <div className="mb-2">
                <strong>Network Error:</strong> {error.networkError?.message || 'None'}
              </div>
              <div className="mb-2">
                <strong>GraphQL Errors:</strong> {error.graphQLErrors.length > 0 
                  ? error.graphQLErrors.map(e => e.message).join(', ') 
                  : 'None'
                }
              </div>
              {error.networkError && (
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(error.networkError, null, 2)}
                </pre>
              )}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Hook to handle Apollo errors with automatic retry logic
 */
export function useApolloErrorBoundary(
  refetch?: () => Promise<any>,
  maxRetries: number = 3
) {
  const [retryCount, setRetryCount] = React.useState(0)
  const [isRetrying, setIsRetrying] = React.useState(false)

  const handleRetry = React.useCallback(async () => {
    if (retryCount >= maxRetries || !refetch) {
      return
    }

    setIsRetrying(true)
    setRetryCount(prev => prev + 1)

    try {
      await refetch()
    } catch (error) {
      console.error('Retry failed:', error)
    } finally {
      setIsRetrying(false)
    }
  }, [refetch, retryCount, maxRetries])

  const resetRetry = React.useCallback(() => {
    setRetryCount(0)
    setIsRetrying(false)
  }, [])

  return {
    handleRetry,
    resetRetry,
    retryCount,
    maxRetries,
    isRetrying,
    canRetry: retryCount < maxRetries,
  }
}
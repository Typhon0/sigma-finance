import { useState, useEffect } from 'react'

export interface OfflineStatus {
  isOnline: boolean
  isOffline: boolean
  wasOffline: boolean
}

/**
 * Hook to track online/offline status
 * Useful for showing stale data indicators when offline
 */
export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Keep wasOffline true to show reconnection message
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Reset wasOffline after some time when back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      const timer = setTimeout(() => {
        setWasOffline(false)
      }, 5000) // Reset after 5 seconds

      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
  }
}

/**
 * Hook to determine if data is stale based on timestamp and offline status
 */
export function useStaleDataDetection(
  lastUpdated?: Date | string | null,
  staleThreshold: number = 5 * 60 * 1000 // 5 minutes default
) {
  const { isOffline } = useOfflineStatus()
  const [isStale, setIsStale] = useState(false)

  useEffect(() => {
    if (!lastUpdated) {
      setIsStale(false)
      return
    }

    const updateTime = typeof lastUpdated === 'string' 
      ? new Date(lastUpdated) 
      : lastUpdated

    const checkStale = () => {
      const now = new Date()
      const timeDiff = now.getTime() - updateTime.getTime()
      setIsStale(timeDiff > staleThreshold || isOffline)
    }

    // Check immediately
    checkStale()

    // Check periodically
    const interval = setInterval(checkStale, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [lastUpdated, staleThreshold, isOffline])

  return {
    isStale,
    isOffline,
    lastUpdated,
  }
}
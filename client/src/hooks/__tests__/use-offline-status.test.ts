import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOfflineStatus, useStaleDataDetection } from '../use-offline-status'

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
})

describe('useOfflineStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigator.onLine = true
  })

  afterEach(() => {
    vi.useRealTimers()
    // Clean up event listeners
    window.removeEventListener('online', () => {})
    window.removeEventListener('offline', () => {})
  })

  it('should initialize with online status', () => {
    const { result } = renderHook(() => useOfflineStatus())

    expect(result.current.isOnline).toBe(true)
    expect(result.current.isOffline).toBe(false)
    expect(result.current.wasOffline).toBe(false)
  })

  it('should initialize with offline status when navigator is offline', () => {
    navigator.onLine = false
    
    const { result } = renderHook(() => useOfflineStatus())

    expect(result.current.isOnline).toBe(false)
    expect(result.current.isOffline).toBe(true)
    expect(result.current.wasOffline).toBe(false)
  })

  it('should update status when going offline', () => {
    const { result } = renderHook(() => useOfflineStatus())

    expect(result.current.isOnline).toBe(true)

    // Simulate going offline
    act(() => {
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOnline).toBe(false)
    expect(result.current.isOffline).toBe(true)
    expect(result.current.wasOffline).toBe(true)
  })

  it('should update status when coming back online', () => {
    navigator.onLine = false
    const { result } = renderHook(() => useOfflineStatus())

    // Start offline
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOffline).toBe(true)
    expect(result.current.wasOffline).toBe(true)

    // Come back online
    act(() => {
      navigator.onLine = true
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isOnline).toBe(true)
    expect(result.current.isOffline).toBe(false)
    expect(result.current.wasOffline).toBe(true) // Should still be true initially
  })

  it('should reset wasOffline after timeout when back online', () => {
    const { result } = renderHook(() => useOfflineStatus())

    // Go offline then online
    act(() => {
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
    })

    act(() => {
      navigator.onLine = true
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.wasOffline).toBe(true)

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.wasOffline).toBe(false)
  })
})

describe('useStaleDataDetection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigator.onLine = true
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not be stale for recent data', () => {
    const recentTime = new Date()
    const { result } = renderHook(() => 
      useStaleDataDetection(recentTime, 5 * 60 * 1000) // 5 minutes
    )

    expect(result.current.isStale).toBe(false)
    expect(result.current.isOffline).toBe(false)
  })

  it('should be stale for old data', () => {
    const oldTime = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
    const { result } = renderHook(() => 
      useStaleDataDetection(oldTime, 5 * 60 * 1000) // 5 minute threshold
    )

    expect(result.current.isStale).toBe(true)
  })

  it('should be stale when offline regardless of data age', () => {
    navigator.onLine = false
    const recentTime = new Date()
    
    const { result } = renderHook(() => 
      useStaleDataDetection(recentTime, 5 * 60 * 1000)
    )

    // Trigger offline event
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isStale).toBe(true)
    expect(result.current.isOffline).toBe(true)
  })

  it('should handle string dates', () => {
    const oldTimeString = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { result } = renderHook(() => 
      useStaleDataDetection(oldTimeString, 5 * 60 * 1000)
    )

    expect(result.current.isStale).toBe(true)
  })

  it('should not be stale when no lastUpdated is provided', () => {
    const { result } = renderHook(() => 
      useStaleDataDetection(null, 5 * 60 * 1000)
    )

    expect(result.current.isStale).toBe(false)
  })

  it('should update stale status periodically', () => {
    const initialTime = new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
    const { result } = renderHook(() => 
      useStaleDataDetection(initialTime, 5 * 60 * 1000) // 5 minute threshold
    )

    expect(result.current.isStale).toBe(false)

    // Fast-forward time to make data stale
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000) // Advance 4 minutes (total 6 minutes)
      vi.advanceTimersByTime(30 * 1000) // Trigger the 30-second check
    })

    expect(result.current.isStale).toBe(true)
  })

  it('should use custom stale threshold', () => {
    const timeAgo = new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
    const { result } = renderHook(() => 
      useStaleDataDetection(timeAgo, 1 * 60 * 1000) // 1 minute threshold
    )

    expect(result.current.isStale).toBe(true)
  })

  it('should return correct lastUpdated value', () => {
    const testDate = new Date('2023-01-01T12:00:00Z')
    const { result } = renderHook(() => 
      useStaleDataDetection(testDate)
    )

    expect(result.current.lastUpdated).toBe(testDate)
  })

  it('should handle rapid online/offline transitions', () => {
    const { result } = renderHook(() => 
      useStaleDataDetection(new Date(), 5 * 60 * 1000)
    )

    expect(result.current.isStale).toBe(false)

    // Go offline
    act(() => {
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isStale).toBe(true)

    // Come back online quickly
    act(() => {
      navigator.onLine = true
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isStale).toBe(false)

    // Go offline again
    act(() => {
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isStale).toBe(true)
  })

  it('should handle edge case with invalid dates', () => {
    const invalidDate = new Date('invalid')
    const { result } = renderHook(() => 
      useStaleDataDetection(invalidDate, 5 * 60 * 1000)
    )

    // Should not crash and should default to not stale
    expect(result.current.isStale).toBe(false)
  })

  it('should clean up intervals on unmount', () => {
    const { unmount } = renderHook(() => 
      useStaleDataDetection(new Date(), 5 * 60 * 1000)
    )

    // Should not throw errors when unmounting
    unmount()

    // Fast-forward time to ensure no memory leaks
    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })
  })
})

// Comprehensive offline status integration tests
describe('Offline status integration scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigator.onLine = true
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should handle complex offline/online scenarios with data staleness', () => {
    const dataTime = new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
    const { result } = renderHook(() => 
      useStaleDataDetection(dataTime, 5 * 60 * 1000) // 5 minute threshold
    )

    // Initially online with fresh data
    expect(result.current.isStale).toBe(false)
    expect(result.current.isOffline).toBe(false)

    // Go offline - should immediately be stale
    act(() => {
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isStale).toBe(true)
    expect(result.current.isOffline).toBe(true)

    // Come back online - data is still fresh by time
    act(() => {
      navigator.onLine = true
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isStale).toBe(false)
    expect(result.current.isOffline).toBe(false)

    // Fast-forward time to make data stale by age
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000) // Total 6 minutes old
      vi.advanceTimersByTime(30 * 1000) // Trigger check
    })

    expect(result.current.isStale).toBe(true)
    expect(result.current.isOffline).toBe(false)
  })

  it('should handle multiple components with different stale thresholds', () => {
    const dataTime = new Date(Date.now() - 3 * 60 * 1000) // 3 minutes ago

    const { result: result1 } = renderHook(() => 
      useStaleDataDetection(dataTime, 2 * 60 * 1000) // 2 minute threshold
    )

    const { result: result2 } = renderHook(() => 
      useStaleDataDetection(dataTime, 5 * 60 * 1000) // 5 minute threshold
    )

    // Component 1 should be stale (3 min > 2 min threshold)
    expect(result1.current.isStale).toBe(true)

    // Component 2 should not be stale (3 min < 5 min threshold)
    expect(result2.current.isStale).toBe(false)

    // Both should react to offline status
    act(() => {
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(result1.current.isStale).toBe(true)
    expect(result2.current.isStale).toBe(true)
  })

  it('should handle browser tab visibility changes', () => {
    const { result: offlineResult } = renderHook(() => useOfflineStatus())
    const dataTime = new Date()
    const { result: staleResult } = renderHook(() => 
      useStaleDataDetection(dataTime, 5 * 60 * 1000)
    )

    // Simulate tab becoming hidden (common cause of network issues)
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: true,
    })

    // Go offline while tab is hidden
    act(() => {
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(offlineResult.current.isOffline).toBe(true)
    expect(staleResult.current.isStale).toBe(true)

    // Tab becomes visible again
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false,
    })

    // Come back online
    act(() => {
      navigator.onLine = true
      window.dispatchEvent(new Event('online'))
    })

    expect(offlineResult.current.isOnline).toBe(true)
    expect(offlineResult.current.wasOffline).toBe(true)
    expect(staleResult.current.isStale).toBe(false)
  })

  it('should handle network recovery with stale data refresh', () => {
    const { result: offlineResult } = renderHook(() => useOfflineStatus())
    
    // Start online
    expect(offlineResult.current.isOnline).toBe(true)
    expect(offlineResult.current.wasOffline).toBe(false)

    // Go offline
    act(() => {
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(offlineResult.current.isOffline).toBe(true)
    expect(offlineResult.current.wasOffline).toBe(true)

    // Come back online
    act(() => {
      navigator.onLine = true
      window.dispatchEvent(new Event('online'))
    })

    expect(offlineResult.current.isOnline).toBe(true)
    expect(offlineResult.current.wasOffline).toBe(true)

    // wasOffline should reset after timeout
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(offlineResult.current.wasOffline).toBe(false)
  })
})
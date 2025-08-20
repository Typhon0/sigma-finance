import React, { useEffect, useState } from 'react'

interface AccessibilityAnnouncerProps {
  message: string
  priority?: 'polite' | 'assertive'
  clearAfter?: number
}

/**
 * Accessibility Announcer Component
 * 
 * Provides screen reader announcements for dynamic content changes
 * Uses ARIA live regions to communicate updates to assistive technologies
 */
export function AccessibilityAnnouncer({
  message,
  priority = 'polite',
  clearAfter = 3000
}: AccessibilityAnnouncerProps) {
  const [currentMessage, setCurrentMessage] = useState('')

  useEffect(() => {
    if (message) {
      setCurrentMessage(message)
      
      if (clearAfter > 0) {
        const timer = setTimeout(() => {
          setCurrentMessage('')
        }, clearAfter)
        
        return () => clearTimeout(timer)
      }
    }
  }, [message, clearAfter])

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
      role="status"
    >
      {currentMessage}
    </div>
  )
}

/**
 * Dashboard Status Announcer
 * 
 * Specialized announcer for dashboard loading states and updates
 */
export function DashboardStatusAnnouncer({
  isLoading,
  hasError,
  dataLoaded,
  portfolioCount,
  transactionCount
}: {
  isLoading: boolean
  hasError: boolean
  dataLoaded: boolean
  portfolioCount?: number
  transactionCount?: number
}) {
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (isLoading) {
      setAnnouncement('Loading dashboard data...')
    } else if (hasError) {
      setAnnouncement('Error loading dashboard data. Please try again.')
    } else if (dataLoaded) {
      const portfolioText = portfolioCount 
        ? `${portfolioCount} ${portfolioCount === 1 ? 'portfolio' : 'portfolios'}`
        : 'no portfolios'
      
      const transactionText = transactionCount 
        ? `${transactionCount} recent ${transactionCount === 1 ? 'transaction' : 'transactions'}`
        : 'no recent transactions'
      
      setAnnouncement(
        `Dashboard loaded successfully. Showing ${portfolioText} and ${transactionText}.`
      )
    }
  }, [isLoading, hasError, dataLoaded, portfolioCount, transactionCount])

  return (
    <AccessibilityAnnouncer 
      message={announcement}
      priority="polite"
      clearAfter={5000}
    />
  )
}

/**
 * Performance Update Announcer
 * 
 * Announces portfolio performance changes to screen readers
 */
export function PerformanceUpdateAnnouncer({
  totalValue,
  changePercent,
  changeAmount,
  previousValue
}: {
  totalValue: number
  changePercent: number
  changeAmount: number
  previousValue?: number
}) {
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (previousValue && previousValue !== totalValue) {
      const direction = changeAmount >= 0 ? 'increased' : 'decreased'
      const formattedValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(totalValue)
      
      const formattedChange = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(Math.abs(changeAmount))
      
      const formattedPercent = Math.abs(changePercent).toFixed(2)
      
      setAnnouncement(
        `Portfolio value updated. Total value is now ${formattedValue}, ${direction} by ${formattedChange} or ${formattedPercent} percent.`
      )
    }
  }, [totalValue, changePercent, changeAmount, previousValue])

  return (
    <AccessibilityAnnouncer 
      message={announcement}
      priority="polite"
      clearAfter={4000}
    />
  )
}

/**
 * Navigation Announcer
 * 
 * Announces navigation actions and focus changes
 */
export function NavigationAnnouncer({
  currentSection,
  totalSections
}: {
  currentSection?: string
  totalSections?: number
}) {
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (currentSection) {
      const sectionInfo = totalSections 
        ? ` (section ${totalSections} of ${totalSections})`
        : ''
      
      setAnnouncement(`Navigated to ${currentSection}${sectionInfo}`)
    }
  }, [currentSection, totalSections])

  return (
    <AccessibilityAnnouncer 
      message={announcement}
      priority="assertive"
      clearAfter={2000}
    />
  )
}

/**
 * Error Announcer
 * 
 * Announces errors with appropriate urgency
 */
export function ErrorAnnouncer({
  error,
  section
}: {
  error?: string | null
  section?: string
}) {
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (error) {
      const sectionText = section ? ` in ${section} section` : ''
      setAnnouncement(`Error${sectionText}: ${error}`)
    }
  }, [error, section])

  return (
    <AccessibilityAnnouncer 
      message={announcement}
      priority="assertive"
      clearAfter={6000}
    />
  )
}

/**
 * Success Announcer
 * 
 * Announces successful actions
 */
export function SuccessAnnouncer({
  message
}: {
  message?: string
}) {
  return (
    <AccessibilityAnnouncer 
      message={message || ''}
      priority="polite"
      clearAfter={3000}
    />
  )
}

export default AccessibilityAnnouncer
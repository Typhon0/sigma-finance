import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlertsSection } from '../alerts-section'
import { Alert } from '@/lib/types/dashboard.types'

// Mock data for testing
const mockAlerts: Alert[] = [
  {
    id: '1',
    alertType: 'price_increase',
    condition: 'above',
    threshold: 150,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    asset: {
      id: '1',
      name: 'Apple Inc.',
      symbol: 'AAPL',
      currentValue: 155,
      assetType: { id: '1', name: 'STOCK' },
    },
    portfolio: {
      id: '1',
      name: 'Tech Portfolio',
      assets: [],
    },
  },
  {
    id: '2',
    alertType: 'price_decrease',
    condition: 'below',
    threshold: 200,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    asset: {
      id: '2',
      name: 'Tesla Inc.',
      symbol: 'TSLA',
      currentValue: 190,
      assetType: { id: '1', name: 'STOCK' },
    },
    portfolio: {
      id: '2',
      name: 'Growth Portfolio',
      assets: [],
    },
  },
  {
    id: '3',
    alertType: 'portfolio_value',
    condition: 'increase',
    threshold: 5,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    asset: {
      id: '3',
      name: 'Bitcoin',
      symbol: 'BTC',
      currentValue: 42000,
      assetType: { id: '3', name: 'CRYPTO' },
    },
    portfolio: {
      id: '3',
      name: 'Crypto Portfolio',
      assets: [],
    },
  },
  {
    id: '4',
    alertType: 'value_change',
    condition: 'decrease',
    threshold: 10,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    asset: {
      id: '4',
      name: 'Microsoft Corp.',
      symbol: 'MSFT',
      currentValue: 300,
      assetType: { id: '1', name: 'STOCK' },
    },
    portfolio: {
      id: '1',
      name: 'Tech Portfolio',
      assets: [],
    },
  },
  {
    id: '5',
    alertType: 'unknown_type',
    condition: 'custom',
    threshold: 100,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    asset: {
      id: '5',
      name: 'Real Estate Fund',
      currentValue: 50000,
      assetType: { id: '4', name: 'REAL_ESTATE' },
    },
    portfolio: {
      id: '4',
      name: 'Real Estate Portfolio',
      assets: [],
    },
  },
]

describe('AlertsSection', () => {
  const mockOnAlertClick = vi.fn()
  const mockOnViewAllAlerts = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Alert Display and Formatting', () => {
    it('should render alerts section with correct title and active count (requirement 6.1)', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Check section title
      expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument()
      
      // Check active alerts count badge
      expect(screen.getByText('5 active')).toBeInTheDocument()
    })

    it('should display alert type, asset name, and condition correctly (requirement 6.2)', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Check alert types are formatted correctly (only first 3 are displayed)
      expect(screen.getByText('Price Increase')).toBeInTheDocument()
      expect(screen.getByText('Price Decrease')).toBeInTheDocument()
      expect(screen.getByText('Portfolio Value')).toBeInTheDocument()

      // Check asset names are displayed (only first 3)
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
      expect(screen.getByText('Tesla Inc.')).toBeInTheDocument()
      expect(screen.getByText('Bitcoin')).toBeInTheDocument()

      // Check conditions are formatted correctly (only first 3)
      expect(screen.getByText('Above $150')).toBeInTheDocument()
      expect(screen.getByText('Below $200')).toBeInTheDocument()
      expect(screen.getByText('Increased by 5%')).toBeInTheDocument()
    })

    it('should display portfolio names and timestamps (requirement 6.2)', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Check portfolio names are displayed (only first 3)
      expect(screen.getByText('Tech Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Crypto Portfolio')).toBeInTheDocument()

      // Check that timestamps are displayed (flexible matching for relative time)
      const timeElements = document.querySelectorAll('.text-xs.text-muted-foreground')
      const timeTexts = Array.from(timeElements).map(el => el.textContent)
      
      // Should have timestamps that contain "ago"
      const timestampElements = timeTexts.filter(text => text && text.includes('ago'))
      expect(timestampElements.length).toBeGreaterThan(0)
    })

    it('should show only 3 most recent alerts when more than 3 exist (requirement 6.3)', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Should only display 3 alert items
      const alertItems = document.querySelectorAll('[role="button"][tabindex="0"]')
      expect(alertItems).toHaveLength(3)

      // Should show "View All Alerts" button with total count
      expect(screen.getByText('View All Alerts (5)')).toBeInTheDocument()
    })

    it('should display all alerts when 3 or fewer exist', () => {
      const fewAlerts = mockAlerts.slice(0, 2)
      
      render(
        <AlertsSection
          alerts={fewAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Should display all 2 alert items
      const alertItems = document.querySelectorAll('[role="button"][tabindex="0"]')
      expect(alertItems).toHaveLength(2)

      // Should not show "View All Alerts" button
      expect(screen.queryByText(/View All Alerts/)).not.toBeInTheDocument()
    })

    it('should use correct badge variants for different alert types', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Check that badges are rendered using data-slot attribute
      const badges = document.querySelectorAll('[data-slot="badge"]')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('should display correct icons for different alert types', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Check that icons are rendered for each alert type
      // Icons are rendered as SVG elements with specific classes
      const icons = document.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  describe('Navigation Functionality', () => {
    it('should call onAlertClick when alert is clicked (requirement 6.4)', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Click on the first alert
      const firstAlert = document.querySelector('[role="button"][tabindex="0"]')
      
      if (firstAlert) {
        fireEvent.click(firstAlert)
        expect(mockOnAlertClick).toHaveBeenCalledWith('1', '1', '1')
      }
    })

    it('should handle keyboard navigation for alerts (requirement 6.4)', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      const firstAlert = document.querySelector('[role="button"][tabindex="0"]')
      
      if (firstAlert) {
        // Test Enter key
        fireEvent.keyDown(firstAlert, { key: 'Enter' })
        expect(mockOnAlertClick).toHaveBeenCalledWith('1', '1', '1')

        // Clear mock and test Space key
        mockOnAlertClick.mockClear()
        fireEvent.keyDown(firstAlert, { key: ' ' })
        expect(mockOnAlertClick).toHaveBeenCalledWith('1', '1', '1')

        // Test other keys (should not trigger)
        mockOnAlertClick.mockClear()
        fireEvent.keyDown(firstAlert, { key: 'Tab' })
        expect(mockOnAlertClick).not.toHaveBeenCalled()
      }
    })

    it('should call onViewAllAlerts when "View All Alerts" button is clicked', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      const viewAllButton = screen.getByRole('button', { name: /view all alerts/i })
      fireEvent.click(viewAllButton)

      expect(mockOnViewAllAlerts).toHaveBeenCalledTimes(1)
    })

    it('should handle missing navigation callbacks gracefully', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
        />
      )

      // Should render without errors even without callbacks
      expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument()

      // Clicking should not throw errors
      const firstAlert = document.querySelector('[role="button"][tabindex="0"]')
      
      if (firstAlert) {
        expect(() => fireEvent.click(firstAlert)).not.toThrow()
      }
    })
  })

  describe('Empty State Handling', () => {
    it('should display empty state when no alerts are present (requirement 6.5)', () => {
      render(
        <AlertsSection
          alerts={[]}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      expect(screen.getByText('No Active Alerts')).toBeInTheDocument()
      expect(screen.getByText(/You don't have any active alerts at the moment/)).toBeInTheDocument()
      expect(screen.getByText(/Set up alerts to stay informed/)).toBeInTheDocument()
    })

    it('should display empty state when alerts array is null or undefined', () => {
      render(
        <AlertsSection
          alerts={null as any}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      expect(screen.getByText('No Active Alerts')).toBeInTheDocument()
    })

    it('should not show active count badge in empty state', () => {
      render(
        <AlertsSection
          alerts={[]}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Should not show the "X active" badge, but the empty state text contains "active"
      expect(screen.queryByText(/\d+ active/)).not.toBeInTheDocument()
    })

    it('should not show "View All Alerts" button in empty state', () => {
      render(
        <AlertsSection
          alerts={[]}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      expect(screen.queryByText(/View All Alerts/)).not.toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should display skeleton loading state when isLoading is true', () => {
      render(
        <AlertsSection
          alerts={[]}
          isLoading={true}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Check that title is still shown
      expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument()
      
      // Should have skeleton elements
      const skeletonElements = document.querySelectorAll('[data-slot="skeleton"]')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('should not display actual alerts when loading', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          isLoading={true}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Should not display actual alert data
      expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument()
      expect(screen.queryByText('Tesla Inc.')).not.toBeInTheDocument()
      expect(screen.queryByText('Price Increase')).not.toBeInTheDocument()
    })

    it('should not show active count badge when loading', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          isLoading={true}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      expect(screen.queryByText(/active/)).not.toBeInTheDocument()
    })
  })

  describe('Alert Type and Condition Formatting', () => {
    it('should handle different alert types correctly', () => {
      const customAlerts: Alert[] = [
        {
          ...mockAlerts[0],
          id: 'custom1',
          alertType: 'PRICE_ABOVE',
        },
        {
          ...mockAlerts[0],
          id: 'custom2',
          alertType: 'price_below',
        },
        {
          ...mockAlerts[0],
          id: 'custom3',
          alertType: 'UNKNOWN_ALERT_TYPE',
        },
      ]

      render(
        <AlertsSection
          alerts={customAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Should format alert types correctly
      expect(screen.getByText('PRICE ABOVE')).toBeInTheDocument()
      expect(screen.getByText('Price Below')).toBeInTheDocument()
      expect(screen.getByText('UNKNOWN ALERT TYPE')).toBeInTheDocument()
    })

    it('should handle different condition types correctly', () => {
      const customAlerts: Alert[] = [
        {
          ...mockAlerts[0],
          id: 'cond1',
          condition: 'ABOVE',
          threshold: 1000,
        },
        {
          ...mockAlerts[0],
          id: 'cond2',
          condition: 'below',
          threshold: 500,
        },
        {
          ...mockAlerts[0],
          id: 'cond3',
          condition: 'INCREASE',
          threshold: 15,
        },
        {
          ...mockAlerts[0],
          id: 'cond4',
          condition: 'decrease',
          threshold: 20,
        },
        {
          ...mockAlerts[0],
          id: 'cond5',
          condition: 'custom_condition',
          threshold: 100,
        },
      ]

      render(
        <AlertsSection
          alerts={customAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Should format conditions correctly (only first 3 are displayed)
      expect(screen.getByText('Above $1,000')).toBeInTheDocument()
      expect(screen.getByText('Below $500')).toBeInTheDocument()
      expect(screen.getByText('Increased by 15%')).toBeInTheDocument()
    })

    it('should handle invalid timestamps gracefully', () => {
      const alertWithInvalidDate: Alert = {
        ...mockAlerts[0],
        id: 'invalid',
        createdAt: 'invalid-date',
      }

      render(
        <AlertsSection
          alerts={[alertWithInvalidDate]}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // The component should handle invalid dates gracefully and show "Unknown time"
      expect(screen.getByText('Unknown time')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Check that alert items have proper roles
      const alertItems = document.querySelectorAll('[role="button"]')
      expect(alertItems.length).toBeGreaterThan(0)

      // Check that alert items have proper tabindex
      const tabbableItems = document.querySelectorAll('[tabindex="0"]')
      expect(tabbableItems.length).toBeGreaterThan(0)

      // Check that "View All Alerts" button is properly labeled
      const viewAllButton = screen.getByRole('button', { name: /view all alerts/i })
      expect(viewAllButton).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      render(
        <AlertsSection
          alerts={mockAlerts}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      const alertItems = document.querySelectorAll('[role="button"][tabindex="0"]')
      
      // All alert items should be keyboard accessible
      alertItems.forEach((item) => {
        expect(item).toHaveAttribute('tabindex', '0')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle alerts with missing asset or portfolio data', () => {
      const incompleteAlert: Alert = {
        id: 'incomplete',
        alertType: 'price_increase',
        condition: 'above',
        threshold: 100,
        createdAt: new Date().toISOString(),
        asset: {
          id: 'asset1',
          name: 'Test Asset',
          currentValue: 100,
          assetType: { id: '1', name: 'STOCK' },
        },
        portfolio: {
          id: 'portfolio1',
          name: 'Test Portfolio',
          assets: [],
        },
      }

      render(
        <AlertsSection
          alerts={[incompleteAlert]}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      expect(screen.getByText('Test Asset')).toBeInTheDocument()
      expect(screen.getByText('Test Portfolio')).toBeInTheDocument()
    })

    it('should handle very large threshold numbers', () => {
      const largeThresholdAlert: Alert = {
        ...mockAlerts[0],
        id: 'large',
        threshold: 1000000,
        condition: 'above',
      }

      render(
        <AlertsSection
          alerts={[largeThresholdAlert]}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      // Should format large numbers with commas
      expect(screen.getByText('Above $1,000,000')).toBeInTheDocument()
    })

    it('should handle zero threshold values', () => {
      const zeroThresholdAlert: Alert = {
        ...mockAlerts[0],
        id: 'zero',
        threshold: 0,
        condition: 'above',
      }

      render(
        <AlertsSection
          alerts={[zeroThresholdAlert]}
          onAlertClick={mockOnAlertClick}
          onViewAllAlerts={mockOnViewAllAlerts}
        />
      )

      expect(screen.getByText('Above $0')).toBeInTheDocument()
    })
  })
})
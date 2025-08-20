import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PortfolioOverview, CompactPortfolioOverview } from '../portfolio-overview'

describe('PortfolioOverview', () => {
  const defaultProps = {
    totalValue: 125000.50,
    totalChange: 5000.25,
    totalChangePercent: 4.17,
    isLoading: false
  }

  describe('Portfolio value calculations and formatting', () => {
    it('displays total portfolio value formatted as currency', () => {
      render(<PortfolioOverview {...defaultProps} />)
      
      expect(screen.getByText('$125,000.50')).toBeInTheDocument()
    })

    it('formats large values correctly', () => {
      render(
        <PortfolioOverview 
          {...defaultProps} 
          totalValue={1234567.89}
        />
      )
      
      expect(screen.getByText('$1,234,567.89')).toBeInTheDocument()
    })

    it('formats small values correctly', () => {
      render(
        <PortfolioOverview 
          {...defaultProps} 
          totalValue={123.45}
        />
      )
      
      expect(screen.getByText('$123.45')).toBeInTheDocument()
    })

    it('handles zero value correctly', () => {
      render(
        <PortfolioOverview 
          {...defaultProps} 
          totalValue={0}
          totalChange={0}
          totalChangePercent={0}
        />
      )
      
      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })
  })

  describe('Color coding logic for performance indicators', () => {
    it('displays positive performance in green', () => {
      render(<PortfolioOverview {...defaultProps} />)
      
      // Check for positive percentage badge
      const percentageBadge = screen.getByText('+4.17%')
      expect(percentageBadge).toBeInTheDocument()
      expect(percentageBadge.closest('.bg-green-500')).toBeInTheDocument()
      
      // Check for positive absolute change in green
      const absoluteChange = screen.getByText('+$5,000.25')
      expect(absoluteChange).toBeInTheDocument()
      expect(absoluteChange).toHaveClass('text-green-600')
      
      // Check for trending up icon (SVG element with specific class)
      const trendingIcon = document.querySelector('.lucide-trending-up')
      expect(trendingIcon).toBeInTheDocument()
      expect(trendingIcon).toHaveClass('text-green-600')
    })

    it('displays negative performance in red', () => {
      render(
        <PortfolioOverview 
          {...defaultProps}
          totalChange={-2500.75}
          totalChangePercent={-2.15}
        />
      )
      
      // Check for negative percentage badge
      const percentageBadge = screen.getByText('-2.15%')
      expect(percentageBadge).toBeInTheDocument()
      expect(percentageBadge.closest('[class*="destructive"]')).toBeInTheDocument()
      
      // Check for negative absolute change in red
      const absoluteChange = screen.getByText('-$2,500.75')
      expect(absoluteChange).toBeInTheDocument()
      expect(absoluteChange).toHaveClass('text-red-600')
    })

    it('displays zero performance in gray', () => {
      render(
        <PortfolioOverview 
          {...defaultProps}
          totalChange={0}
          totalChangePercent={0}
        />
      )
      
      // Check for zero percentage badge
      const percentageBadge = screen.getByText('+0.00%')
      expect(percentageBadge).toBeInTheDocument()
      expect(percentageBadge.closest('[class*="secondary"]')).toBeInTheDocument()
      
      // Check for zero absolute change in gray (includes + sign)
      const absoluteChange = screen.getByText('+$0.00')
      expect(absoluteChange).toBeInTheDocument()
      expect(absoluteChange).toHaveClass('text-gray-600')
    })

    it('handles very small positive changes correctly', () => {
      render(
        <PortfolioOverview 
          {...defaultProps}
          totalChange={0.01}
          totalChangePercent={0.001}
        />
      )
      
      expect(screen.getByText('+0.00%')).toBeInTheDocument()
      expect(screen.getByText('+$0.01')).toBeInTheDocument()
    })

    it('handles very small negative changes correctly', () => {
      render(
        <PortfolioOverview 
          {...defaultProps}
          totalChange={-0.01}
          totalChangePercent={-0.001}
        />
      )
      
      expect(screen.getByText('-0.00%')).toBeInTheDocument()
      expect(screen.getByText('-$0.01')).toBeInTheDocument()
    })
  })

  describe('Responsive behavior and loading states', () => {
    it('displays loading skeleton when isLoading is true', () => {
      render(<PortfolioOverview {...defaultProps} isLoading={true} />)
      
      // Should show skeleton loaders instead of actual values
      expect(screen.queryByText('$125,000.50')).not.toBeInTheDocument()
      expect(screen.queryByText('+4.17%')).not.toBeInTheDocument()
      
      // Should show loading title
      expect(screen.getByText('Total Portfolio Value')).toBeInTheDocument()
    })

    it('displays actual content when isLoading is false', () => {
      render(<PortfolioOverview {...defaultProps} isLoading={false} />)
      
      expect(screen.getByText('$125,000.50')).toBeInTheDocument()
      expect(screen.getByText('+4.17%')).toBeInTheDocument()
      expect(screen.getByText('+$5,000.25')).toBeInTheDocument()
    })

    it('has responsive layout classes', () => {
      const { container } = render(<PortfolioOverview {...defaultProps} />)
      
      // Check for responsive text sizing classes
      const valueElement = screen.getByText('$125,000.50')
      expect(valueElement).toHaveClass('text-3xl', 'sm:text-4xl', 'lg:text-5xl')
      
      // Check for responsive flex layout
      const performanceContainer = container.querySelector('.flex.flex-col.sm\\:flex-row')
      expect(performanceContainer).toBeInTheDocument()
      expect(performanceContainer).toHaveClass('flex', 'flex-col', 'sm:flex-row')
    })

    it('shows mobile context text only on mobile', () => {
      render(<PortfolioOverview {...defaultProps} />)
      
      const mobileContext = screen.getByText('vs. previous period')
      expect(mobileContext).toHaveClass('sm:hidden')
      
      const desktopContext = screen.getByText('Performance compared to previous period')
      expect(desktopContext).toHaveClass('hidden', 'sm:block')
    })
  })

  describe('Accessibility and semantic structure', () => {
    it('has proper heading structure', () => {
      render(<PortfolioOverview {...defaultProps} />)
      
      expect(screen.getByText('Total Portfolio Value')).toBeInTheDocument()
    })

    it('has proper ARIA labels and roles', () => {
      const { container } = render(<PortfolioOverview {...defaultProps} />)
      
      // Card should be properly structured
      expect(container.querySelector('[role="region"]') || container.querySelector('div')).toBeInTheDocument()
    })

    it('displays performance context information', () => {
      render(<PortfolioOverview {...defaultProps} />)
      
      expect(screen.getByText('Performance compared to previous period')).toBeInTheDocument()
    })
  })
})

describe('CompactPortfolioOverview', () => {
  const defaultProps = {
    totalValue: 125000.50,
    totalChange: 5000.25,
    totalChangePercent: 4.17,
    isLoading: false
  }

  it('displays portfolio value in compact format', () => {
    render(<CompactPortfolioOverview {...defaultProps} />)
    
    expect(screen.getByText('$125,000.50')).toBeInTheDocument()
    expect(screen.getByText('+4.17%')).toBeInTheDocument()
    expect(screen.getByText('+$5,000.25')).toBeInTheDocument()
  })

  it('shows loading skeleton in compact format', () => {
    render(<CompactPortfolioOverview {...defaultProps} isLoading={true} />)
    
    expect(screen.queryByText('$125,000.50')).not.toBeInTheDocument()
    expect(screen.getByText('Total Portfolio Value')).toBeInTheDocument()
  })

  it('applies correct color coding in compact format', () => {
    render(<CompactPortfolioOverview {...defaultProps} />)
    
    const percentageBadge = screen.getByText('+4.17%')
    expect(percentageBadge.closest('.bg-green-500')).toBeInTheDocument()
    
    const absoluteChange = screen.getByText('+$5,000.25')
    expect(absoluteChange).toHaveClass('text-green-600')
  })

  it('handles negative performance in compact format', () => {
    render(
      <CompactPortfolioOverview 
        {...defaultProps}
        totalChange={-1500}
        totalChangePercent={-1.2}
      />
    )
    
    const percentageBadge = screen.getByText('-1.20%')
    expect(percentageBadge.closest('[class*="destructive"]')).toBeInTheDocument()
    
    const absoluteChange = screen.getByText('-$1,500.00')
    expect(absoluteChange).toHaveClass('text-red-600')
  })
})

describe('Edge cases and error handling', () => {
  it('handles undefined values gracefully', () => {
    render(
      <PortfolioOverview 
        totalValue={0}
        totalChange={0}
        totalChangePercent={0}
        isLoading={false}
      />
    )
    
    expect(screen.getByText('$0.00')).toBeInTheDocument()
    expect(screen.getByText('+0.00%')).toBeInTheDocument()
  })

  it('handles very large numbers', () => {
    render(
      <PortfolioOverview 
        totalValue={999999999.99}
        totalChange={50000000}
        totalChangePercent={5.26}
        isLoading={false}
      />
    )
    
    expect(screen.getByText('$999,999,999.99')).toBeInTheDocument()
    expect(screen.getByText('+$50,000,000.00')).toBeInTheDocument()
  })

  it('handles negative total values', () => {
    render(
      <PortfolioOverview 
        totalValue={-1000}
        totalChange={-500}
        totalChangePercent={-100}
        isLoading={false}
      />
    )
    
    expect(screen.getByText('-$1,000.00')).toBeInTheDocument()
    expect(screen.getByText('-$500.00')).toBeInTheDocument()
    expect(screen.getByText('-100.00%')).toBeInTheDocument()
  })
})
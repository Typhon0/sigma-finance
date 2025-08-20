import React from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
}

interface PortfolioBreadcrumbProps {
  items: BreadcrumbItem[]
}

export function PortfolioBreadcrumb({ items }: PortfolioBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <BreadcrumbItem className={index === 0 ? "hidden md:block" : ""}>
              {item.isActive ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={item.href || '#'}>
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < items.length - 1 && (
              <BreadcrumbSeparator className={index === 0 ? "hidden md:block" : ""} />
            )}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

// Predefined breadcrumb configurations for common portfolio pages
export const portfolioBreadcrumbs = {
  dashboard: [
    { label: 'Portfolio Tracker', href: '/dashboard' },
    { label: 'Dashboard', isActive: true }
  ],
  
  portfolios: [
    { label: 'Portfolio Tracker', href: '/dashboard' },
    { label: 'Portfolios', isActive: true }
  ],
  
  portfolioDetail: (portfolioName: string) => [
    { label: 'Portfolio Tracker', href: '/dashboard' },
    { label: 'Portfolios', href: '/portfolios' },
    { label: portfolioName, isActive: true }
  ],
  
  portfolioEdit: (portfolioName: string) => [
    { label: 'Portfolio Tracker', href: '/dashboard' },
    { label: 'Portfolios', href: '/portfolios' },
    { label: portfolioName, href: `/portfolios/${portfolioName.toLowerCase().replace(/\s+/g, '-')}` },
    { label: 'Edit', isActive: true }
  ],
  
  portfolioCreate: [
    { label: 'Portfolio Tracker', href: '/dashboard' },
    { label: 'Portfolios', href: '/portfolios' },
    { label: 'Create Portfolio', isActive: true }
  ],
  
  portfolioAnalytics: [
    { label: 'Portfolio Tracker', href: '/dashboard' },
    { label: 'Portfolios', href: '/portfolios' },
    { label: 'Analytics', isActive: true }
  ]
}
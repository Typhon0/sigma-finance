import { ChevronRight, Home, Folder, TrendingUp } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/hooks/use-dashboard-state';

interface DashboardBreadcrumbProps {
  items: BreadcrumbItemType[];
}

export function DashboardBreadcrumb({ items }: DashboardBreadcrumbProps) {
  // Handle empty items array
  if (!items || items.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList className="flex-wrap">
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              <span className="text-sm sm:text-base">Dashboard</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Add appropriate icons based on breadcrumb position and title
  const getIcon = (item: BreadcrumbItemType, index: number) => {
    if (index === 0 && item.title === 'Dashboard') {
      return <Home className="h-4 w-4" />;
    }
    if (index === 1) {
      return <Folder className="h-4 w-4" />;
    }
    if (index === 2) {
      return <TrendingUp className="h-4 w-4" />;
    }
    return null;
  };

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-wrap">
        {items.map((item, index) => {
          const icon = getIcon(item, index);
          const isLast = index === items.length - 1;
          
          return (
            <div key={index} className="flex items-center">
              <BreadcrumbItem>
                {item.onClick ? (
                  <BreadcrumbLink asChild>
                    <button
                      onClick={item.onClick}
                      className="flex items-center gap-1 touch-manipulation hover:underline transition-colors"
                    >
                      <span className="hidden sm:inline">{icon}</span>
                      <span className="text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px] lg:max-w-none">
                        {item.title}
                      </span>
                    </button>
                  </BreadcrumbLink>
                ) : item.href ? (
                  <BreadcrumbLink 
                    href={item.href}
                    className="flex items-center gap-1 touch-manipulation transition-colors"
                  >
                    <span className="hidden sm:inline">{icon}</span>
                    <span className="text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px] lg:max-w-none">
                      {item.title}
                    </span>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="flex items-center gap-1">
                    <span className="hidden sm:inline">{icon}</span>
                    <span className="text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px] lg:max-w-none">
                      {item.title}
                    </span>
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </BreadcrumbSeparator>
              )}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

// Utility functions for common dashboard breadcrumb patterns
export const dashboardBreadcrumbs = {
  overview: (): BreadcrumbItemType[] => [
    { title: 'Dashboard' }
  ],

  portfolioDetail: (portfolioName: string, onBackToDashboard: () => void): BreadcrumbItemType[] => [
    { 
      title: 'Dashboard', 
      onClick: onBackToDashboard 
    },
    { title: portfolioName }
  ],

  assetDetail: (
    portfolioName: string, 
    assetName: string, 
    onBackToDashboard: () => void,
    onBackToPortfolio: () => void
  ): BreadcrumbItemType[] => [
    { 
      title: 'Dashboard', 
      onClick: onBackToDashboard 
    },
    { 
      title: portfolioName, 
      onClick: onBackToPortfolio 
    },
    { title: assetName }
  ]
};
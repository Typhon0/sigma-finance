import { ChevronRight, Home, Folder, TrendingUp, ChevronLeft } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { useResponsiveDashboard } from '@/hooks/use-responsive-dashboard';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/hooks/use-dashboard-state';

interface DashboardBreadcrumbProps {
  items: BreadcrumbItemType[];
}



export function DashboardBreadcrumb({ items }: DashboardBreadcrumbProps) {
  const [responsiveState] = useResponsiveDashboard();
  
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

  // On mobile, show simplified navigation with back button for non-root pages
  if (responsiveState.isMobile && items.length > 1) {
    const currentItem = items[items.length - 1];
    const parentItem = items[items.length - 2];
    
    return (
      <div className="flex items-center gap-2">
        {parentItem?.onClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={parentItem.onClick}
            className="p-1 h-8 w-8 touch-manipulation"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back to {parentItem.title}</span>
          </Button>
        )}
        <div className="flex items-center gap-1 min-w-0">
          {getIcon(currentItem, items.length - 1)}
          <span className="text-sm font-medium truncate max-w-[200px]">
            {currentItem.title}
          </span>
        </div>
      </div>
    );
  }

  // Desktop and tablet: show full breadcrumb
  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-wrap">
        {items.map((item, index) => {
          const icon = getIcon(item, index);
          const isLast = index === items.length - 1;
          
          // On tablet, limit visible breadcrumbs to avoid overflow
          if (responsiveState.isTablet && items.length > 3 && index > 0 && index < items.length - 1) {
            return null;
          }
          
          return (
            <div key={index} className="flex items-center">
              <BreadcrumbItem>
                {item.onClick ? (
                  <BreadcrumbLink asChild>
                    <button
                      onClick={item.onClick}
                      className="flex items-center gap-1 touch-manipulation hover:underline transition-colors min-h-[44px] px-2 -mx-2 rounded-md"
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
                    className="flex items-center gap-1 touch-manipulation transition-colors min-h-[44px] px-2 -mx-2 rounded-md"
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
        
        {/* Show ellipsis on tablet when breadcrumbs are truncated */}
        {responsiveState.isTablet && items.length > 3 && (
          <BreadcrumbItem>
            <span className="text-muted-foreground">...</span>
          </BreadcrumbItem>
        )}
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
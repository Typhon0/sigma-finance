import React from 'react';
import { PerformanceDashboard } from '@/components/monitoring/performance-dashboard';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { useComponentMonitoring } from '@/hooks/use-dashboard-monitoring';

export function MonitoringDashboardPage() {
  const { trackComponentError } = useComponentMonitoring('monitoring-dashboard');

  // Error boundary for the monitoring dashboard
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      trackComponentError(new Error(event.message), {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [trackComponentError]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Performance Monitoring</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        
        <main className="flex-1 p-4">
          <PerformanceDashboard />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
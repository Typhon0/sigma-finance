import { AppSidebar } from "@/components/app-sidebar"
import { PortfolioBreadcrumb, portfolioBreadcrumbs } from "@/components/portfolio/portfolio-breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useDashboardCalculations } from "@/hooks/use-dashboard-calculations"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { PortfolioOverview } from "@/components/dashboard/portfolio-overview"
import { PortfolioSummaryCards } from "@/components/dashboard/portfolio-summary-cards"
import { AssetPerformanceComponent } from "@/components/dashboard/asset-performance"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { LazyAssetAllocationChart } from "@/components/dashboard/lazy-asset-allocation-chart"
import { AlertsSection } from "@/components/dashboard/alerts-section"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { DashboardErrorBoundary } from "@/components/dashboard/dashboard-error-boundary"
import { DashboardStatusAnnouncer } from "@/components/dashboard/accessibility-announcer"
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation"
import { AlertTriangle, RefreshCw } from "lucide-react"

// Main dashboard content component
function DashboardContent() {
  // For now, using a mock user ID - this would come from authentication context
  const userID = "user-1"
  
  const { data, loading, error, refetch } = useDashboardData(userID)
  const { data: calculations, loading: calculationsLoading } = useDashboardCalculations(userID)
  
  // Set up keyboard navigation for the dashboard
  const { containerRef } = useKeyboardNavigation({
    selector: 'button, [role="button"], a[href], [tabindex="0"]',
    skipDisabled: true,
    wrap: true
  })

  // Provide fallback values when calculations is null
  const safeCalculations = calculations || {
    totalValue: 0,
    totalChange: 0,
    totalChangePercent: 0,
    portfolios: [],
    topPerformingAssets: [],
    worstPerformingAssets: [],
    recentTransactions: [],
    assetAllocation: [],
    alerts: [],
    portfolioAllocation: []
  }

  // Calculate total assets count
  const totalAssets = safeCalculations.portfolios.reduce((total, portfolio) => 
    total + (portfolio.assets?.length || 0), 0
  )

  // Show skeleton loading state while data is being fetched
  if (loading || calculationsLoading) {
    return <DashboardSkeleton />
  }

  // Show error state with retry option
  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold text-destructive mb-2">
              Failed to load dashboard
            </h2>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              {error.message}
            </p>
            <Button onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="flex flex-1 flex-col gap-6 p-4 pt-0"
      role="main"
      aria-label="Portfolio Dashboard"
    >
      {/* Accessibility announcements */}
      <DashboardStatusAnnouncer
        isLoading={loading || calculationsLoading}
        hasError={!!error}
        dataLoaded={!!data && !!calculations}
        portfolioCount={data?.portfolios?.length}
        transactionCount={data?.transactions?.length}
      />
      {/* Portfolio Overview Section */}
      <DashboardErrorBoundary
        sectionName="Portfolio Overview"
        onRetry={() => refetch()}
      >
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          {/* Main Portfolio Overview - spans full width on mobile, 2 columns on large screens */}
          <div className="lg:col-span-2">
            <PortfolioOverview
              totalValue={safeCalculations.totalValue}
              totalChange={safeCalculations.totalChange}
              totalChangePercent={safeCalculations.totalChangePercent}
              isLoading={calculationsLoading}
            />
          </div>
          
          {/* Summary stats in a grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 lg:grid-cols-1">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Portfolios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.portfolios?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total portfolios managed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalAssets}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all portfolios
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.transactions?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 5 transactions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardErrorBoundary>

      {/* Portfolio Summary Cards Section */}
      <DashboardErrorBoundary
        sectionName="Portfolio Summary"
        onRetry={() => refetch()}
      >
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioSummaryCards
              portfolios={data?.portfolios || []}
              portfolioAllocation={safeCalculations.portfolioAllocation}
              isLoading={calculationsLoading}
              onCreatePortfolio={() => {
                // TODO: Implement create portfolio modal/navigation
                console.log('Create portfolio clicked')
              }}
              onPortfolioClick={(portfolioId) => {
                window.location.href = `/portfolios/${portfolioId}`
              }}
              onViewAllPortfolios={() => {
                window.location.href = '/portfolios'
              }}
            />
          </CardContent>
        </Card>
      </DashboardErrorBoundary>

      {/* Asset Performance Section */}
      <DashboardErrorBoundary
        sectionName="Asset Performance"
        onRetry={() => refetch()}
      >
        <AssetPerformanceComponent
          topPerformers={safeCalculations.topPerformingAssets}
          worstPerformers={safeCalculations.worstPerformingAssets}
          isLoading={calculationsLoading}
        />
      </DashboardErrorBoundary>

      {/* Recent Transactions Section */}
      <DashboardErrorBoundary
        sectionName="Recent Transactions"
        onRetry={() => refetch()}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <RecentTransactions
            transactions={data?.transactions || []}
            isLoading={loading}
            onTransactionClick={(transactionId) => {
              // TODO: Implement navigation to transaction details
              console.log(`Transaction clicked: ${transactionId}`)
            }}
            onViewAllTransactions={() => {
              // TODO: Implement navigation to all transactions
              console.log('View all transactions clicked')
            }}
          />

          <LazyAssetAllocationChart
            allocationData={safeCalculations.assetAllocation}
            isLoading={calculationsLoading}
            onAssetTypeClick={(assetType) => {
              // TODO: Implement filtering by asset type
              console.log(`Asset type clicked: ${assetType}`)
            }}
          />
        </div>
      </DashboardErrorBoundary>

      {/* Alerts and Quick Actions Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <DashboardErrorBoundary
          sectionName="Alerts"
          onRetry={() => refetch()}
        >
          <AlertsSection
            alerts={safeCalculations.alerts}
            isLoading={calculationsLoading}
            onAlertClick={(alertId, assetId, portfolioId) => {
              // TODO: Implement navigation to relevant asset or portfolio
              console.log(`Alert clicked: ${alertId}, Asset: ${assetId}, Portfolio: ${portfolioId}`)
            }}
            onViewAllAlerts={() => {
              // TODO: Implement navigation to all alerts page
              console.log('View all alerts clicked')
            }}
          />
        </DashboardErrorBoundary>

        <DashboardErrorBoundary
          sectionName="Quick Actions"
          onRetry={() => refetch()}
        >
          <QuickActions
            isLoading={loading}
          />
        </DashboardErrorBoundary>
      </div>
    </div>
  )
}

// Main dashboard home page component
export default function DashboardHomePage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PortfolioBreadcrumb items={portfolioBreadcrumbs.dashboard} />
          </div>
        </header>
        
        <DashboardErrorBoundary
          sectionName="Dashboard"
          fallback={(_, retry) => (
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              <Card className="border-destructive">
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                  <h2 className="text-xl font-semibold text-destructive mb-2">
                    Dashboard Error
                  </h2>
                  <p className="text-muted-foreground mb-6 text-center max-w-md">
                    Something went wrong while loading the dashboard. Please try refreshing the page.
                  </p>
                  <Button onClick={retry} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Reload Dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        >
          <DashboardContent />
        </DashboardErrorBoundary>
      </SidebarInset>
    </SidebarProvider>
  )
}
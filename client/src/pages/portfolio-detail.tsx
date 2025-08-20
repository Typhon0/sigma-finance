
import { useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { AppSidebar } from '@/components/app-sidebar'
import { PortfolioBreadcrumb, portfolioBreadcrumbs } from '@/components/portfolio/portfolio-breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Edit, Trash2, Copy, Download, Plus, MoreHorizontal, Minus } from 'lucide-react'
import { usePortfolioManagement, type PortfolioAsset } from '@/hooks/use-portfolio-management'
import { AddAssetDialog } from '@/components/portfolio/add-asset-dialog'
import { RemoveAssetDialog } from '@/components/portfolio/remove-asset-dialog'

export default function PortfolioDetailPage() {
  const { portfolioId } = useParams({ from: '/portfolios/$portfolioId' })
  const navigate = useNavigate()
  
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PortfolioBreadcrumb 
              items={portfolioBreadcrumbs.portfolioDetail(portfolio?.name || 'Portfolio Details')} 
            />
          </div>
        </header>
        <PortfolioDetailContent portfolioId={portfolioId} />
      </SidebarInset>
    </SidebarProvider>
  )
}

function PortfolioDetailContent({ portfolioId }: { portfolioId: string }) {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = usePortfolioManagement()
  
  // Dialog states
  const [showAddAssetDialog, setShowAddAssetDialog] = useState(false)
  const [showRemoveAssetDialog, setShowRemoveAssetDialog] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<PortfolioAsset | null>(null)

  // Find the specific portfolio
  const portfolio = data?.portfolios.find(p => p.id === portfolioId)

  const handleBack = () => {
    navigate({ to: '/portfolios' })
  }

  const handleEdit = () => {
    navigate({ to: `/portfolios/${portfolioId}/edit` })
  }

  const handleDelete = () => {
    // TODO: Show delete confirmation dialog
    console.log('Delete portfolio:', portfolioId)
  }

  const handleDuplicate = () => {
    // TODO: Show duplicate dialog
    console.log('Duplicate portfolio:', portfolioId)
  }

  const handleExport = () => {
    // TODO: Show export dialog
    console.log('Export portfolio:', portfolioId)
  }

  const handleAddAsset = () => {
    setShowAddAssetDialog(true)
  }

  const handleRemoveAsset = (asset: PortfolioAsset) => {
    setSelectedAsset(asset)
    setShowRemoveAssetDialog(true)
  }

  const handleAssetSuccess = () => {
    // Refetch portfolio data to get updated assets
    refetch()
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !portfolio) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card className="p-6">
          <CardHeader>
            <CardTitle className="text-destructive">
              {error ? 'Error Loading Portfolio' : 'Portfolio Not Found'}
            </CardTitle>
            <CardDescription>
              {error 
                ? 'There was an error loading the portfolio details.' 
                : 'The requested portfolio could not be found.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBack}>
              Back to Portfolios
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mock analytics data
  const mockAnalytics = {
    totalValue: 125000,
    totalCost: 112500,
    totalGainLoss: 12500,
    totalGainLossPercent: 11.11,
    assetCount: portfolio.assets?.length || 0
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatPercentage = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
  }

  const getPerformanceColor = (percent: number) => {
    if (percent > 0) return 'text-green-600'
    if (percent < 0) return 'text-red-600'
    return 'text-muted-foreground'
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header Section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portfolios
        </Button>
      </div>

      {/* Portfolio Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="text-muted-foreground max-w-2xl">
              {portfolio.description}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Created {new Date(portfolio.createdAt).toLocaleDateString()}</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Last updated {new Date(portfolio.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Portfolio Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockAnalytics.totalValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockAnalytics.totalCost)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gain/Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(mockAnalytics.totalGainLoss)}`}>
              {formatCurrency(mockAnalytics.totalGainLoss)}
            </div>
            <div className={`text-sm ${getPerformanceColor(mockAnalytics.totalGainLossPercent)}`}>
              {formatPercentage(mockAnalytics.totalGainLossPercent)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockAnalytics.assetCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Assets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Assets</CardTitle>
              <CardDescription>
                Assets in this portfolio
              </CardDescription>
            </div>
            <Button onClick={handleAddAsset}>
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {portfolio.assets && portfolio.assets.length > 0 ? (
            <div className="space-y-4">
              {portfolio.assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div>
                      <h4 className="font-medium">{asset.asset.name}</h4>
                      {asset.asset.symbol && (
                        <p className="text-sm text-muted-foreground">{asset.asset.symbol}</p>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {asset.asset.assetType.name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium">
                        Quantity: {asset.quantity.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Avg Price: {formatCurrency(asset.averagePurchasePrice)}
                      </div>
                      {asset.ownershipPct < 100 && (
                        <div className="text-sm text-muted-foreground">
                          Ownership: {asset.ownershipPct}%
                        </div>
                      )}
                      {asset.asset.currentValue && (
                        <div className="text-sm font-medium">
                          Current: {formatCurrency(asset.asset.currentValue * asset.quantity)}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => console.log('Edit asset:', asset.id)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Position
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleRemoveAsset(asset)}
                          className="text-destructive"
                        >
                          <Minus className="mr-2 h-4 w-4" />
                          Remove Asset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No assets in this portfolio yet.
              </p>
              <Button onClick={handleAddAsset}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Asset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asset Management Dialogs */}
      {portfolio && (
        <>
          <AddAssetDialog
            open={showAddAssetDialog}
            onOpenChange={setShowAddAssetDialog}
            portfolioID={portfolio.id}
            portfolioName={portfolio.name}
            onSuccess={handleAssetSuccess}
          />
          <RemoveAssetDialog
            open={showRemoveAssetDialog}
            onOpenChange={setShowRemoveAssetDialog}
            portfolioID={portfolio.id}
            portfolioName={portfolio.name}
            asset={selectedAsset}
            onSuccess={handleAssetSuccess}
          />
        </>
      )}
    </div>
  )
}
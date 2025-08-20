import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AppSidebar } from '@/components/app-sidebar'
import { PortfolioBreadcrumb, portfolioBreadcrumbs } from '@/components/portfolio/portfolio-breadcrumb'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { usePortfolioManagement, Portfolio } from '@/hooks/use-portfolio-management'
import { PortfolioList, SortBy } from '@/components/portfolio/portfolio-list'
import { PortfolioAction, ViewMode } from '@/components/portfolio/portfolio-card'
import { PortfolioDeleteDialog } from '@/components/portfolio/portfolio-delete-dialog'
import { PortfolioDuplicateDialog, DuplicatePortfolioInput } from '@/components/portfolio/portfolio-duplicate-dialog'
import { toast } from 'sonner'

interface PortfoliosPageProps {}

export default function PortfoliosPage({}: PortfoliosPageProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-2 md:px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12" role="banner">
          <div className="flex items-center gap-2 w-full">
            <SidebarTrigger className="-ml-1" aria-label="Open sidebar navigation" />
            <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />
            <div className="hidden md:flex">
              <PortfolioBreadcrumb items={portfolioBreadcrumbs.portfolios} />
            </div>
          </div>
        </header>
        <main role="main" aria-label="Portfolio management" className="w-full max-w-full overflow-x-auto">
          <PortfoliosContent />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function PortfoliosContent() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [selectedPortfolios, setSelectedPortfolios] = useState<string[]>([])
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [portfolioToDelete, setPortfolioToDelete] = useState<Portfolio | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Duplicate dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [portfolioToDuplicate, setPortfolioToDuplicate] = useState<Portfolio | null>(null)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | undefined>()

  const { data, loading, error, deletePortfolio, duplicatePortfolio, undoDeletePortfolio } = usePortfolioManagement()

  const portfolios = data?.portfolios || []

  // Filter portfolios based on search query
  const filteredPortfolios = portfolios.filter(portfolio =>
    portfolio.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (portfolio.description && portfolio.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Sort portfolios based on selected criteria
  const sortedPortfolios = [...filteredPortfolios].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'value':
        // Mock sorting by value - would use analytics data in real implementation
        return 0
      case 'performance':
        // Mock sorting by performance - would use analytics data in real implementation
        return 0
      case 'created':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      default:
        return 0
    }
  })

  const handleCreatePortfolio = () => {
    // For now, just show an alert - will be implemented in later tasks
    alert('Portfolio creation will be implemented in the next task')
  }

  const handlePortfolioAction = (action: PortfolioAction, portfolioId: string) => {
    switch (action) {
      case 'view':
        // For now, just show an alert - will be implemented in later tasks
        alert(`View portfolio ${portfolioId} - will be implemented in the next task`)
        break
      case 'edit':
        // TODO: Navigate to edit page
        console.log('Edit portfolio:', portfolioId)
        break
      case 'delete':
        const portfolio = portfolios.find(p => p.id === portfolioId)
        if (portfolio) {
          setPortfolioToDelete(portfolio)
          setDeleteDialogOpen(true)
        }
        break
      case 'duplicate':
        const portfolioToDup = portfolios.find(p => p.id === portfolioId)
        if (portfolioToDup) {
          setPortfolioToDuplicate(portfolioToDup)
          setDuplicateDialogOpen(true)
          setDuplicateError(undefined)
        }
        break
      case 'export':
        // TODO: Show export dialog
        console.log('Export portfolio:', portfolioId)
        break
      default:
        console.log(`Unknown action ${action} on portfolio ${portfolioId}`)
    }
  }

  const handleDeleteConfirm = async (portfolioId: string) => {
    setIsDeleting(true)
    try {
      const portfolioToUndo = portfolioToDelete
      await deletePortfolio(portfolioId)
      
      // Show success toast with undo option
      toast.success('Portfolio deleted successfully', {
        action: portfolioToUndo ? {
          label: 'Undo',
          onClick: async () => {
            try {
              await undoDeletePortfolio(portfolioToUndo)
              toast.success('Portfolio restored successfully')
            } catch (error) {
              console.error('Error undoing deletion:', error)
              toast.error('Failed to restore portfolio')
            }
          }
        } : undefined,
        duration: 10000, // Give user 10 seconds to undo
      })
      
      setDeleteDialogOpen(false)
      setPortfolioToDelete(null)
    } catch (error) {
      console.error('Error deleting portfolio:', error)
      toast.error('Failed to delete portfolio. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setPortfolioToDelete(null)
  }

  const handleDuplicateConfirm = async (input: DuplicatePortfolioInput) => {
    setIsDuplicating(true)
    setDuplicateError(undefined)
    
    try {
      const result = await duplicatePortfolio(input)
      
      // Show success toast
      toast.success('Portfolio duplicated successfully', {
        description: `Created "${input.newName}" with ${input.copyAssets ? 'assets copied' : 'no assets'}`,
      })
      
      // Close dialog
      setDuplicateDialogOpen(false)
      setPortfolioToDuplicate(null)
      
      // Navigate to the new portfolio (optional - could be implemented later)
      // navigate({ to: `/portfolios/${result.data.duplicatePortfolio.id}` })
      
    } catch (error: any) {
      console.error('Error duplicating portfolio:', error)
      
      // Handle specific error types
      let errorMessage = 'Failed to duplicate portfolio. Please try again.'
      
      if (error.message?.includes('name already exists') || error.message?.includes('duplicate')) {
        errorMessage = 'A portfolio with this name already exists. Please choose a different name.'
      } else if (error.message?.includes('validation')) {
        errorMessage = 'Invalid portfolio data. Please check your inputs and try again.'
      }
      
      setDuplicateError(errorMessage)
    } finally {
      setIsDuplicating(false)
    }
  }

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false)
    setPortfolioToDuplicate(null)
    setDuplicateError(undefined)
  }

  const handleReorder = (reorderedPortfolios: any[]) => {
    // TODO: Implement portfolio reordering API call
    console.log('Reordered portfolios:', reorderedPortfolios.map(p => p.name))
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card className="p-6">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Portfolios</CardTitle>
            <CardDescription>
              There was an error loading your portfolios. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
  <div className="flex flex-1 flex-col gap-4 p-4 pt-0" role="region" aria-label="Portfolios list">
      {/* Header Section */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolios</h1>
          <p className="text-muted-foreground">
            Manage and monitor your investment portfolios
          </p>
        </div>
        <Button onClick={handleCreatePortfolio} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Create Portfolio
        </Button>
      </div>

      {/* Search Section */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search portfolios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {!loading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredPortfolios.length} of {portfolios.length} portfolios
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
          {selectedPortfolios.length > 0 && (
            <Badge variant="secondary">
              {selectedPortfolios.length} selected
            </Badge>
          )}
        </div>
      )}

      {/* Portfolio Content */}
      {sortedPortfolios.length === 0 ? (
        portfolios.length === 0 ? (
          <EmptyState onCreatePortfolio={handleCreatePortfolio} />
        ) : (
          <NoResultsState searchQuery={searchQuery} onClearSearch={() => setSearchQuery('')} />
        )
      ) : (
        <PortfolioList
          portfolios={sortedPortfolios}
          viewMode={viewMode}
          sortBy={sortBy}
          selectedPortfolios={selectedPortfolios}
          onSelectionChange={setSelectedPortfolios}
          onPortfolioAction={handlePortfolioAction}
          onViewModeChange={setViewMode}
          onSortChange={setSortBy}
          onReorder={handleReorder}
          isLoading={loading}
        />
      )}

      {/* Delete Dialog */}
      <PortfolioDeleteDialog
        portfolio={portfolioToDelete}
        isOpen={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* Duplicate Dialog */}
      <PortfolioDuplicateDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        portfolio={portfolioToDuplicate}
        onDuplicate={handleDuplicateConfirm}
        isLoading={isDuplicating}
        errorMessage={duplicateError}
      />
    </div>
  )
}

// Empty State Component
function EmptyState({ onCreatePortfolio }: { onCreatePortfolio: () => void }) {
  return (
    <Card className="p-8 md:p-12 text-center" role="status" aria-live="polite">
      <div className="mx-auto max-w-md w-full">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Plus className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No portfolios yet</h3>
        <p className="text-muted-foreground mb-6">
          Get started by creating your first portfolio to track your investments.
        </p>
        <Button onClick={onCreatePortfolio} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Create Your First Portfolio
        </Button>
      </div>
    </Card>
  )
}

// No Results State Component
function NoResultsState({ 
  searchQuery, 
  onClearSearch 
}: { 
  searchQuery: string
  onClearSearch: () => void 
}) {
  return (
    <Card className="p-8 md:p-12 text-center" role="status" aria-live="polite">
      <div className="mx-auto max-w-md w-full">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No portfolios found</h3>
        <p className="text-muted-foreground mb-6">
          No portfolios match your search for "{searchQuery}". Try adjusting your search terms.
        </p>
        <Button variant="outline" onClick={onClearSearch} className="w-full md:w-auto">
          Clear Search
        </Button>
      </div>
    </Card>
  )
}


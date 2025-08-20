
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth-context'
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
import { ArrowLeft } from 'lucide-react'
import { PortfolioForm } from '@/components/portfolio/portfolio-form'
import { usePortfolioManagement } from '@/hooks/use-portfolio-management'

export default function PortfolioCreatePage() {
  const navigate = useNavigate()
  
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PortfolioBreadcrumb items={portfolioBreadcrumbs.portfolioCreate} />
          </div>
        </header>
        <PortfolioCreateContent />
      </SidebarInset>
    </SidebarProvider>
  )
}

function PortfolioCreateContent() {
  const navigate = useNavigate()
  const { createPortfolio } = usePortfolioManagement()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSubmit = async (data: { name: string; description?: string }) => {
    if (!user?.id) {
      setErrorMessage('User not authenticated. Please log in and try again.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    
    try {
      const result = await createPortfolio({
        userID: user.id,
        name: data.name,
        description: data.description || undefined,
      })
      
      if (result.data?.createPortfolio) {
        setShowSuccess(true)
        // Navigate to the portfolios page after a brief delay to show success message
        setTimeout(() => {
          navigate({ to: '/portfolios' })
        }, 1500)
      } else {
        setErrorMessage('Failed to create portfolio. Please try again.')
      }
    } catch (error: any) {
      console.error('Error creating portfolio:', error)
      
      // Handle specific error types
      if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
        setErrorMessage('A portfolio with this name already exists. Please choose a different name.')
      } else if (error.message?.includes('validation')) {
        setErrorMessage('Please check your input and try again.')
      } else {
        setErrorMessage('Failed to create portfolio. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/portfolios' })
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header Section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portfolios
        </Button>
      </div>

      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Create Portfolio</h1>
          <p className="text-muted-foreground">
            Create a new portfolio to organize and track your investments.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Details</CardTitle>
            <CardDescription>
              Enter the basic information for your new portfolio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PortfolioForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={isLoading}
              showSuccessMessage={showSuccess}
              errorMessage={errorMessage}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
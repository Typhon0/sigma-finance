import React, { useState, useMemo } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, AlertTriangle, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useAssetManagement } from '@/hooks/use-asset-management'
import type { PortfolioAsset } from '@/hooks/use-portfolio-management'

interface RemoveAssetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolioID: string
  portfolioName: string
  asset: PortfolioAsset | null
  onSuccess?: () => void
}

export function RemoveAssetDialog({
  open,
  onOpenChange,
  portfolioID,
  portfolioName,
  asset,
  onSuccess,
}: RemoveAssetDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const { removeAssetFromPortfolio } = useAssetManagement()

  // Calculate impact metrics
  const impactMetrics = useMemo(() => {
    if (!asset) return null

    const currentValue = (asset.asset.currentValue || 0) * asset.quantity
    const purchaseValue = (asset.averagePurchasePrice || 0) * asset.quantity
    const gainLoss = currentValue - purchaseValue
    const gainLossPercent = purchaseValue > 0 ? (gainLoss / purchaseValue) * 100 : 0

    return {
      currentValue,
      purchaseValue,
      gainLoss,
      gainLossPercent,
    }
  }, [asset])

  // Handle removal
  const handleRemove = async () => {
    if (!asset) return

    setIsRemoving(true)
    try {
      await removeAssetFromPortfolio(portfolioID, asset.asset.id)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to remove asset from portfolio:', error)
      // Error handling - could show a toast notification
    } finally {
      setIsRemoving(false)
    }
  }

  // Handle dialog close
  const handleClose = () => {
    if (!isRemoving) {
      onOpenChange(false)
    }
  }

  if (!asset || !impactMetrics) {
    return null
  }

  const hasGain = impactMetrics.gainLoss > 0
  const hasLoss = impactMetrics.gainLoss < 0
  const hasTransactionDependencies = false // TODO: Check for transaction dependencies

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Minus className="h-5 w-5 text-destructive" />
            Remove Asset from {portfolioName}
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are about to remove <strong>{asset.asset.name}</strong> from your portfolio.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Asset Details */}
          <div className="rounded-lg border p-4">
            <h4 className="font-medium mb-3">Asset Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Name:</span>
                <span className="font-medium">{asset.asset.name}</span>
              </div>
              {asset.asset.symbol && (
                <div className="flex justify-between">
                  <span>Symbol:</span>
                  <Badge variant="secondary">{asset.asset.symbol}</Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span>Type:</span>
                <Badge variant="outline">{asset.asset.assetType.name}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Quantity:</span>
                <span className="font-medium">{asset.quantity.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Ownership:</span>
                <span className="font-medium">{asset.ownershipPct}%</span>
              </div>
            </div>
          </div>

          {/* Financial Impact */}
          <div className="rounded-lg border p-4">
            <h4 className="font-medium mb-3">Financial Impact</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Current Value:</span>
                <span className="font-medium">${impactMetrics.currentValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Purchase Value:</span>
                <span className="font-medium">${impactMetrics.purchaseValue.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span>Gain/Loss:</span>
                <div className="flex items-center gap-1">
                  {hasGain && <TrendingUp className="h-4 w-4 text-green-500" />}
                  {hasLoss && <TrendingDown className="h-4 w-4 text-red-500" />}
                  <span className={`font-medium ${
                    hasGain ? 'text-green-600 dark:text-green-400' : 
                    hasLoss ? 'text-red-600 dark:text-red-400' : 
                    'text-muted-foreground'
                  }`}>
                    ${impactMetrics.gainLoss.toFixed(2)} ({impactMetrics.gainLossPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Portfolio Impact */}
          <div className="rounded-lg border p-4 bg-orange-50 dark:bg-orange-950/20">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Portfolio Impact
            </h4>
            <p className="text-sm text-muted-foreground">
              Removing this asset will reduce your portfolio value by ${impactMetrics.currentValue.toFixed(2)}.
              The asset allocation and performance metrics will be recalculated.
            </p>
          </div>

          {/* Transaction Dependencies Warning */}
          {hasTransactionDependencies && (
            <div className="rounded-lg border p-4 bg-red-50 dark:bg-red-950/20">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Transaction Dependencies
              </h4>
              <p className="text-sm text-muted-foreground">
                This asset has associated transactions. Removing it may affect your transaction history
                and portfolio calculations.
              </p>
            </div>
          )}

          {/* Confirmation Requirements */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Confirmation Required</h4>
            <p className="text-sm text-muted-foreground">
              Please confirm that you want to remove <strong>{asset.asset.name}</strong> from 
              your <strong>{portfolioName}</strong> portfolio. This action cannot be undone.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={isRemoving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Remove Asset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
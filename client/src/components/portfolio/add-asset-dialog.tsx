import React, { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Plus, DollarSign, Hash } from 'lucide-react'
import {  useAssetManagement, useAssets, useAssetTypes } from '@/hooks/use-asset-management'

// Form validation schema
const addAssetFormSchema = z.object({
  assetID: z.string().min(1, 'Please select an asset'),
  quantity: z.number().min(0.000001, 'Quantity must be greater than 0'),
  averagePurchasePrice: z.number().min(0, 'Purchase price must be greater than or equal to 0').optional(),
})

type AddAssetFormData = z.infer<typeof addAssetFormSchema>

interface AddAssetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolioID: string
  portfolioName: string
  onSuccess?: () => void
}

export function AddAssetDialog({
  open,
  onOpenChange,
  portfolioID,
  portfolioName,
  onSuccess,
}: AddAssetDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAssetTypeID, setSelectedAssetTypeID] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Hooks
  const { assetTypes, loading: assetTypesLoading } = useAssetTypes()
  const { assets, loading: assetsLoading, refetch: refetchAssets } = useAssets(
    {
      assetTypeID: selectedAssetTypeID || undefined,
      nameContains: searchTerm || undefined,
    },
    { limit: 50 },
    { field: 'NAME', direction: 'ASC' }
  )
  const { addAssetToPortfolio } = useAssetManagement()

  // Form setup
  const form = useForm<AddAssetFormData>({
    resolver: zodResolver(addAssetFormSchema),
    defaultValues: {
      assetID: '',
      quantity: 1,
      averagePurchasePrice: undefined,
    },
  })

  // Filter assets based on search and type
  const filteredAssets = useMemo(() => {
    let filtered = assets

    if (searchTerm) {
      filtered = filtered.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.symbol && asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    return filtered
  }, [assets, searchTerm])

  // Get selected asset details
  const selectedAsset = useMemo(() => {
    const assetID = form.watch('assetID')
    return assets.find(asset => asset.id === assetID)
  }, [assets, form.watch('assetID')])

  // Handle form submission
  const onSubmit = async (data: AddAssetFormData) => {
    if (!selectedAsset) return

    setIsSubmitting(true)
    try {
      await addAssetToPortfolio({
        portfolioID,
        assetID: data.assetID,
        quantity: data.quantity,
        averagePurchasePrice: data.averagePurchasePrice,
      })

      // Reset form and close dialog
      form.reset()
      setSearchTerm('')
      setSelectedAssetTypeID('')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to add asset to portfolio:', error)
      // Error handling will be shown by the form
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle dialog close
  const handleClose = () => {
    if (!isSubmitting) {
      form.reset()
      setSearchTerm('')
      setSelectedAssetTypeID('')
      onOpenChange(false)
    }
  }

  // Calculate estimated value
  const estimatedValue = useMemo(() => {
    const quantity = form.watch('quantity')
    const price = form.watch('averagePurchasePrice') || selectedAsset?.currentValue
    
    if (quantity && price) {
      return quantity * price
    }
    return null
  }, [form.watch('quantity'), form.watch('averagePurchasePrice'), selectedAsset?.currentValue])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Asset to {portfolioName}
          </DialogTitle>
          <DialogDescription>
            Search and select an asset to add to your portfolio. Specify the quantity and purchase price.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Asset Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Asset Type</label>
              <Select
                value={selectedAssetTypeID || "all"}
                onValueChange={(value) => setSelectedAssetTypeID(value === "all" ? "" : value)}
                disabled={assetTypesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All asset types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All asset types</SelectItem>
                  {assetTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Assets</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or symbol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Asset Selection */}
            <FormField
              control={form.control}
              name="assetID"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Asset</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an asset" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[200px]">
                      {assetsLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="ml-2">Loading assets...</span>
                        </div>
                      ) : filteredAssets.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No assets found
                        </div>
                      ) : (
                        filteredAssets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{asset.name}</span>
                                {asset.symbol && (
                                  <Badge variant="secondary" className="text-xs">
                                    {asset.symbol}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  {asset.assetType.name}
                                </Badge>
                                {asset.currentValue && (
                                  <span>${asset.currentValue.toFixed(2)}</span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the asset you want to add to your portfolio
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Selected Asset Preview */}
            {selectedAsset && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-medium mb-2">Selected Asset</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Name:</span>
                    <span className="font-medium">{selectedAsset.name}</span>
                  </div>
                  {selectedAsset.symbol && (
                    <div className="flex justify-between">
                      <span>Symbol:</span>
                      <Badge variant="secondary">{selectedAsset.symbol}</Badge>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <Badge variant="outline">{selectedAsset.assetType.name}</Badge>
                  </div>
                  {selectedAsset.currentValue && (
                    <div className="flex justify-between">
                      <span>Current Value:</span>
                      <span className="font-medium">${selectedAsset.currentValue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quantity Input */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Quantity
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      placeholder="Enter quantity"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Number of units/shares you own
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Purchase Price Input */}
            <FormField
              control={form.control}
              name="averagePurchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Average Purchase Price (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter purchase price"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                    />
                  </FormControl>
                  <FormDescription>
                    Average price per unit when you purchased this asset
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Estimated Value */}
            {estimatedValue && (
              <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Estimated Total Value:</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    ${estimatedValue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !selectedAsset}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Asset
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
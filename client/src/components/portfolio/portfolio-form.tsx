
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

const portfolioFormSchema = z.object({
  name: z.string()
    .min(3, 'Portfolio name must be at least 3 characters')
    .max(100, 'Portfolio name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Portfolio name can only contain letters, numbers, spaces, hyphens, and underscores'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .or(z.literal('')),
})

export type PortfolioFormData = z.infer<typeof portfolioFormSchema>

interface PortfolioFormProps {
  portfolio?: {
    name: string
    description?: string
  }
  onSubmit: (data: PortfolioFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  showSuccessMessage?: boolean
  errorMessage?: string
}

export function PortfolioForm({
  portfolio,
  onSubmit,
  onCancel,
  isLoading = false,
  showSuccessMessage = false,
  errorMessage
}: PortfolioFormProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSubmitSuccessful, setIsSubmitSuccessful] = useState(false)
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false)

  const form = useForm<PortfolioFormData>({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: {
      name: portfolio?.name || '',
      description: portfolio?.description || '',
    },
    mode: 'onChange', // Enable real-time validation
  })

  const { handleSubmit, formState: { errors, isSubmitting, isDirty, isValid }, reset, watch } = form

  // Watch for form changes to detect unsaved changes
  const watchedValues = watch()
  
  useEffect(() => {
    setHasUnsavedChanges(isDirty)
  }, [isDirty])

  // Reset success message when form changes
  useEffect(() => {
    if (isSubmitSuccessful && isDirty) {
      setIsSubmitSuccessful(false)
    }
  }, [isDirty, isSubmitSuccessful])

  const handleFormSubmit = async (data: PortfolioFormData) => {
    try {
      await onSubmit(data)
      setIsSubmitSuccessful(true)
      setHasUnsavedChanges(false)
      
      // If creating a new portfolio, reset the form
      if (!portfolio) {
        reset()
      }
    } catch (error) {
      // Error handling is done in the parent component
      console.error('Form submission error:', error)
      setIsSubmitSuccessful(false)
    }
  }

  const handleReset = () => {
    reset({
      name: portfolio?.name || '',
      description: portfolio?.description || '',
    })
    setHasUnsavedChanges(false)
    setIsSubmitSuccessful(false)
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowCancelConfirmation(true)
      return
    }
    onCancel()
  }

  const handleConfirmCancel = () => {
    setShowCancelConfirmation(false)
    onCancel()
  }

  const isFormLoading = isLoading || isSubmitting

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {(isSubmitSuccessful || showSuccessMessage) && (
        <Alert variant="success">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Portfolio {portfolio ? 'updated' : 'created'} successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Portfolio Name Field */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Portfolio Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter portfolio name"
                    disabled={isFormLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Choose a unique name for your portfolio. Use letters, numbers, spaces, hyphens, and underscores only.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Portfolio Description Field */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe your portfolio strategy or goals..."
                    className="resize-none"
                    disabled={isFormLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Add a description to help you remember this portfolio's purpose (max 500 characters).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          {/* Unsaved Changes Warning */}
          {hasUnsavedChanges && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. Don't forget to save your portfolio.
              </AlertDescription>
            </Alert>
          )}

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isFormLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              disabled={isFormLoading || !isDirty}
              className="w-full sm:w-auto"
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isFormLoading || !isValid}
              className="w-full sm:w-auto"
            >
              {isFormLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {portfolio ? 'Update Portfolio' : 'Create Portfolio'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Confirmation Dialog for Unsaved Changes */}
      <ConfirmationDialog
        open={showCancelConfirmation}
        onOpenChange={setShowCancelConfirmation}
        title="Unsaved Changes"
        description="You have unsaved changes that will be lost. Are you sure you want to cancel?"
        confirmText="Yes, Cancel"
        cancelText="Keep Editing"
        onConfirm={handleConfirmCancel}
        variant="destructive"
      />
    </div>
  )
}
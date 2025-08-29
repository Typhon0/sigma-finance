import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle, Loader2, Save, X, RotateCcw } from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { 
  portfolioFormSchema, 
  type PortfolioFormData, 
  type PortfolioFormMode,
  type PortfolioFormError,
  portfolioValidationHelpers,
  portfolioFormConfig,
  portfolioErrorMessages,
} from "@/lib/validations/portfolio.schemas";

export interface EnhancedPortfolioFormProps {
  /** Portfolio data for edit mode */
  portfolio?: {
    id?: string;
    name: string;
    description?: string | null;
  };
  /** Form mode - create or edit */
  mode: PortfolioFormMode;
  /** Submit handler */
  onSubmit: (data: PortfolioFormData) => Promise<void>;
  /** Cancel handler */
  onCancel: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Success message display */
  showSuccessMessage?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Existing portfolio names for validation */
  existingPortfolioNames?: string[];
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Show reset button */
  showResetButton?: boolean;
  /** Show cancel confirmation for unsaved changes */
  showCancelConfirmation?: boolean;
  /** Custom submit button text */
  submitButtonText?: string;
  /** Custom cancel button text */
  cancelButtonText?: string;
  /** Disable form */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Success callback */
  onSuccess?: (data: PortfolioFormData) => void;
  /** Error callback */
  onError?: (error: PortfolioFormError) => void;
}

export function EnhancedPortfolioForm({
  portfolio,
  mode,
  onSubmit,
  onCancel,
  isLoading = false,
  showSuccessMessage = false,
  errorMessage,
  existingPortfolioNames = [],
  autoFocus = true,
  showResetButton = true,
  showCancelConfirmation = true,
  submitButtonText,
  cancelButtonText = "Cancel",
  disabled = false,
  className = "",
  onSuccess,
  onError,
}: EnhancedPortfolioFormProps) {
  // Form state
  const form = useForm<PortfolioFormData>({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: {
      name: portfolio?.name || "",
      description: portfolio?.description || "",
    },
    mode: "onChange", // Enable real-time validation
  });

  // Component state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSubmitSuccessful, setIsSubmitSuccessful] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [nameValidationError, setNameValidationError] = useState<string>("");

  // Memoized values
  const isEditMode = mode === 'edit';
  const isFormDisabled = disabled || isLoading || form.formState.isSubmitting;
  const defaultSubmitText = isEditMode ? "Update Portfolio" : "Create Portfolio";
  const finalSubmitText = submitButtonText || defaultSubmitText;

  // Watch form changes
  const watchedName = form.watch("name");

  // Validate name uniqueness
  const validateNameUniqueness = useCallback((name: string) => {
    if (!name.trim()) {
      setNameValidationError("");
      return;
    }

    const isUnique = portfolioValidationHelpers.validateNameUniqueness(
      name,
      existingPortfolioNames,
      portfolio?.name
    );

    if (!isUnique) {
      setNameValidationError(portfolioErrorMessages.nameExists);
    } else {
      setNameValidationError("");
    }
  }, [existingPortfolioNames, portfolio?.name]);

  // Effect to track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(form.formState.isDirty);
  }, [form.formState.isDirty]);

  // Effect to reset success message when form changes
  useEffect(() => {
    if (isSubmitSuccessful && form.formState.isDirty) {
      setIsSubmitSuccessful(false);
    }
  }, [form.formState.isDirty, isSubmitSuccessful]);

  // Effect to validate name uniqueness
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateNameUniqueness(watchedName);
    }, 300); // Debounce validation

    return () => clearTimeout(timeoutId);
  }, [watchedName, validateNameUniqueness]);

  // Form submission handler
  const handleFormSubmit = async (data: PortfolioFormData) => {
    try {
      // Final validation
      if (nameValidationError) {
        form.setError("name", { message: nameValidationError });
        return;
      }

      // Sanitize data
      const sanitizedData: PortfolioFormData = {
        name: portfolioValidationHelpers.sanitizeName(data.name),
        description: data.description 
          ? portfolioValidationHelpers.sanitizeDescription(data.description)
          : undefined,
      };

      await onSubmit(sanitizedData);
      
      setIsSubmitSuccessful(true);
      setHasUnsavedChanges(false);
      
      // Call success callback
      onSuccess?.(sanitizedData);

      // Reset form for create mode
      if (!isEditMode) {
        form.reset();
      }
    } catch (error) {
      console.error("Form submission error:", error);
      setIsSubmitSuccessful(false);
      
      // Call error callback
      const formError: PortfolioFormError = {
        message: error instanceof Error ? error.message : "An error occurred",
      };
      onError?.(formError);
    }
  };

  // Reset form handler
  const handleReset = useCallback(() => {
    form.reset({
      name: portfolio?.name || "",
      description: portfolio?.description || "",
    });
    setHasUnsavedChanges(false);
    setIsSubmitSuccessful(false);
    setNameValidationError("");
    setShowResetDialog(false);
  }, [form, portfolio]);

  // Cancel handler
  const handleCancel = useCallback(() => {
    if (showCancelConfirmation && hasUnsavedChanges) {
      setShowCancelDialog(true);
      return;
    }
    onCancel();
  }, [showCancelConfirmation, hasUnsavedChanges, onCancel]);

  // Confirm cancel handler
  const handleConfirmCancel = useCallback(() => {
    setShowCancelDialog(false);
    onCancel();
  }, [onCancel]);

  // Name suggestions
  const nameSuggestions = useMemo(() => {
    if (!watchedName || nameValidationError !== portfolioErrorMessages.nameExists) {
      return [];
    }
    return portfolioValidationHelpers.generateNameSuggestions(
      watchedName,
      existingPortfolioNames
    );
  }, [watchedName, nameValidationError, existingPortfolioNames]);

  // Form validation state
  const isFormValid = form.formState.isValid && !nameValidationError;
  const canSubmit = isFormValid && !isFormDisabled && hasUnsavedChanges;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Success Message */}
      {(isSubmitSuccessful || showSuccessMessage) && (
        <Alert variant="default" className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Portfolio {isEditMode ? "updated" : "created"} successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="space-y-6"
          noValidate
        >
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
                    {...field}
                    placeholder={portfolioFormConfig.name.placeholder}
                    maxLength={portfolioFormConfig.name.maxLength}
                    autoComplete={portfolioFormConfig.name.autoComplete}
                    autoFocus={autoFocus && portfolioFormConfig.name.autoFocus}
                    disabled={isFormDisabled}
                    className={nameValidationError ? "border-destructive" : ""}
                  />
                </FormControl>
                <FormDescription>
                  Choose a unique name for your portfolio. Use letters, numbers,
                  spaces, hyphens, underscores, and periods only.
                </FormDescription>
                <FormMessage />
                {nameValidationError && (
                  <p className="text-sm font-medium text-destructive">
                    {nameValidationError}
                  </p>
                )}
                
                {/* Name Suggestions */}
                {nameSuggestions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      Suggestions:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {nameSuggestions.map((suggestion, index) => (
                        <Button
                          key={index}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            form.setValue("name", suggestion, { shouldValidate: true });
                          }}
                          disabled={isFormDisabled}
                          className="text-xs"
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
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
                    {...field}
                    placeholder={portfolioFormConfig.description.placeholder}
                    maxLength={portfolioFormConfig.description.maxLength}
                    rows={portfolioFormConfig.description.rows}
                    autoComplete={portfolioFormConfig.description.autoComplete}
                    disabled={isFormDisabled}
                    className="resize-none"
                  />
                </FormControl>
                <FormDescription>
                  Add a description to help you remember this portfolio's
                  purpose (max {portfolioFormConfig.description.maxLength} characters).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          {/* Unsaved Changes Warning */}
          {hasUnsavedChanges && !isSubmitSuccessful && (
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
              disabled={isFormDisabled}
              className="w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" />
              {cancelButtonText}
            </Button>
            
            {showResetButton && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowResetDialog(true)}
                disabled={isFormDisabled || !form.formState.isDirty}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            )}
            
            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full sm:w-auto"
            >
              {isFormDisabled && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {!isFormDisabled && (
                <Save className="mr-2 h-4 w-4" />
              )}
              {finalSubmitText}
            </Button>
          </div>
        </form>
      </Form>

      {/* Confirmation Dialog for Unsaved Changes */}
      <ConfirmationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Unsaved Changes"
        description="You have unsaved changes that will be lost. Are you sure you want to cancel?"
        confirmText="Yes, Cancel"
        cancelText="Keep Editing"
        onConfirm={handleConfirmCancel}
        variant="destructive"
      />

      {/* Confirmation Dialog for Reset */}
      <ConfirmationDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Reset Form?"
        description="Are you sure you want to discard all changes? This action cannot be undone."
        confirmText="Yes, Reset"
        cancelText="Keep Changes"
        onConfirm={handleReset}
        variant="destructive"
      />
    </div>
  );
}

// Export the component with a more convenient name
export { EnhancedPortfolioForm as PortfolioForm };
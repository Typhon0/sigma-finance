// Portfolio form components

// Re-export validation schemas and types
export {
	type CreatePortfolioInput,
	createPortfolioSchema,
	type PortfolioFormData,
	type PortfolioFormError,
	type PortfolioFormMode,
	portfolioErrorMessages,
	portfolioFormConfig,
	portfolioFormSchema,
	portfolioValidationHelpers,
	type UpdatePortfolioInput,
	updatePortfolioSchema,
} from "@/lib/validations/portfolio.schemas";

export {
	CompactPortfolioForm,
	type CompactPortfolioFormProps,
	InlineEditPortfolioForm,
	type InlineEditPortfolioFormProps,
	QuickCreatePortfolioForm,
	type QuickCreatePortfolioFormProps,
} from "./compact-portfolio-form";
export {
	EditPortfolioButton,
	type EditPortfolioButtonProps,
	EditPortfolioDialog,
	type EditPortfolioDialogProps,
} from "./edit-portfolio-dialog";
export {
	EnhancedPortfolioForm,
	type EnhancedPortfolioFormProps,
	PortfolioForm,
} from "./enhanced-portfolio-form";
export {
	CreatePortfolioDialog,
	type CreatePortfolioDialogProps,
	EditPortfolioDialog as EditPortfolioFormDialog,
	type EditPortfolioDialogProps as EditPortfolioFormDialogProps,
	PortfolioFormDialog,
	type PortfolioFormDialogProps,
} from "./portfolio-form-dialog";
export {
	PortfolioDescriptionField,
	type PortfolioDescriptionFieldProps,
	PortfolioFormFields,
	type PortfolioFormFieldsProps,
	PortfolioNameField,
	type PortfolioNameFieldProps,
} from "./portfolio-form-fields";

// Loading states and error boundaries
export {
	PortfolioDetailSkeleton,
	PortfolioDetailLoadingSkeleton,
	PortfolioMetricsSkeleton,
	PortfolioAssetsSkeleton,
} from "./portfolio-detail-skeleton";
export {
	PortfolioListSkeleton,
	PortfolioListLoadingSkeleton,
	EmptyPortfolioSkeleton,
	PortfolioOperationSkeleton,
} from "./portfolio-list-skeleton";
export {
	PortfolioErrorBoundary,
	PortfolioListErrorBoundary,
	PortfolioDetailErrorBoundary,
	PortfolioFormErrorBoundary,
	withPortfolioErrorBoundary,
	type PortfolioErrorFallbackProps,
} from "./portfolio-error-boundary";
export {
	LoadingIndicator,
	AsyncOperationIndicator,
	PortfolioOperationStatus,
	ProgressiveLoading,
	InlineLoading,
	ButtonLoading,
	PortfolioCardLoadingSkeleton,
	PortfolioFormLoadingSkeleton,
} from "./portfolio-loading-indicators";

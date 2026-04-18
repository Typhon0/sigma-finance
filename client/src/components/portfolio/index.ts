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
export { PortfolioCard } from "./portfolio-card";
// Loading states and error boundaries
export {
	PortfolioAssetsSkeleton,
	PortfolioDetailLoadingSkeleton,
	PortfolioDetailSkeleton,
	PortfolioMetricsSkeleton,
} from "./portfolio-detail-skeleton";
export {
	PortfolioDetailErrorBoundary,
	PortfolioErrorBoundary,
	type PortfolioErrorFallbackProps,
	PortfolioFormErrorBoundary,
	PortfolioListErrorBoundary,
	withPortfolioErrorBoundary,
} from "./portfolio-error-boundary";
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
// List and card components
export { PortfolioListPage } from "./portfolio-list-page";
export {
	EmptyPortfolioSkeleton,
	PortfolioListLoadingSkeleton,
	PortfolioListSkeleton,
	PortfolioOperationSkeleton,
} from "./portfolio-list-skeleton";
export {
	AsyncOperationIndicator,
	ButtonLoading,
	InlineLoading,
	LoadingIndicator,
	PortfolioCardLoadingSkeleton,
	PortfolioFormLoadingSkeleton,
	PortfolioOperationStatus,
	ProgressiveLoading,
} from "./portfolio-loading-indicators";
// Search and filtering
export { PortfolioSearch } from "./portfolio-search";

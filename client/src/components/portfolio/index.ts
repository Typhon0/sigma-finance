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
	EditPortfolioButton,
	type EditPortfolioButtonProps,
	EditPortfolioDialog,
	type EditPortfolioDialogProps,
} from "./edit-portfolio-dialog";
export {
	PortfolioDescriptionField,
	type PortfolioDescriptionFieldProps,
	PortfolioFormFields,
	type PortfolioFormFieldsProps,
	PortfolioNameField,
	type PortfolioNameFieldProps,
} from "./portfolio-form-fields";

// Portfolio form components
export { 
  EnhancedPortfolioForm,
  PortfolioForm,
  type EnhancedPortfolioFormProps 
} from './enhanced-portfolio-form';

export {
  CompactPortfolioForm,
  QuickCreatePortfolioForm,
  InlineEditPortfolioForm,
  type CompactPortfolioFormProps,
  type QuickCreatePortfolioFormProps,
  type InlineEditPortfolioFormProps,
} from './compact-portfolio-form';

export {
  PortfolioFormFields,
  PortfolioNameField,
  PortfolioDescriptionField,
  type PortfolioFormFieldsProps,
  type PortfolioNameFieldProps,
  type PortfolioDescriptionFieldProps,
} from './portfolio-form-fields';

export {
  PortfolioFormDialog,
  CreatePortfolioDialog,
  EditPortfolioDialog,
  type PortfolioFormDialogProps,
  type CreatePortfolioDialogProps,
  type EditPortfolioDialogProps,
} from './portfolio-form-dialog';

// Re-export validation schemas and types
export {
  portfolioFormSchema,
  createPortfolioSchema,
  updatePortfolioSchema,
  portfolioValidationHelpers,
  portfolioFormConfig,
  portfolioErrorMessages,
  type PortfolioFormData,
  type CreatePortfolioInput,
  type UpdatePortfolioInput,
  type PortfolioFormMode,
  type PortfolioFormError,
} from '@/lib/validations/portfolio.schemas';
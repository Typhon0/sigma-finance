import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
	type PortfolioFormData,
	type PortfolioFormMode,
	portfolioFormSchema,
	portfolioValidationHelpers,
} from "@/lib/validations/portfolio.schemas";
import { PortfolioFormFields } from "./portfolio-form-fields";

export interface CompactPortfolioFormProps {
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
	onCancel?: () => void;
	/** Loading state */
	isLoading?: boolean;
	/** Existing portfolio names for validation */
	existingPortfolioNames?: string[];
	/** Custom submit button text */
	submitButtonText?: string;
	/** Custom cancel button text */
	cancelButtonText?: string;
	/** Show cancel button */
	showCancelButton?: boolean;
	/** Disable form */
	disabled?: boolean;
	/** Auto-focus on mount */
	autoFocus?: boolean;
	/** Success callback */
	onSuccess?: (data: PortfolioFormData) => void;
	/** Error callback */
	onError?: (error: Error) => void;
}

export function CompactPortfolioForm({
	portfolio,
	mode,
	onSubmit,
	onCancel,
	isLoading = false,
	existingPortfolioNames = [],
	submitButtonText,
	cancelButtonText = "Cancel",
	showCancelButton = true,
	disabled = false,
	autoFocus = true,
	onSuccess,
	onError,
}: CompactPortfolioFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const isEditMode = mode === "edit";
	const isFormDisabled = disabled || isLoading || isSubmitting;
	const defaultSubmitText = isEditMode ? "Update" : "Create";
	const finalSubmitText = submitButtonText || defaultSubmitText;

	const form = useForm<PortfolioFormData>({
		resolver: zodResolver(portfolioFormSchema) as any,
		defaultValues: {
			name: portfolio?.name || "",
			description: portfolio?.description || "",
		},
		mode: "onChange",
	});

	// Reset form when portfolio changes
	useEffect(() => {
		if (portfolio) {
			form.reset({
				name: portfolio.name,
				description: portfolio.description || "",
			});
		}
	}, [portfolio, form]);

	const handleFormSubmit = async (data: PortfolioFormData) => {
		setIsSubmitting(true);

		try {
			// Sanitize data
			const sanitizedData: PortfolioFormData = {
				name: portfolioValidationHelpers.sanitizeName(data.name),
				description: data.description
					? portfolioValidationHelpers.sanitizeDescription(data.description)
					: undefined,
			};

			await onSubmit(sanitizedData);

			// Call success callback
			onSuccess?.(sanitizedData);

			// Reset form for create mode
			if (!isEditMode) {
				form.reset();
			}
		} catch (error) {
			// Call error callback
			const formError = error instanceof Error ? error : new Error("An error occurred");
			onError?.(formError);
		} finally {
			setIsSubmitting(false);
		}
	};

	const isFormValid = form.formState.isValid;
	const canSubmit = isFormValid && !isFormDisabled;

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
				<PortfolioFormFields
					existingPortfolioNames={existingPortfolioNames}
					currentPortfolioName={portfolio?.name}
					disabled={isFormDisabled}
					autoFocus={autoFocus}
					showNameSuggestions={true}
				/>

				{/* Form Actions */}
				<div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-2 pt-4">
					{showCancelButton && onCancel && (
						<Button
							type="button"
							variant="outline"
							onClick={onCancel}
							disabled={isFormDisabled}
							className="touch-manipulation order-2 sm:order-1"
						>
							{cancelButtonText}
						</Button>
					)}

					<Button
						type="submit"
						disabled={!canSubmit}
						className="touch-manipulation order-1 sm:order-2"
					>
						{isFormDisabled && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{!isFormDisabled && <Save className="mr-2 h-4 w-4" />}
						{finalSubmitText}
					</Button>
				</div>
			</form>
		</Form>
	);
}

// Quick create form variant
export interface QuickCreatePortfolioFormProps {
	/** Submit handler */
	onSubmit: (data: PortfolioFormData) => Promise<void>;
	/** Existing portfolio names for validation */
	existingPortfolioNames?: string[];
	/** Loading state */
	isLoading?: boolean;
	/** Success callback */
	onSuccess?: (data: PortfolioFormData) => void;
	/** Error callback */
	onError?: (error: Error) => void;
}

export function QuickCreatePortfolioForm({
	onSubmit,
	existingPortfolioNames = [],
	isLoading = false,
	onSuccess,
	onError,
}: QuickCreatePortfolioFormProps) {
	return (
		<CompactPortfolioForm
			mode="create"
			onSubmit={onSubmit}
			existingPortfolioNames={existingPortfolioNames}
			isLoading={isLoading}
			showCancelButton={false}
			submitButtonText="Create Portfolio"
			onSuccess={onSuccess}
			onError={onError}
		/>
	);
}

// Inline edit form variant
export interface InlineEditPortfolioFormProps {
	/** Portfolio to edit */
	portfolio: {
		id: string;
		name: string;
		description?: string | null;
	};
	/** Submit handler */
	onSubmit: (data: PortfolioFormData) => Promise<void>;
	/** Cancel handler */
	onCancel: () => void;
	/** Existing portfolio names for validation */
	existingPortfolioNames?: string[];
	/** Loading state */
	isLoading?: boolean;
	/** Success callback */
	onSuccess?: (data: PortfolioFormData) => void;
	/** Error callback */
	onError?: (error: Error) => void;
}

export function InlineEditPortfolioForm({
	portfolio,
	onSubmit,
	onCancel,
	existingPortfolioNames = [],
	isLoading = false,
	onSuccess,
	onError,
}: InlineEditPortfolioFormProps) {
	return (
		<CompactPortfolioForm
			portfolio={portfolio}
			mode="edit"
			onSubmit={onSubmit}
			onCancel={onCancel}
			existingPortfolioNames={existingPortfolioNames}
			isLoading={isLoading}
			submitButtonText="Save"
			cancelButtonText="Cancel"
			showCancelButton={true}
			autoFocus={false}
			onSuccess={onSuccess}
			onError={onError}
		/>
	);
}

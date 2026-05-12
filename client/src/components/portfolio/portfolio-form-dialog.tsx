import { AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { PortfolioFormData, PortfolioFormMode } from "@/lib/validations/portfolio.schemas";
import { CompactPortfolioForm } from "./compact-portfolio-form";

export interface PortfolioFormDialogProps {
	/** Dialog trigger element */
	children: React.ReactNode;
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
	/** Existing portfolio names for validation */
	existingPortfolioNames?: string[];
	/** Dialog title override */
	title?: string;
	/** Dialog description override */
	description?: string;
	/** Success callback */
	onSuccess?: (data: PortfolioFormData) => void;
	/** Error callback */
	onError?: (error: Error) => void;
	/** Open state control */
	open?: boolean;
	/** Open state change handler */
	onOpenChange?: (open: boolean) => void;
}

export function PortfolioFormDialog({
	children,
	portfolio,
	mode,
	onSubmit,
	existingPortfolioNames = [],
	title,
	description,
	onSuccess,
	onError,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
}: PortfolioFormDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string>("");
	const [errorMessage, setErrorMessage] = useState<string>("");

	const isEditMode = mode === "edit";
	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;
	// biome-ignore lint/style/noNonNullAssertion: unavoidable
	const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

	const defaultTitle = isEditMode ? "Edit Portfolio" : "Create Portfolio";
	const defaultDescription = isEditMode
		? "Update your portfolio information below."
		: "Enter the details for your new portfolio.";

	const finalTitle = title || defaultTitle;
	const finalDescription = description || defaultDescription;

	const handleSubmit = async (data: PortfolioFormData) => {
		setIsLoading(true);
		setErrorMessage("");
		setSuccessMessage("");

		try {
			await onSubmit(data);

			const successMsg = isEditMode
				? "Portfolio updated successfully!"
				: "Portfolio created successfully!";
			setSuccessMessage(successMsg);

			// Call success callback
			onSuccess?.(data);

			// Close dialog after a short delay to show success message
			setTimeout(() => {
				setOpen(false);
				setSuccessMessage("");
			}, 1500);
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : "An error occurred while saving the portfolio.";
			setErrorMessage(errorMsg);

			// Call error callback
			const formError = error instanceof Error ? error : new Error(errorMsg);
			onError?.(formError);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		setOpen(false);
		setErrorMessage("");
		setSuccessMessage("");
	};

	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen);

		// Clear messages when dialog closes
		if (!newOpen) {
			setErrorMessage("");
			setSuccessMessage("");
		}
	};

	const handleFormSuccess = (_data: PortfolioFormData) => {
		// Success is handled in handleSubmit
	};

	const handleFormError = (_error: Error) => {
		// Error is handled in handleSubmit
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{finalTitle}</DialogTitle>
					<DialogDescription>{finalDescription}</DialogDescription>
				</DialogHeader>

				{/* Success Message */}
				{successMessage && (
					<Alert variant="default" className="border-green-200 bg-green-50 text-green-800">
						<CheckCircle className="h-4 w-4 text-green-600" />
						<AlertDescription>{successMessage}</AlertDescription>
					</Alert>
				)}

				{/* Error Message */}
				{errorMessage && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				)}

				<CompactPortfolioForm
					portfolio={portfolio}
					mode={mode}
					onSubmit={handleSubmit}
					onCancel={handleCancel}
					existingPortfolioNames={existingPortfolioNames}
					isLoading={isLoading}
					onSuccess={handleFormSuccess}
					onError={handleFormError}
				/>
			</DialogContent>
		</Dialog>
	);
}

// Convenience components for specific use cases
export interface CreatePortfolioDialogProps {
	children: React.ReactNode;
	onSubmit: (data: PortfolioFormData) => Promise<void>;
	existingPortfolioNames?: string[];
	onSuccess?: (data: PortfolioFormData) => void;
	onError?: (error: Error) => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function CreatePortfolioDialog({
	children,
	onSubmit,
	existingPortfolioNames = [],
	onSuccess,
	onError,
	open,
	onOpenChange,
}: CreatePortfolioDialogProps) {
	return (
		<PortfolioFormDialog
			mode="create"
			onSubmit={onSubmit}
			existingPortfolioNames={existingPortfolioNames}
			onSuccess={onSuccess}
			onError={onError}
			open={open}
			onOpenChange={onOpenChange}
		>
			{children}
		</PortfolioFormDialog>
	);
}

export interface EditPortfolioDialogProps {
	children: React.ReactNode;
	portfolio: {
		id: string;
		name: string;
		description?: string | null;
	};
	onSubmit: (data: PortfolioFormData) => Promise<void>;
	existingPortfolioNames?: string[];
	onSuccess?: (data: PortfolioFormData) => void;
	onError?: (error: Error) => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function EditPortfolioDialog({
	children,
	portfolio,
	onSubmit,
	existingPortfolioNames = [],
	onSuccess,
	onError,
	open,
	onOpenChange,
}: EditPortfolioDialogProps) {
	return (
		<PortfolioFormDialog
			portfolio={portfolio}
			mode="edit"
			onSubmit={onSubmit}
			existingPortfolioNames={existingPortfolioNames}
			onSuccess={onSuccess}
			onError={onError}
			open={open}
			onOpenChange={onOpenChange}
		>
			{children}
		</PortfolioFormDialog>
	);
}

import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, PlusCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { usePortfolioManagement } from "@/hooks/use-portfolio-management";
import { useAuth } from "@/lib/auth-context";
import type { PortfolioFormData } from "@/lib/validations/portfolio.schemas";
import { CompactPortfolioForm } from "./compact-portfolio-form";

export interface CreatePortfolioDialogProps {
	/** Dialog trigger element */
	children: React.ReactNode;
	/** Existing portfolio names for validation */
	existingPortfolioNames?: string[];
	/** Dialog title override */
	title?: string;
	/** Dialog description override */
	description?: string;
	/** Success callback - called after successful creation */
	onSuccess?: (portfolio: any) => void;
	/** Error callback - called when creation fails */
	onError?: (error: Error) => void;
	/** Open state control */
	open?: boolean;
	/** Open state change handler */
	onOpenChange?: (open: boolean) => void;
	/** Navigate to portfolio detail after creation */
	navigateAfterCreate?: boolean;
	/** Navigate to portfolios list after creation */
	navigateToList?: boolean;
	/** Show success toast notification */
	showSuccessToast?: boolean;
	/** Show error toast notification */
	showErrorToast?: boolean;
	/** Custom success message */
	successMessage?: string;
	/** Auto-close dialog after success */
	autoCloseAfterSuccess?: boolean;
	/** Auto-close delay in milliseconds */
	autoCloseDelay?: number;
}

export function CreatePortfolioDialog({
	children,
	existingPortfolioNames = [],
	title = "Create Portfolio",
	description = "Enter the details for your new portfolio.",
	onSuccess,
	onError,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	navigateAfterCreate = false,
	navigateToList = false,
	showSuccessToast = true,
	showErrorToast = true,
	successMessage = "Portfolio created successfully!",
	autoCloseAfterSuccess = true,
	autoCloseDelay = 1500,
}: CreatePortfolioDialogProps) {
	const navigate = useNavigate();
	const { user } = useAuth();
	const { createPortfolio, portfolios, isCreating } = usePortfolioManagement();

	// Dialog state management
	const [internalOpen, setInternalOpen] = useState(false);
	const [successState, setSuccessState] = useState<{
		show: boolean;
		portfolio?: any;
	}>({ show: false });
	const [errorMessage, setErrorMessage] = useState<string>("");

	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;
	const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

	// Get existing portfolio names from the portfolios data if not provided
	const finalExistingNames = useMemo(() => {
		if (existingPortfolioNames.length > 0) {
			return existingPortfolioNames;
		}
		return portfolios?.map((p) => p.name) || [];
	}, [existingPortfolioNames, portfolios]);

	const handleSubmit = useCallback(
		async (data: PortfolioFormData) => {
			if (!user?.id) {
				const error = new Error(
					"User not authenticated. Please log in and try again.",
				);
				setErrorMessage(error.message);
				if (showErrorToast) {
					toast.error(error.message);
				}
				onError?.(error);
				return;
			}

			setErrorMessage("");
			setSuccessState({ show: false });

			try {
				const result = await createPortfolio({
					userID: user.id,
					name: data.name,
					description: data.description || undefined,
				});

				if (result) {
					// Show success state
					setSuccessState({ show: true, portfolio: result });

					// Show success toast
					if (showSuccessToast) {
						toast.success(successMessage);
					}

					// Call success callback
					onSuccess?.(result);

					// Handle navigation and dialog closing
					if (autoCloseAfterSuccess) {
						setTimeout(() => {
							setOpen(false);
							setSuccessState({ show: false });

							// Navigate after closing dialog
							if (navigateAfterCreate && result.id) {
								navigate({ to: `/portfolios/${result.id}` });
							} else if (navigateToList) {
								navigate({ to: "/portfolios" });
							}
						}, autoCloseDelay);
					}
				} else {
					throw new Error("Failed to create portfolio. Please try again.");
				}
			} catch (error: any) {
				console.error("Error creating portfolio:", error);

				// Handle specific error types
				let errorMsg = "Failed to create portfolio. Please try again.";

				if (
					error.message?.includes("duplicate") ||
					error.message?.includes("already exists")
				) {
					errorMsg =
						"A portfolio with this name already exists. Please choose a different name.";
				} else if (error.message?.includes("validation")) {
					errorMsg = "Please check your input and try again.";
				} else if (error.message) {
					errorMsg = error.message;
				}

				setErrorMessage(errorMsg);

				if (showErrorToast) {
					toast.error(errorMsg);
				}

				const formError = new Error(errorMsg);
				onError?.(formError);
			}
		},
		[
			user?.id,
			createPortfolio,
			onSuccess,
			onError,
			showSuccessToast,
			showErrorToast,
			successMessage,
			autoCloseAfterSuccess,
			autoCloseDelay,
			navigateAfterCreate,
			navigateToList,
			navigate,
			setOpen,
		],
	);

	const handleCancel = useCallback(() => {
		setOpen(false);
		setErrorMessage("");
		setSuccessState({ show: false });
	}, [setOpen]);

	const handleOpenChange = useCallback(
		(newOpen: boolean) => {
			setOpen(newOpen);

			// Clear messages when dialog closes
			if (!newOpen) {
				setErrorMessage("");
				setSuccessState({ show: false });
			}
		},
		[setOpen],
	);

	const handleFormSuccess = useCallback((data: PortfolioFormData) => {
		// Success is handled in handleSubmit
	}, []);

	const handleFormError = useCallback((error: Error) => {
		// Error is handled in handleSubmit
	}, []);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				{/* Success Message */}
				{successState.show && (
					<Alert
						variant="default"
						className="border-green-200 bg-green-50 text-green-800"
					>
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
					mode="create"
					onSubmit={handleSubmit}
					onCancel={handleCancel}
					existingPortfolioNames={finalExistingNames}
					isLoading={isCreating}
					submitButtonText="Create Portfolio"
					cancelButtonText="Cancel"
					showCancelButton={true}
					autoFocus={true}
					onSuccess={handleFormSuccess}
					onError={handleFormError}
				/>
			</DialogContent>
		</Dialog>
	);
}

// Convenience component for quick portfolio creation
export interface QuickCreatePortfolioDialogProps {
	/** Dialog trigger element */
	children?: React.ReactNode;
	/** Success callback */
	onSuccess?: (portfolio: any) => void;
	/** Navigate to portfolio detail after creation */
	navigateAfterCreate?: boolean;
}

export function QuickCreatePortfolioDialog({
	children,
	onSuccess,
	navigateAfterCreate = true,
}: QuickCreatePortfolioDialogProps) {
	const defaultTrigger = (
		<Button>
			<PlusCircle className="mr-2 h-4 w-4" />
			Create Portfolio
		</Button>
	);

	return (
		<CreatePortfolioDialog
			onSuccess={onSuccess}
			navigateAfterCreate={navigateAfterCreate}
			showSuccessToast={true}
			showErrorToast={true}
			autoCloseAfterSuccess={true}
			autoCloseDelay={1500}
		>
			{children || defaultTrigger}
		</CreatePortfolioDialog>
	);
}

// Component for creating portfolio with navigation to list
export interface CreatePortfolioWithListNavigationProps {
	/** Dialog trigger element */
	children: React.ReactNode;
	/** Success callback */
	onSuccess?: (portfolio: any) => void;
}

export function CreatePortfolioWithListNavigation({
	children,
	onSuccess,
}: CreatePortfolioWithListNavigationProps) {
	return (
		<CreatePortfolioDialog
			onSuccess={onSuccess}
			navigateToList={true}
			showSuccessToast={true}
			showErrorToast={true}
			autoCloseAfterSuccess={true}
			autoCloseDelay={1000}
		>
			{children}
		</CreatePortfolioDialog>
	);
}

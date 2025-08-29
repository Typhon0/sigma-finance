import { AlertCircle, CheckCircle, Edit } from "lucide-react";
import { useState } from "react";
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
import { usePortfolioDetail } from "@/hooks/use-portfolio-detail";
import { usePortfolioManagement } from "@/hooks/use-portfolio-management";
import type { PortfolioFormData } from "@/lib/validations/portfolio.schemas";
import { CompactPortfolioForm } from "./compact-portfolio-form";

export interface EditPortfolioDialogProps {
	/** Dialog trigger element */
	children: React.ReactNode;
	/** Portfolio ID to edit */
	portfolioId: string;
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

export function EditPortfolioDialog({
	children,
	portfolioId,
	title,
	description,
	onSuccess,
	onError,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
}: EditPortfolioDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string>("");
	const [errorMessage, setErrorMessage] = useState<string>("");

	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;
	const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

	// Get portfolio data and existing portfolio names
	const { portfolios, updatePortfolio } = usePortfolioManagement();
	const {
		portfolio,
		loading: portfolioLoading,
		error: portfolioError,
		isOwner,
		isUnauthorized,
	} = usePortfolioDetail({
		portfolioId,
		onUpdateSuccess: () => {
			const successMsg = "Portfolio updated successfully!";
			setSuccessMessage(successMsg);
			toast.success(successMsg);

			// Call success callback
			if (onSuccess && portfolio) {
				onSuccess({
					name: portfolio.name,
					description: portfolio.description || undefined,
				});
			}

			// Close dialog after a short delay to show success message
			setTimeout(() => {
				setOpen(false);
				setSuccessMessage("");
			}, 1500);
		},
	});

	// Get existing portfolio names for validation (excluding current portfolio)
	const existingPortfolioNames = portfolios
		? portfolios.filter((p) => p.id !== portfolioId).map((p) => p.name)
		: [];

	const defaultTitle = "Edit Portfolio";
	const defaultDescription = "Update your portfolio information below.";

	const finalTitle = title || defaultTitle;
	const finalDescription = description || defaultDescription;

	const handleSubmit = async (data: PortfolioFormData) => {
		if (!portfolio) {
			const error = new Error("Portfolio not found");
			setErrorMessage(error.message);
			onError?.(error);
			return;
		}

		if (!isOwner) {
			const error = new Error(
				"You do not have permission to edit this portfolio",
			);
			setErrorMessage(error.message);
			onError?.(error);
			return;
		}

		setIsLoading(true);
		setErrorMessage("");
		setSuccessMessage("");

		try {
			await updatePortfolio(portfolioId, {
				name: data.name,
				description: data.description || undefined,
			});

			// Show success message
			const successMsg = "Portfolio updated successfully!";
			setSuccessMessage(successMsg);
			toast.success(successMsg);

			// Call success callback
			onSuccess?.(data);

			// Close dialog after a short delay to show success message
			setTimeout(() => {
				setOpen(false);
				setSuccessMessage("");
			}, 1500);
		} catch (error) {
			console.error("Failed to update portfolio:", error);

			let errorMsg = "An error occurred while updating the portfolio.";

			if (error instanceof Error) {
				if (
					error.message.includes("unique") ||
					error.message.includes("exists")
				) {
					errorMsg =
						"A portfolio with this name already exists. Please choose a different name.";
				} else if (
					error.message.includes("unauthorized") ||
					error.message.includes("permission")
				) {
					errorMsg = "You do not have permission to edit this portfolio.";
				} else if (error.message.includes("not found")) {
					errorMsg = "Portfolio not found. It may have been deleted.";
				} else {
					errorMsg = error.message;
				}
			}

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

	// Don't render if there's an error loading the portfolio
	if (portfolioError || isUnauthorized) {
		return (
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogTrigger asChild>{children}</DialogTrigger>
				<DialogContent className="sm:max-w-[500px] mx-4 sm:mx-0 max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="text-destructive">
							{isUnauthorized ? "Access Denied" : "Error"}
						</DialogTitle>
						<DialogDescription>
							{isUnauthorized
								? "You do not have permission to edit this portfolio."
								: "Failed to load portfolio data."}
						</DialogDescription>
					</DialogHeader>
					<div className="flex justify-end">
						<Button
							variant="outline"
							onClick={() => setOpen(false)}
							className="touch-manipulation"
						>
							Close
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	// Show loading state while portfolio is loading
	if (portfolioLoading || !portfolio) {
		return (
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogTrigger asChild>{children}</DialogTrigger>
				<DialogContent className="sm:max-w-[500px] mx-4 sm:mx-0 max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Loading...</DialogTitle>
						<DialogDescription>Loading portfolio data...</DialogDescription>
					</DialogHeader>
					<div className="py-8 text-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-[500px] mx-4 sm:mx-0 max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{finalTitle}</DialogTitle>
					<DialogDescription>{finalDescription}</DialogDescription>
				</DialogHeader>

				{/* Success Message */}
				{successMessage && (
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
					portfolio={{
						id: portfolio.id,
						name: portfolio.name,
						description: portfolio.description,
					}}
					mode="edit"
					onSubmit={handleSubmit}
					onCancel={handleCancel}
					existingPortfolioNames={existingPortfolioNames}
					isLoading={isLoading}
					onSuccess={() => {
						// Success is handled in handleSubmit
					}}
					onError={() => {
						// Error is handled in handleSubmit
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}

// Convenience component with default trigger
export interface EditPortfolioButtonProps {
	portfolioId: string;
	variant?: "default" | "outline" | "ghost" | "secondary";
	size?: "default" | "sm" | "lg" | "icon";
	className?: string;
	onSuccess?: (data: PortfolioFormData) => void;
	onError?: (error: Error) => void;
}

export function EditPortfolioButton({
	portfolioId,
	variant = "outline",
	size = "sm",
	className,
	onSuccess,
	onError,
}: EditPortfolioButtonProps) {
	return (
		<EditPortfolioDialog
			portfolioId={portfolioId}
			onSuccess={onSuccess}
			onError={onError}
		>
			<Button variant={variant} size={size} className={className}>
				<Edit className="h-4 w-4 mr-2" />
				Edit
			</Button>
		</EditPortfolioDialog>
	);
}

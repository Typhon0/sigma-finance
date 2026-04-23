import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

const portfolioFormSchema = z.object({
	name: z
		.string()
		.min(3, "Portfolio name must be at least 3 characters")
		.max(100, "Portfolio name must be less than 100 characters")
		.regex(
			/^[a-zA-Z0-9\s\-_]+$/,
			"Portfolio name can only contain letters, numbers, spaces, hyphens, and underscores",
		),
	description: z
		.string()
		.max(500, "Description must be less than 500 characters")
		.optional()
		.or(z.literal("")),
});

export type PortfolioFormData = z.infer<typeof portfolioFormSchema>;

interface PortfolioFormProps {
	portfolio?: {
		name: string;
		description?: string;
	};
	onSubmit: (data: PortfolioFormData) => Promise<void>;
	onCancel: () => void;
	isLoading?: boolean;
	showSuccessMessage?: boolean;
	errorMessage?: string;
}

export function PortfolioForm({
	portfolio,
	onSubmit,
	onCancel,
	isLoading = false,
	showSuccessMessage = false,
	errorMessage,
}: PortfolioFormProps) {
	const form = useForm<PortfolioFormData>({
		resolver: zodResolver(portfolioFormSchema),
		defaultValues: {
			name: portfolio?.name || "",
			description: portfolio?.description || "",
		},
		mode: "onChange", // Enable real-time validation
	});

	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [isSubmitSuccessful, setIsSubmitSuccessful] = useState(false);
	const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
	const [isResetDialogOpen, setResetDialogOpen] = useState(false);

	useEffect(() => {
		setHasUnsavedChanges(form.formState.isDirty);
	}, [form.formState.isDirty]);

	// Reset success message when form changes
	useEffect(() => {
		if (isSubmitSuccessful && form.formState.isDirty) {
			setIsSubmitSuccessful(false);
		}
	}, [form.formState.isDirty, isSubmitSuccessful]);

	const handleFormSubmit = async (data: PortfolioFormData) => {
		try {
			await onSubmit(data);
			setIsSubmitSuccessful(true);
			setHasUnsavedChanges(false);

			// If creating a new portfolio, reset the form
			if (!portfolio) {
				form.reset();
			}
		} catch (_error) {
			setIsSubmitSuccessful(false);
		}
	};

	const handleReset = () => {
		form.reset({
			name: portfolio?.name || "",
			description: portfolio?.description || "",
		});
		setHasUnsavedChanges(false);
		setIsSubmitSuccessful(false);
	};

	const handleCancel = () => {
		if (hasUnsavedChanges) {
			setShowCancelConfirmation(true);
			return;
		}
		onCancel();
	};

	const handleConfirmCancel = () => {
		setShowCancelConfirmation(false);
		onCancel();
	};

	const isFormLoading = isLoading || form.formState.isSubmitting;

	return (
		<div className="space-y-6">
			{/* Success Message */}
			{(isSubmitSuccessful || showSuccessMessage) && (
				<Alert variant="default">
					<CheckCircle className="h-4 w-4" />
					<AlertDescription>
						Portfolio {portfolio ? "updated" : "created"} successfully!
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
				<form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
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
									<Input placeholder="Enter portfolio name" disabled={isFormLoading} {...field} />
								</FormControl>
								<FormDescription>
									Choose a unique name for your portfolio. Use letters, numbers, spaces, hyphens,
									and underscores only.
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
									Add a description to help you remember this portfolio's purpose (max 500
									characters).
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
					<div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={handleCancel}
							disabled={isFormLoading}
							className="w-full sm:w-auto touch-manipulation order-2 sm:order-1"
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setResetDialogOpen(true)}
							disabled={isFormLoading || !form.formState.isDirty}
							className="w-full sm:w-auto touch-manipulation order-3 sm:order-2"
						>
							Reset
						</Button>
						<Button
							type="submit"
							disabled={isFormLoading || !form.formState.isValid}
							className="w-full sm:w-auto touch-manipulation order-1 sm:order-3"
						>
							{isFormLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{portfolio ? "Update Portfolio" : "Create Portfolio"}
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

			{/* Confirmation Dialog for Reset */}
			<ConfirmationDialog
				open={isResetDialogOpen}
				onOpenChange={setResetDialogOpen}
				title="Reset Form?"
				description="Are you sure you want to discard all changes? This action cannot be undone."
				confirmText="Yes, Discard"
				cancelText="Cancel"
				onConfirm={handleReset}
			/>
		</div>
	);
}

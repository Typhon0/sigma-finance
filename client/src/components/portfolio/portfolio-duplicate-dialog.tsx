import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle, Copy, FileText, Loader2, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Portfolio } from "@/hooks/use-portfolio-management";

const duplicatePortfolioSchema = z.object({
	name: z
		.string()
		.min(3, "Portfolio name must be at least 3 characters")
		.max(100, "Portfolio name must be less than 100 characters")
		.regex(
			/^[a-zA-Z0-9\s\-_]+$/,
			"Portfolio name can only contain letters, numbers, spaces, hyphens, and underscores",
		),
	copyAssets: z.boolean(),
});

export type DuplicatePortfolioFormData = z.infer<typeof duplicatePortfolioSchema>;

export interface DuplicatePortfolioInput {
	sourcePortfolioID: string;
	newName: string;
	copyAssets: boolean;
}

interface PortfolioDuplicateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolio: Portfolio | null;
	onDuplicate: (input: DuplicatePortfolioInput) => Promise<void>;
	isLoading?: boolean;
	errorMessage?: string;
	trigger?: React.ReactNode;
}

export function PortfolioDuplicateDialog({
	open,
	onOpenChange,
	portfolio,
	onDuplicate,
	isLoading = false,
	errorMessage,
	trigger,
}: PortfolioDuplicateDialogProps) {
	const [isSubmitSuccessful, setIsSubmitSuccessful] = useState(false);

	const form = useForm<DuplicatePortfolioFormData>({
		resolver: zodResolver(duplicatePortfolioSchema),
		defaultValues: {
			name: "",
			copyAssets: true,
		},
	});

	const {
		handleSubmit,
		formState: { isSubmitting, isValid },
		reset,
		watch,
	} = form;
	const watchedValues = watch();

	useEffect(() => {
		if (portfolio && open) {
			const suggestedName = generateSuggestedName(portfolio.name);
			reset({
				name: suggestedName,
				copyAssets: true,
			});
			setIsSubmitSuccessful(false);
		}
	}, [portfolio, open, reset]);

	useEffect(() => {
		if (!open) {
			reset();
			setIsSubmitSuccessful(false);
		}
	}, [open, reset]);

	const handleFormSubmit = async (data: DuplicatePortfolioFormData) => {
		if (!portfolio) return;

		try {
			await onDuplicate({
				sourcePortfolioID: portfolio.id,
				newName: data.name,
				copyAssets: data.copyAssets,
			});
			setIsSubmitSuccessful(true);

			setTimeout(() => {
				onOpenChange(false);
			}, 1500);
		} catch (_error) {
			setIsSubmitSuccessful(false);
		}
	};

	const isFormLoading = isLoading || isSubmitting;
	const assetCount = portfolio?.assets?.length || 0;

	if (!portfolio) return null;

	return (
		<ActionDialog
			open={open}
			onOpenChange={onOpenChange}
			trigger={trigger}
			title={
				<div className="flex items-center">
					<Copy className="mr-2 h-5 w-5" />
					Duplicate Portfolio
				</div>
			}
			description={`Create a copy of "${portfolio.name}" with your preferred settings.`}
			actionText={
				isFormLoading ? (
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
				) : isSubmitSuccessful ? (
					"Duplicated!"
				) : (
					"Duplicate Portfolio"
				)
			}
			onAction={handleSubmit(handleFormSubmit)}
			isActionDisabled={isFormLoading || !isValid || isSubmitSuccessful}
		>
			<div className="space-y-6">
				{isSubmitSuccessful && (
					<Alert variant="default">
						<CheckCircle className="h-4 w-4" />
						<AlertDescription>Portfolio duplicated successfully! Redirecting...</AlertDescription>
					</Alert>
				)}

				{errorMessage && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				)}

				<div className="rounded-lg border p-4 bg-muted/50">
					<div className="flex items-center justify-between mb-2">
						<h4 className="font-medium">Source Portfolio</h4>
						<Badge variant="secondary">{assetCount} assets</Badge>
					</div>
					<p className="text-sm text-muted-foreground mb-2">{portfolio.name}</p>
					{portfolio.description && (
						<p className="text-xs text-muted-foreground line-clamp-2">{portfolio.description}</p>
					)}
				</div>

				<Form {...form}>
					<form
						id="duplicate-portfolio-form"
						onSubmit={handleSubmit(handleFormSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										New Portfolio Name <span className="text-destructive">*</span>
									</FormLabel>
									<FormControl>
										<Input
											placeholder="Enter new portfolio name"
											disabled={isFormLoading}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Choose a unique name for the duplicated portfolio.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="copyAssets"
							render={({ field }) => (
								<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
									<FormControl>
										<Checkbox
											checked={field.value}
											onCheckedChange={field.onChange}
											disabled={isFormLoading}
										/>
									</FormControl>
									<div className="space-y-1 leading-none">
										<FormLabel className="flex items-center">
											<Package className="mr-2 h-4 w-4" />
											Copy Assets
										</FormLabel>
										<FormDescription>
											Include all assets and positions from the original portfolio.
											{assetCount > 0 && (
												<span className="block mt-1 text-xs">
													This will copy {assetCount} asset
													{assetCount !== 1 ? "s" : ""} with their current quantities and purchase
													prices.
												</span>
											)}
										</FormDescription>
									</div>
								</FormItem>
							)}
						/>

						<Separator />

						<div className="space-y-3">
							<h4 className="font-medium text-sm">What will be duplicated:</h4>
							<div className="space-y-2 text-sm">
								<div className="flex items-center justify-between">
									<div className="flex items-center">
										<FileText className="mr-2 h-4 w-4 text-muted-foreground" />
										Portfolio details (name, description)
									</div>
									<CheckCircle className="h-4 w-4 text-green-600" />
								</div>

								<div className="flex items-center justify-between">
									<div className="flex items-center">
										<Package className="mr-2 h-4 w-4 text-muted-foreground" />
										Assets and positions
									</div>
									{watchedValues.copyAssets ? (
										<CheckCircle className="h-4 w-4 text-green-600" />
									) : (
										<span className="text-xs text-muted-foreground">Skipped</span>
									)}
								</div>
							</div>

							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription className="text-xs">
									<strong>Note:</strong> Transaction history will not be copied. The new portfolio
									will start with a clean transaction record.
								</AlertDescription>
							</Alert>
						</div>
					</form>
				</Form>
			</div>
		</ActionDialog>
	);
}

function generateSuggestedName(originalName: string): string {
	const baseName = originalName.replace(/\s*\(Copy\s*\d*\)$/i, "").trim();
	return `${baseName} (Copy)`;
}

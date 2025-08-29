import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import {
	EnhancedPortfolioForm,
	type PortfolioFormData,
} from "@/components/portfolio";
import {
	PortfolioBreadcrumb,
	portfolioBreadcrumbs,
} from "@/components/portfolio/portfolio-breadcrumb";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { usePortfolioManagement } from "@/hooks/use-portfolio-management";
import { useAuth } from "@/lib/auth-context";

export default function PortfolioCreatePage() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<PortfolioBreadcrumb items={portfolioBreadcrumbs.portfolioCreate} />
					</div>
				</header>
				<PortfolioCreateContent />
			</SidebarInset>
		</SidebarProvider>
	);
}

function PortfolioCreateContent() {
	const navigate = useNavigate();
	const { createPortfolio, portfolios, isCreating } = usePortfolioManagement();
	const { user } = useAuth();
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [showSuccess, setShowSuccess] = useState(false);
	const [createdPortfolio, setCreatedPortfolio] = useState<any>(null);

	// Get existing portfolio names for validation
	const existingPortfolioNames = useMemo(() => {
		return portfolios?.map((p) => p.name) || [];
	}, [portfolios]);

	const handleSubmit = useCallback(
		async (data: PortfolioFormData) => {
			if (!user?.id) {
				const errorMsg = "User not authenticated. Please log in and try again.";
				setErrorMessage(errorMsg);
				toast.error(errorMsg);
				return;
			}

			setErrorMessage("");
			setShowSuccess(false);

			try {
				const result = await createPortfolio({
					userID: user.id,
					name: data.name,
					description: data.description || undefined,
				});

				if (result) {
					setCreatedPortfolio(result);
					setShowSuccess(true);
					toast.success("Portfolio created successfully!");

					// Navigate to the new portfolio detail page after a brief delay
					setTimeout(() => {
						navigate({ to: `/portfolios/${result.id}` });
					}, 2000);
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
				toast.error(errorMsg);
			}
		},
		[user?.id, createPortfolio, navigate],
	);

	const handleCancel = useCallback(() => {
		navigate({ to: "/portfolios" });
	}, [navigate]);

	const handleSuccess = useCallback((data: PortfolioFormData) => {
		// Success is handled in handleSubmit
	}, []);

	const handleError = useCallback((error: Error) => {
		// Error is handled in handleSubmit
	}, []);

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			{/* Header Section */}
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleCancel}
					className="gap-2"
					disabled={isCreating}
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Portfolios
				</Button>
			</div>

			<div className="max-w-2xl">
				<div className="mb-6">
					<h1 className="text-3xl font-bold tracking-tight">
						Create Portfolio
					</h1>
					<p className="text-muted-foreground">
						Create a new portfolio to organize and track your investments.
					</p>
				</div>

				{/* Success Message */}
				{showSuccess && createdPortfolio && (
					<Alert
						variant="default"
						className="mb-6 border-green-200 bg-green-50 text-green-800"
					>
						<CheckCircle className="h-4 w-4 text-green-600" />
						<AlertDescription>
							Portfolio "{createdPortfolio.name}" created successfully!
							Redirecting to portfolio details...
						</AlertDescription>
					</Alert>
				)}

				{/* Error Message */}
				{errorMessage && (
					<Alert variant="destructive" className="mb-6">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				)}

				<Card>
					<CardHeader>
						<CardTitle>Portfolio Details</CardTitle>
						<CardDescription>
							Enter the basic information for your new portfolio. Choose a
							unique name that helps you identify this portfolio's purpose or
							strategy.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<EnhancedPortfolioForm
							mode="create"
							onSubmit={handleSubmit}
							onCancel={handleCancel}
							isLoading={isCreating}
							showSuccessMessage={showSuccess}
							errorMessage={errorMessage}
							existingPortfolioNames={existingPortfolioNames}
							autoFocus={true}
							showResetButton={true}
							showCancelConfirmation={true}
							submitButtonText="Create Portfolio"
							cancelButtonText="Cancel"
							onSuccess={handleSuccess}
							onError={handleError}
						/>
					</CardContent>
				</Card>

				{/* Additional Information */}
				{!showSuccess && (
					<Card className="mt-6">
						<CardHeader>
							<CardTitle className="text-lg">What's Next?</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<p className="text-sm text-muted-foreground">
								After creating your portfolio, you'll be able to:
							</p>
							<ul className="text-sm text-muted-foreground space-y-1 ml-4">
								<li>• Add assets like stocks, crypto, real estate, and more</li>
								<li>• Track your investment performance over time</li>
								<li>• Record transactions and monitor your portfolio value</li>
								<li>• Generate reports and analytics</li>
							</ul>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}

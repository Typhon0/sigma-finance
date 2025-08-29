import { useNavigate, useParams } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { usePortfolioDetail } from "@/hooks/use-portfolio-detail";
import { usePortfolioManagement } from "@/hooks/use-portfolio-management";
import { useAuth } from "@/lib/auth-context";

export default function PortfolioEditPage() {
	const { portfolioId } = useParams({ from: "/portfolios/$portfolioId/edit" });
	const _navigate = useNavigate();

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<PortfolioBreadcrumb
							items={portfolioBreadcrumbs.portfolioEdit("Portfolio")}
						/>
					</div>
				</header>
				<PortfolioEditContent portfolioId={portfolioId} />
			</SidebarInset>
		</SidebarProvider>
	);
}

function PortfolioEditContent({ portfolioId }: { portfolioId: string }) {
	const navigate = useNavigate();
	const { portfolios, loading: portfoliosLoading } = usePortfolioManagement();
	const {
		portfolio,
		loading: portfolioLoading,
		error: portfolioError,
		handleUpdate,
		isOwner,
		isUnauthorized,
	} = usePortfolioDetail({
		portfolioId,
		onUpdateSuccess: () => {
			toast.success("Portfolio updated successfully!");
			// Navigate back to portfolio detail page after a brief delay
			setTimeout(() => {
				navigate({ to: `/portfolios/${portfolioId}` });
			}, 1000);
		},
	});
	const { user } = useAuth();
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [showSuccess, setShowSuccess] = useState(false);

	// Get existing portfolio names for validation (excluding current portfolio)
	const existingPortfolioNames = useMemo(() => {
		if (!portfolios || !portfolio) return [];
		return portfolios.filter((p) => p.id !== portfolioId).map((p) => p.name);
	}, [portfolios, portfolio, portfolioId]);

	// Combined loading state
	const loading = portfoliosLoading || portfolioLoading;

	useEffect(() => {
		// Handle authorization errors
		if (isUnauthorized) {
			setErrorMessage("You do not have permission to edit this portfolio.");
		} else if (portfolioError && !portfolio) {
			setErrorMessage("Portfolio not found or could not be loaded.");
		}
	}, [isUnauthorized, portfolioError, portfolio]);

	const handleSubmit = async (formData: PortfolioFormData) => {
		if (!portfolio) {
			setErrorMessage("Portfolio not found.");
			return;
		}

		if (!user?.id) {
			setErrorMessage("User not authenticated. Please log in and try again.");
			return;
		}

		if (!isOwner) {
			setErrorMessage("You do not have permission to edit this portfolio.");
			return;
		}

		setIsLoading(true);
		setErrorMessage("");

		try {
			await handleUpdate({
				name: formData.name,
				description: formData.description || undefined,
			});

			setShowSuccess(true);
		} catch (error) {
			if (error instanceof Error) {
				console.error("Error updating portfolio:", error);

				// Handle specific error cases
				if (
					error.message.includes("unique") ||
					error.message.includes("exists")
				) {
					setErrorMessage(
						"A portfolio with this name already exists. Please choose a different name.",
					);
				} else if (
					error.message.includes("unauthorized") ||
					error.message.includes("permission")
				) {
					setErrorMessage("You do not have permission to edit this portfolio.");
				} else if (error.message.includes("not found")) {
					setErrorMessage("Portfolio not found. It may have been deleted.");
				} else {
					setErrorMessage(
						error.message || "Failed to update portfolio. Please try again.",
					);
				}
			} else {
				console.error("An unknown error occurred:", error);
				setErrorMessage("An unknown error occurred while updating portfolio.");
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		navigate({ to: `/portfolios/${portfolioId}` });
	};

	if (loading) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="animate-pulse space-y-4">
					<div className="h-8 bg-muted rounded w-1/4"></div>
					<div className="h-64 bg-muted rounded"></div>
				</div>
			</div>
		);
	}

	if (portfolioError || !portfolio || isUnauthorized) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				{/* Header Section */}
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate({ to: "/portfolios" })}
						className="gap-2"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Portfolios
					</Button>
				</div>

				<Card className="p-6">
					<CardHeader>
						<CardTitle className="text-destructive">
							{portfolioError
								? "Error Loading Portfolio"
								: isUnauthorized
									? "Access Denied"
									: "Portfolio Not Found"}
						</CardTitle>
						<CardDescription>
							{portfolioError
								? "There was an error loading the portfolio details."
								: isUnauthorized
									? "You do not have permission to edit this portfolio."
									: "The requested portfolio could not be found."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={() => navigate({ to: "/portfolios" })}>
							Back to Portfolios
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			{/* Header Section */}
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleCancel}
					className="gap-2"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Portfolio
				</Button>
			</div>

			<div className="max-w-2xl">
				<div className="mb-6">
					<h1 className="text-3xl font-bold tracking-tight">Edit Portfolio</h1>
					<p className="text-muted-foreground">
						Update the details for "{portfolio.name}".
					</p>
				</div>

				{/* Portfolio not found error */}
				{errorMessage && !portfolio && (
					<Alert variant="destructive" className="mb-6">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				)}

				<Card>
					<CardHeader>
						<CardTitle>Portfolio Details</CardTitle>
						<CardDescription>
							Update the basic information for your portfolio.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<EnhancedPortfolioForm
							portfolio={{
								id: portfolio.id,
								name: portfolio.name,
								description: portfolio.description,
							}}
							mode="edit"
							onSubmit={handleSubmit}
							onCancel={handleCancel}
							isLoading={isLoading}
							showSuccessMessage={showSuccess}
							errorMessage={errorMessage}
							existingPortfolioNames={existingPortfolioNames}
							showCancelConfirmation={true}
							autoFocus={true}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

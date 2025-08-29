import { useNavigate, useParams } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
	PortfolioBreadcrumb,
	portfolioBreadcrumbs,
} from "@/components/portfolio/portfolio-breadcrumb";
import { EnhancedPortfolioForm, type PortfolioFormData } from "@/components/portfolio";
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
	const { data, loading, error, updatePortfolio } = usePortfolioManagement();
	const { user } = useAuth();
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [showSuccess, setShowSuccess] = useState(false);

	// Find the specific portfolio
	const portfolio = data?.portfolios.find((p) => p.id === portfolioId);

	useEffect(() => {
		// If portfolio is not found and we're not loading, show error
		if (!loading && !portfolio) {
			setErrorMessage(
				"Portfolio not found or you do not have permission to edit it.",
			);
		}
	}, [loading, portfolio]);

	const handleSubmit = async (formData: PortfolioFormData) => {
		if (!portfolio) {
			setErrorMessage("Portfolio not found.");
			return;
		}

		if (!user?.id) {
			setErrorMessage("User not authenticated. Please log in and try again.");
			return;
		}

		setIsLoading(true);
		setErrorMessage("");

		try {
			const result = await updatePortfolio(portfolioId, {
				name: formData.name,
				description: formData.description || undefined,
			});

			if (result.data?.updatePortfolio) {
				setShowSuccess(true);
				// Navigate back to portfolio detail page after a brief delay
				setTimeout(() => {
					navigate({ to: `/portfolios/${portfolioId}` });
				}, 1500);
			} else {
				setErrorMessage("Failed to update portfolio. Please try again.");
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error("Error updating portfolio:", error);
				setErrorMessage(
					`Failed to update portfolio. Server responded with: ${error.message}`,
				);
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

	if (error || !portfolio) {
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
							{error ? "Error Loading Portfolio" : "Portfolio Not Found"}
						</CardTitle>
						<CardDescription>
							{error
								? "There was an error loading the portfolio details."
								: "The requested portfolio could not be found or you do not have permission to edit it."}
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
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

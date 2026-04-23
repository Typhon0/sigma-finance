import { AlertCircle, ArrowLeft, RefreshCw, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PortfolioErrorDisplayProps {
	error: Error | null;
	portfolioId?: string;
	isUnauthorized?: boolean;
	onRetry?: () => void;
	onNavigateBack?: () => void;
	loading?: boolean;
}

export function PortfolioErrorDisplay({
	error,
	portfolioId,
	isUnauthorized = false,
	onRetry,
	onNavigateBack,
	loading = false,
}: PortfolioErrorDisplayProps) {
	// Handle unauthorized access
	if (isUnauthorized) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Card className="border-destructive/50">
					<CardHeader>
						<div className="flex items-center gap-2">
							<Shield className="h-5 w-5 text-destructive" />
							<CardTitle className="text-destructive">Access Denied</CardTitle>
						</div>
						<CardDescription>You don't have permission to view this portfolio.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								This portfolio belongs to another user. You can only view and manage your own
								portfolios.
							</AlertDescription>
						</Alert>

						<div className="flex gap-2">
							{onNavigateBack && (
								<Button onClick={onNavigateBack} variant="outline">
									<ArrowLeft className="mr-2 h-4 w-4" />
									Back to My Portfolios
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Handle portfolio not found
	if (error?.message?.includes("not found") || error?.message?.includes("Not found")) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Card>
					<CardHeader>
						<CardTitle className="text-destructive">Portfolio Not Found</CardTitle>
						<CardDescription>The requested portfolio could not be found.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								The portfolio you're looking for may have been deleted, moved, or you may not have
								permission to access it.
							</AlertDescription>
						</Alert>

						{portfolioId && (
							<div className="text-sm text-muted-foreground">
								Portfolio ID: <code className="bg-muted px-1 py-0.5 rounded">{portfolioId}</code>
							</div>
						)}

						<div className="flex gap-2">
							{onNavigateBack && (
								<Button onClick={onNavigateBack} variant="outline">
									<ArrowLeft className="mr-2 h-4 w-4" />
									Back to Portfolios
								</Button>
							)}
							{onRetry && (
								<Button onClick={onRetry} variant="outline" disabled={loading}>
									<RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
									{loading ? "Retrying..." : "Try Again"}
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Handle network/loading errors
	if (error) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Card className="border-destructive/50">
					<CardHeader>
						<CardTitle className="text-destructive">Error Loading Portfolio</CardTitle>
						<CardDescription>There was a problem loading the portfolio details.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								{error.message || "An unexpected error occurred while loading the portfolio."}
							</AlertDescription>
						</Alert>

						<div className="flex gap-2">
							{onRetry && (
								<Button onClick={onRetry} disabled={loading}>
									<RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
									{loading ? "Retrying..." : "Try Again"}
								</Button>
							)}
							{onNavigateBack && (
								<Button onClick={onNavigateBack} variant="outline">
									<ArrowLeft className="mr-2 h-4 w-4" />
									Back to Portfolios
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return null;
}

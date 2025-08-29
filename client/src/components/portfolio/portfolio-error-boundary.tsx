import { ApolloError } from "@apollo/client";
import {
	AlertTriangle,
	RefreshCw,
	WifiOff,
	Shield,
	FileX,
} from "lucide-react";
import type React from "react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	getErrorMessage,
	isNetworkError,
	isGraphQLError,
} from "@/hooks/use-error-handling";

interface PortfolioErrorBoundaryProps {
	children: ReactNode;
	fallback?: React.ComponentType<PortfolioErrorFallbackProps>;
	onReset?: () => void;
	onRetry?: () => Promise<void>;
	context?: "list" | "detail" | "form" | "general";
}

interface PortfolioErrorBoundaryState {
	error: Error | ApolloError | null;
	errorInfo: React.ErrorInfo | null;
	retryCount: number;
}

export interface PortfolioErrorFallbackProps {
	error: Error | ApolloError;
	errorInfo: React.ErrorInfo | null;
	resetErrorBoundary: () => void;
	onRetry?: () => Promise<void>;
	context?: "list" | "detail" | "form" | "general";
	retryCount: number;
}

export class PortfolioErrorBoundary extends Component<
	PortfolioErrorBoundaryProps,
	PortfolioErrorBoundaryState
> {
	private maxRetries = 3;

	state: PortfolioErrorBoundaryState = {
		error: null,
		errorInfo: null,
		retryCount: 0,
	};

	static getDerivedStateFromError(
		error: Error | ApolloError,
	): Partial<PortfolioErrorBoundaryState> {
		return { error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		this.setState({ errorInfo });

		// Log error to monitoring service
		console.error("Portfolio Error Boundary caught an error:", error, errorInfo);

		// Report to external monitoring if available
		if (typeof window !== "undefined" && (window as any).reportError) {
			(window as any).reportError(error, {
				context: this.props.context || "portfolio",
				componentStack: errorInfo.componentStack,
				retryCount: this.state.retryCount,
			});
		}
	}

	reset = () => {
		this.props.onReset?.();
		this.setState({
			error: null,
			errorInfo: null,
			retryCount: 0,
		});
	};

	retry = async () => {
		if (this.state.retryCount >= this.maxRetries) {
			return;
		}

		this.setState((prev) => ({
			retryCount: prev.retryCount + 1,
		}));

		try {
			if (this.props.onRetry) {
				await this.props.onRetry();
			}
			this.reset();
		} catch (error) {
			console.error("Retry failed:", error);
			// Error will be caught by componentDidCatch if it's a render error
		}
	};

	render() {
		const { error, errorInfo, retryCount } = this.state;
		const { fallback: FallbackComponent, children, context } = this.props;

		if (error) {
			const fallbackProps = {
				error,
				errorInfo,
				resetErrorBoundary: this.reset,
				onRetry: this.retry,
				context,
				retryCount,
			};

			if (FallbackComponent) {
				return <FallbackComponent {...fallbackProps} />;
			}

			return <PortfolioErrorFallback {...fallbackProps} />;
		}

		return children;
	}
}

export const PortfolioErrorFallback = ({
	error,
	errorInfo,
	resetErrorBoundary,
	onRetry,
	context = "general",
	retryCount,
}: PortfolioErrorFallbackProps) => {
	const isApolloError = error instanceof ApolloError;
	const isNetwork = isApolloError && isNetworkError(error as ApolloError);
	const isGraphQL = isApolloError && isGraphQLError(error as ApolloError);
	const message = getErrorMessage(error);
	const canRetry = retryCount < 3;

	// Determine error type and appropriate icon/message
	const getErrorDetails = () => {
		if (isNetwork) {
			return {
				icon: WifiOff,
				title: "Connection Error",
				description: "Unable to connect to the server. Please check your internet connection.",
				variant: "network" as const,
			};
		}

		if (isGraphQL && error instanceof ApolloError) {
			const graphQLError = error.graphQLErrors[0];
			if (graphQLError?.extensions?.code === "UNAUTHORIZED") {
				return {
					icon: Shield,
					title: "Access Denied",
					description: "You don't have permission to access this portfolio.",
					variant: "unauthorized" as const,
				};
			}
			if (graphQLError?.extensions?.code === "NOT_FOUND") {
				return {
					icon: FileX,
					title: "Portfolio Not Found",
					description: "The requested portfolio could not be found.",
					variant: "not-found" as const,
				};
			}
		}

		if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
			return {
				icon: WifiOff,
				title: "Network Error",
				description: "Unable to reach the server. Please try again.",
				variant: "network" as const,
			};
		}

		return {
			icon: AlertTriangle,
			title: getContextualTitle(context),
			description: message || "An unexpected error occurred.",
			variant: "general" as const,
		};
	};

	const getContextualTitle = (ctx: string) => {
		switch (ctx) {
			case "list":
				return "Error Loading Portfolios";
			case "detail":
				return "Error Loading Portfolio Details";
			case "form":
				return "Error Processing Portfolio";
			default:
				return "Something Went Wrong";
		}
	};

	const errorDetails = getErrorDetails();
	const Icon = errorDetails.icon;

	return (
		<Card className="border-destructive/50 max-w-2xl mx-auto">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-destructive">
					<Icon className="h-5 w-5" />
					{errorDetails.title}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<Alert variant={errorDetails.variant === "network" ? "destructive" : "default"}>
					<AlertDescription>{errorDetails.description}</AlertDescription>
				</Alert>

				{retryCount > 0 && (
					<div className="text-sm text-muted-foreground">
						Retry attempt: {retryCount}/3
					</div>
				)}

				<div className="flex flex-col sm:flex-row gap-2">
					{canRetry && onRetry && (
						<Button onClick={onRetry} variant="outline" className="gap-2">
							<RefreshCw className="h-4 w-4" />
							Try Again
						</Button>
					)}
					<Button onClick={resetErrorBoundary} variant="outline" className="gap-2">
						<RefreshCw className="h-4 w-4" />
						Reset
					</Button>
				</div>

				{process.env.NODE_ENV === "development" && (
					<details className="mt-4 text-left">
						<summary className="text-xs text-muted-foreground cursor-pointer mb-2">
							Error Details (Development)
						</summary>
						<div className="space-y-2">
							<pre className="text-xs text-muted-foreground p-2 bg-muted rounded overflow-auto max-h-32">
								{error.stack || JSON.stringify(error, null, 2)}
							</pre>
							{errorInfo && (
								<pre className="text-xs text-muted-foreground p-2 bg-muted rounded overflow-auto max-h-32">
									{errorInfo.componentStack}
								</pre>
							)}
						</div>
					</details>
				)}
			</CardContent>
		</Card>
	);
};

// Specialized error boundaries for different portfolio contexts
export const PortfolioListErrorBoundary = ({
	children,
	onRetry,
}: {
	children: ReactNode;
	onRetry?: () => Promise<void>;
}) => (
	<PortfolioErrorBoundary context="list" onRetry={onRetry}>
		{children}
	</PortfolioErrorBoundary>
);

export const PortfolioDetailErrorBoundary = ({
	children,
	onRetry,
}: {
	children: ReactNode;
	onRetry?: () => Promise<void>;
}) => (
	<PortfolioErrorBoundary context="detail" onRetry={onRetry}>
		{children}
	</PortfolioErrorBoundary>
);

export const PortfolioFormErrorBoundary = ({
	children,
	onRetry,
}: {
	children: ReactNode;
	onRetry?: () => Promise<void>;
}) => (
	<PortfolioErrorBoundary context="form" onRetry={onRetry}>
		{children}
	</PortfolioErrorBoundary>
);

// HOC for wrapping components with portfolio error boundary
export function withPortfolioErrorBoundary<P extends object>(
	Component: React.ComponentType<P>,
	context?: "list" | "detail" | "form" | "general",
	onRetry?: () => Promise<void>,
): React.ComponentType<P> {
	const Wrapped = (props: P) => (
		<PortfolioErrorBoundary context={context} onRetry={onRetry}>
			<Component {...props} />
		</PortfolioErrorBoundary>
	);

	const displayName = Component.displayName || Component.name || "Component";
	Wrapped.displayName = `withPortfolioErrorBoundary(${displayName})`;

	return Wrapped;
}

export default PortfolioErrorBoundary;
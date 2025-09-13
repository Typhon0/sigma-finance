import { ApolloError } from "@apollo/client";
import { AlertTriangle, RefreshCw, WifiOff, Home, ArrowLeft } from "lucide-react";
import type React from "react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage, isNetworkError } from "@/hooks/use-error-handling";
import { cn } from "@/lib/utils";

interface DashboardErrorBoundaryProps {
	children: ReactNode;
	fallback?: React.ComponentType<DashboardErrorFallbackProps>;
	onReset?: () => void;
	onNavigateHome?: () => void;
	onNavigateBack?: () => void;
	context?: 'overview' | 'portfolio-detail' | 'asset-detail' | 'chart' | 'component';
	componentName?: string;
}

interface DashboardErrorBoundaryState {
	error: Error | ApolloError | null;
	errorInfo: React.ErrorInfo | null;
	retryCount: number;
}

export interface DashboardErrorFallbackProps {
	error: Error | ApolloError;
	errorInfo: React.ErrorInfo | null;
	resetErrorBoundary: () => void;
	onNavigateHome?: () => void;
	onNavigateBack?: () => void;
	context?: DashboardErrorBoundaryProps['context'];
	componentName?: string;
	retryCount: number;
}

class DashboardErrorBoundary extends Component<
	DashboardErrorBoundaryProps,
	DashboardErrorBoundaryState
> {
	private retryTimeoutId: NodeJS.Timeout | null = null;

	state: DashboardErrorBoundaryState = {
		error: null,
		errorInfo: null,
		retryCount: 0,
	};

	static getDerivedStateFromError(
		error: Error | ApolloError,
	): Partial<DashboardErrorBoundaryState> {
		return { error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		this.setState({ errorInfo });

		// Log error to console in development
		if (process.env.NODE_ENV === 'development') {
			console.error('Dashboard Error Boundary caught an error:', error, errorInfo);
		}

		// Report to monitoring service if available
		if (typeof window !== "undefined" && (window as any).reportError) {
			(window as any).reportError(error, {
				context: this.props.context || 'dashboard',
				componentName: this.props.componentName,
				errorInfo,
				retryCount: this.state.retryCount,
			});
		}
	}

	reset = () => {
		this.props.onReset?.();
		this.setState({ 
			error: null, 
			errorInfo: null,
			retryCount: this.state.retryCount + 1
		});
	};

	autoRetry = () => {
		// Auto-retry for network errors after a delay
		if (this.state.error && isNetworkError(this.state.error as ApolloError) && this.state.retryCount < 2) {
			this.retryTimeoutId = setTimeout(() => {
				this.reset();
			}, 3000 + (this.state.retryCount * 2000)); // Exponential backoff
		}
	};

	componentDidUpdate(prevProps: DashboardErrorBoundaryProps, prevState: DashboardErrorBoundaryState) {
		// Trigger auto-retry when error occurs
		if (!prevState.error && this.state.error) {
			this.autoRetry();
		}
	}

	componentWillUnmount() {
		if (this.retryTimeoutId) {
			clearTimeout(this.retryTimeoutId);
		}
	}

	render() {
		const { error, errorInfo, retryCount } = this.state;
		const { fallback: FallbackComponent, children, context, componentName, onNavigateHome, onNavigateBack } = this.props;

		if (error) {
			const fallbackProps: DashboardErrorFallbackProps = {
				error,
				errorInfo,
				resetErrorBoundary: this.reset,
				onNavigateHome,
				onNavigateBack,
				context,
				componentName,
				retryCount,
			};

			if (FallbackComponent) {
				return <FallbackComponent {...fallbackProps} />;
			}

			return <DashboardErrorFallback {...fallbackProps} />;
		}

		return children;
	}
}

export const DashboardErrorFallback = ({
	error,
	errorInfo,
	resetErrorBoundary,
	onNavigateHome,
	onNavigateBack,
	context = 'component',
	componentName,
	retryCount,
}: DashboardErrorFallbackProps) => {
	const isApolloError = error instanceof ApolloError;
	const isNetwork = isApolloError && isNetworkError(error as ApolloError);
	const message = getErrorMessage(error);
	const maxRetries = 3;
	const canRetry = retryCount < maxRetries;

	const getContextTitle = () => {
		switch (context) {
			case 'overview':
				return 'Dashboard Overview Error';
			case 'portfolio-detail':
				return 'Portfolio Details Error';
			case 'asset-detail':
				return 'Asset Details Error';
			case 'chart':
				return 'Chart Loading Error';
			default:
				return componentName ? `${componentName} Error` : 'Component Error';
		}
	};

	const getContextDescription = () => {
		switch (context) {
			case 'overview':
				return 'Unable to load dashboard overview. Your data is safe.';
			case 'portfolio-detail':
				return 'Unable to load portfolio details. Try refreshing or go back to overview.';
			case 'asset-detail':
				return 'Unable to load asset details. The asset data may be temporarily unavailable.';
			case 'chart':
				return 'Chart data could not be loaded. This may be due to network issues.';
			default:
				return 'This component encountered an error and needs to be reloaded.';
		}
	};

	const getErrorSeverity = () => {
		if (isNetwork) return 'warning';
		if (context === 'chart' || context === 'component') return 'minor';
		return 'major';
	};

	const severity = getErrorSeverity();

	return (
		<Card className={cn(
			"border-destructive",
			severity === 'minor' && "border-orange-200",
			severity === 'warning' && "border-yellow-200"
		)}>
			<CardHeader className="pb-3">
				<div className="flex items-center gap-3">
					{isNetwork ? (
						<WifiOff className="h-6 w-6 text-orange-500" />
					) : (
						<AlertTriangle className="h-6 w-6 text-destructive" />
					)}
					<div className="flex-1">
						<CardTitle className="text-lg">{getContextTitle()}</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							{getContextDescription()}
						</p>
					</div>
					<Badge variant={severity === 'major' ? 'destructive' : 'secondary'}>
						{isNetwork ? 'Network' : 'Error'}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="p-3 bg-muted rounded-lg">
					<p className="text-sm font-medium text-muted-foreground mb-1">
						Error Details:
					</p>
					<p className="text-sm">{message}</p>
					{retryCount > 0 && (
						<p className="text-xs text-muted-foreground mt-2">
							Retry attempt: {retryCount}/{maxRetries}
						</p>
					)}
				</div>

				<div className="flex flex-wrap gap-2">
					{canRetry && (
						<Button
							onClick={resetErrorBoundary}
							className="gap-2"
							variant={severity === 'major' ? 'default' : 'outline'}
						>
							<RefreshCw className="h-4 w-4" />
							{retryCount > 0 ? 'Try Again' : 'Retry'}
						</Button>
					)}

					{!canRetry && (
						<Button
							onClick={resetErrorBoundary}
							variant="outline"
							className="gap-2"
						>
							<RefreshCw className="h-4 w-4" />
							Reset Component
						</Button>
					)}

					{onNavigateBack && context !== 'overview' && (
						<Button
							onClick={onNavigateBack}
							variant="outline"
							className="gap-2"
						>
							<ArrowLeft className="h-4 w-4" />
							Go Back
						</Button>
					)}

					{onNavigateHome && context !== 'overview' && (
						<Button
							onClick={onNavigateHome}
							variant="outline"
							className="gap-2"
						>
							<Home className="h-4 w-4" />
							Dashboard Home
						</Button>
					)}
				</div>

				{isNetwork && (
					<div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
						<p className="text-sm text-orange-800">
							<strong>Connection Issue:</strong> Check your internet connection. 
							The app will automatically retry when connection is restored.
						</p>
					</div>
				)}

				{process.env.NODE_ENV === "development" && errorInfo && (
					<details className="mt-4">
						<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
							Technical Details (Development)
						</summary>
						<div className="mt-2 p-3 bg-muted rounded text-xs font-mono">
							<div className="mb-2">
								<strong>Component Stack:</strong>
								<pre className="mt-1 whitespace-pre-wrap">{errorInfo.componentStack}</pre>
							</div>
							<div>
								<strong>Error Stack:</strong>
								<pre className="mt-1 whitespace-pre-wrap">{error.stack}</pre>
							</div>
						</div>
					</details>
				)}
			</CardContent>
		</Card>
	);
};

export function withDashboardErrorBoundary<P extends object>(
	Component: React.ComponentType<P>,
	errorBoundaryProps?: Omit<DashboardErrorBoundaryProps, "children">,
): React.ComponentType<P> {
	const Wrapped = (props: P) => (
		<DashboardErrorBoundary {...errorBoundaryProps}>
			<Component {...props} />
		</DashboardErrorBoundary>
	);

	const displayName = Component.displayName || Component.name || "Component";
	Wrapped.displayName = `withDashboardErrorBoundary(${displayName})`;

	return Wrapped;
}

export default DashboardErrorBoundary;
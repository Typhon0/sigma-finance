import { ApolloError } from "@apollo/client";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import type React from "react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorMessage, isNetworkError } from "@/hooks/use-error-handling";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: React.ComponentType<FallbackProps>;
	onReset?: () => void;
}

interface ErrorBoundaryState {
	error: Error | ApolloError | null;
}

export interface FallbackProps {
	error: Error | ApolloError;
	resetErrorBoundary: () => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	state: ErrorBoundaryState = {
		error: null,
	};

	static getDerivedStateFromError(error: Error | ApolloError): ErrorBoundaryState {
		return { error };
	}

	reset = () => {
		this.props.onReset?.();
		this.setState({ error: null });
	};

	render() {
		const { error } = this.state;
		const { fallback: FallbackComponent, children } = this.props;

		if (error) {
			const fallbackProps = {
				error,
				resetErrorBoundary: this.reset,
			};

			if (FallbackComponent) {
				return <FallbackComponent {...fallbackProps} />;
			}

			return <DefaultErrorFallback {...fallbackProps} />;
		}

		return children;
	}
}

export const DefaultErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
	const isApolloError = error instanceof ApolloError;
	const isNetwork = isApolloError && isNetworkError(error as ApolloError);
	const message = getErrorMessage(error);

	return (
		<Card className="border-destructive">
			<CardContent className="flex flex-col items-center justify-center p-6 text-center">
				{isNetwork ? (
					<WifiOff className="h-8 w-8 text-destructive mb-2" />
				) : (
					<AlertTriangle className="h-8 w-8 text-destructive mb-2" />
				)}
				<h3 className="font-semibold text-destructive mb-2">
					{isNetwork ? "Connection Error" : "Something went wrong"}
				</h3>
				<p className="text-sm text-muted-foreground mb-4 max-w-sm">{message}</p>
				<Button variant="outline" size="sm" onClick={resetErrorBoundary} className="gap-2">
					<RefreshCw className="h-4 w-4" />
					Try again
				</Button>
				{process.env.NODE_ENV === "development" && (
					<details className="mt-4 w-full text-left">
						<summary className="text-xs text-muted-foreground cursor-pointer">
							Error Details
						</summary>
						<pre className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
							{error.stack || JSON.stringify(error, null, 2)}
						</pre>
					</details>
				)}
			</CardContent>
		</Card>
	);
};

export function withErrorBoundary<P extends object>(
	Component: React.ComponentType<P>,
	errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
): React.ComponentType<P> {
	const Wrapped = (props: P) => (
		<ErrorBoundary {...errorBoundaryProps}>
			<Component {...props} />
		</ErrorBoundary>
	);

	const displayName = Component.displayName || Component.name || "Component";
	Wrapped.displayName = `withErrorBoundary(${displayName})`;

	return Wrapped;
}

export default ErrorBoundary;

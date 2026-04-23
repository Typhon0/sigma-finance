import { AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface LoadingIndicatorProps {
	message?: string;
	size?: "sm" | "md" | "lg";
	variant?: "spinner" | "dots" | "pulse";
	className?: string;
}

export function LoadingIndicator({
	message = "Loading...",
	size = "md",
	variant = "spinner",
	className,
}: LoadingIndicatorProps) {
	const sizeClasses = {
		sm: "h-3 w-3",
		md: "h-4 w-4",
		lg: "h-6 w-6",
	};

	const textSizeClasses = {
		sm: "text-xs",
		md: "text-sm",
		lg: "text-base",
	};

	if (variant === "dots") {
		return (
			<div className={cn("flex items-center gap-2", className)}>
				<div className="flex space-x-1">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className={cn("rounded-full bg-current animate-pulse", sizeClasses[size])}
							style={{
								animationDelay: `${i * 0.2}s`,
								animationDuration: "1s",
							}}
						/>
					))}
				</div>
				<span className={cn("text-muted-foreground", textSizeClasses[size])}>{message}</span>
			</div>
		);
	}

	if (variant === "pulse") {
		return (
			<div className={cn("flex items-center gap-2", className)}>
				<div className={cn("rounded-full bg-current animate-pulse", sizeClasses[size])} />
				<span className={cn("text-muted-foreground", textSizeClasses[size])}>{message}</span>
			</div>
		);
	}

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Loader2 className={cn("animate-spin", sizeClasses[size])} />
			<span className={cn("text-muted-foreground", textSizeClasses[size])}>{message}</span>
		</div>
	);
}

interface AsyncOperationIndicatorProps {
	isLoading: boolean;
	error?: Error | null;
	success?: boolean;
	loadingMessage?: string;
	successMessage?: string;
	errorMessage?: string;
	onRetry?: () => void;
	canRetry?: boolean;
	className?: string;
}

export function AsyncOperationIndicator({
	isLoading,
	error,
	success,
	loadingMessage = "Processing...",
	successMessage = "Operation completed successfully",
	errorMessage,
	onRetry,
	canRetry = true,
	className,
}: AsyncOperationIndicatorProps) {
	if (success) {
		return (
			<Alert className={cn("border-green-200 bg-green-50", className)}>
				<CheckCircle className="h-4 w-4 text-green-600" />
				<AlertDescription className="text-green-800">{successMessage}</AlertDescription>
			</Alert>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive" className={className}>
				<AlertCircle className="h-4 w-4" />
				<AlertDescription className="flex items-center justify-between">
					<span>{errorMessage || error.message}</span>
					{onRetry && canRetry && (
						<Button variant="outline" size="sm" onClick={onRetry}>
							<RefreshCw className="h-3 w-3 mr-1" />
							Retry
						</Button>
					)}
				</AlertDescription>
			</Alert>
		);
	}

	if (isLoading) {
		return (
			<Alert className={className}>
				<LoadingIndicator message={loadingMessage} size="sm" />
			</Alert>
		);
	}

	return null;
}

interface PortfolioOperationStatusProps {
	operations: {
		create?: boolean;
		update?: boolean;
		delete?: boolean;
		duplicate?: boolean;
		loading?: boolean;
	};
	className?: string;
}

export function PortfolioOperationStatus({ operations, className }: PortfolioOperationStatusProps) {
	const getOperationMessage = () => {
		if (operations.create) return "Creating portfolio...";
		if (operations.update) return "Updating portfolio...";
		if (operations.delete) return "Deleting portfolio...";
		if (operations.duplicate) return "Duplicating portfolio...";
		if (operations.loading) return "Loading portfolios...";
		return null;
	};

	const message = getOperationMessage();

	if (!message) return null;

	return (
		<div className={cn("mb-4", className)}>
			<LoadingIndicator message={message} />
		</div>
	);
}

interface ProgressiveLoadingProps {
	steps: Array<{
		label: string;
		completed: boolean;
		loading: boolean;
		error?: boolean;
	}>;
	className?: string;
}

export function ProgressiveLoading({ steps, className }: ProgressiveLoadingProps) {
	const completedSteps = steps.filter((step) => step.completed).length;
	const progress = (completedSteps / steps.length) * 100;

	return (
		<Card className={className}>
			<CardContent className="p-4 space-y-4">
				<div className="space-y-2">
					<div className="flex justify-between text-sm">
						<span>Loading Progress</span>
						<span>
							{completedSteps}/{steps.length}
						</span>
					</div>
					<Progress value={progress} className="h-2" />
				</div>

				<div className="space-y-2">
					{steps.map((step, index) => (
						<div key={index} className="flex items-center gap-2 text-sm">
							{step.error ? (
								<AlertCircle className="h-4 w-4 text-destructive" />
							) : step.completed ? (
								<CheckCircle className="h-4 w-4 text-green-600" />
							) : step.loading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<div className="h-4 w-4 rounded-full border-2 border-muted" />
							)}
							<span
								className={cn(
									step.completed
										? "text-green-600"
										: step.error
											? "text-destructive"
											: step.loading
												? "text-foreground"
												: "text-muted-foreground",
								)}
							>
								{step.label}
							</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

interface InlineLoadingProps {
	isLoading: boolean;
	children: React.ReactNode;
	loadingText?: string;
	size?: "sm" | "md" | "lg";
}

export function InlineLoading({
	isLoading,
	children,
	loadingText = "Loading...",
	size = "sm",
}: InlineLoadingProps) {
	if (isLoading) {
		return <LoadingIndicator message={loadingText} size={size} />;
	}

	return <>{children}</>;
}

interface ButtonLoadingProps {
	isLoading: boolean;
	children: React.ReactNode;
	loadingText?: string;
}

export function ButtonLoading({ isLoading, children, loadingText }: ButtonLoadingProps) {
	if (isLoading) {
		return (
			<>
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
				{loadingText || children}
			</>
		);
	}

	return <>{children}</>;
}

// Skeleton loading for specific portfolio components
export function PortfolioCardLoadingSkeleton() {
	return (
		<Card className="animate-pulse">
			<CardContent className="p-4">
				<div className="space-y-3">
					<div className="h-4 bg-muted rounded w-3/4" />
					<div className="h-3 bg-muted rounded w-1/2" />
					<div className="h-6 bg-muted rounded w-1/3" />
				</div>
			</CardContent>
		</Card>
	);
}

export function PortfolioFormLoadingSkeleton() {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<div className="h-4 bg-muted rounded w-24" />
				<div className="h-10 bg-muted rounded" />
			</div>
			<div className="space-y-2">
				<div className="h-4 bg-muted rounded w-32" />
				<div className="h-20 bg-muted rounded" />
			</div>
			<div className="flex gap-2">
				<div className="h-10 bg-muted rounded w-20" />
				<div className="h-10 bg-muted rounded w-24" />
			</div>
		</div>
	);
}

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	AutoRetryWrapper,
	ChartErrorFallback,
	DashboardErrorBoundary,
	DashboardErrorManagerProvider,
	InlineChartSkeleton,
	OfflineIndicator,
	useComponentErrorHandler,
	useDashboardErrorManager,
	useOfflineHandler,
	useRetryMechanism,
} from "./index";

// Demo component that can throw errors
function ErrorProneComponent({ shouldError }: { shouldError: boolean }) {
	const { handleErrorWithRetry } = useComponentErrorHandler(
		"ErrorProneComponent",
		"component",
	);

	const handleAction = async () => {
		await handleErrorWithRetry(async () => {
			if (shouldError) {
				throw new Error("Demo error from component");
			}
			alert("Action completed successfully!");
		});
	};

	if (shouldError) {
		throw new Error("Component render error");
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Error Prone Component</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="mb-4">
					This component can throw errors for demonstration.
				</p>
				<Button onClick={handleAction}>Trigger Action</Button>
			</CardContent>
		</Card>
	);
}

// Demo component for retry mechanism
function RetryDemo() {
	const [attemptCount, setAttemptCount] = useState(0);

	const retryFn = async () => {
		setAttemptCount((prev) => prev + 1);
		if (attemptCount < 2) {
			throw new Error(`Retry attempt ${attemptCount + 1} failed`);
		}
		alert("Retry succeeded!");
		setAttemptCount(0);
	};

	const { retryState, retry } = useRetryMechanism(retryFn);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Retry Mechanism Demo</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p>This will fail twice, then succeed on the third attempt.</p>
				<div className="flex items-center gap-2">
					<Button onClick={retry} disabled={retryState.isRetrying}>
						{retryState.isRetrying ? "Retrying..." : "Start Retry Demo"}
					</Button>
					<Badge variant="outline">Attempts: {retryState.retryCount}</Badge>
				</div>
				{retryState.nextRetryIn > 0 && (
					<p className="text-sm text-muted-foreground">
						Next retry in {retryState.nextRetryIn} seconds
					</p>
				)}
			</CardContent>
		</Card>
	);
}

// Demo component for offline handling
function OfflineDemo() {
	const { offlineState } = useOfflineHandler();

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Offline Status Demo
					<OfflineIndicator offlineState={offlineState} variant="badge" />
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					<p>Online: {offlineState.isOnline ? "Yes" : "No"}</p>
					<p>Was Offline: {offlineState.wasOffline ? "Yes" : "No"}</p>
					{offlineState.offlineSince && (
						<p>
							Offline Since: {offlineState.offlineSince.toLocaleTimeString()}
						</p>
					)}
					<p className="text-sm text-muted-foreground">
						Try disconnecting your internet to see the offline state.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// Demo component for chart error fallback
function ChartErrorDemo() {
	const [hasError, setHasError] = useState(false);
	const [showFallback, setShowFallback] = useState(false);

	if (hasError) {
		return (
			<ChartErrorFallback
				error={new Error("Chart failed to load")}
				chartType="pie"
				title="Demo Chart"
				onRetry={() => setHasError(false)}
				showFallbackData={showFallback}
			/>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Chart Error Demo</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p>Simulate chart loading errors with different fallback options.</p>
				<div className="flex gap-2">
					<Button onClick={() => setHasError(true)}>Trigger Chart Error</Button>
					<Button
						variant="outline"
						onClick={() => {
							setShowFallback(!showFallback);
							setHasError(true);
						}}
					>
						With Fallback Data
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// Demo component for loading states
function LoadingStatesDemo() {
	const [isLoading, setIsLoading] = useState(false);

	const simulateLoading = () => {
		setIsLoading(true);
		setTimeout(() => setIsLoading(false), 3000);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Loading States Demo</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<Button onClick={simulateLoading} disabled={isLoading}>
					{isLoading ? "Loading..." : "Simulate Loading"}
				</Button>

				{isLoading ? (
					<InlineChartSkeleton height={200} title="Demo Chart" />
				) : (
					<div className="h-48 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
						<p className="text-muted-foreground">
							Chart content would appear here
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// Error manager demo
function ErrorManagerDemo() {
	const { actions, errorState } = useDashboardErrorManager();

	const triggerError = () => {
		actions.reportError(
			new Error("Manual error from demo"),
			"component",
			"ErrorManagerDemo",
		);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Error Manager Demo</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-2">
					<Button onClick={triggerError}>Report Error</Button>
					<Button variant="outline" onClick={actions.clearAllErrors}>
						Clear All Errors
					</Button>
				</div>

				<div className="space-y-2">
					<p>
						Active Errors: {errorState.errors.filter((e) => !e.resolved).length}
					</p>
					<p>Total Errors: {errorState.errors.length}</p>
					<p>Has Critical Error: {errorState.criticalError ? "Yes" : "No"}</p>
					<p>Is Recovering: {errorState.isRecovering ? "Yes" : "No"}</p>
				</div>

				{errorState.errors.length > 0 && (
					<div className="space-y-2">
						<h4 className="font-medium">Recent Errors:</h4>
						{errorState.errors.slice(-3).map((error) => (
							<div key={error.id} className="text-sm p-2 bg-muted rounded">
								<div className="flex items-center gap-2">
									<Badge variant={error.resolved ? "secondary" : "destructive"}>
										{error.context}
									</Badge>
									<span>{error.componentName}</span>
								</div>
								<p className="text-muted-foreground mt-1">
									{error.error.message}
								</p>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// Main demo component
export function ErrorHandlingDemo() {
	const [componentError, setComponentError] = useState(false);

	return (
		<DashboardErrorManagerProvider>
			<div className="container mx-auto p-6 space-y-6">
				<div className="text-center space-y-2">
					<h1 className="text-3xl font-bold">Dashboard Error Handling Demo</h1>
					<p className="text-muted-foreground">
						Interactive demonstration of the comprehensive error handling system
					</p>
				</div>

				<div className="grid gap-6 md:grid-cols-2">
					{/* Error Boundary Demo */}
					<DashboardErrorBoundary
						context="component"
						componentName="ErrorProneComponent"
						onReset={() => setComponentError(false)}
					>
						<div className="space-y-4">
							<div className="flex gap-2">
								<Button
									variant={componentError ? "destructive" : "outline"}
									onClick={() => setComponentError(!componentError)}
								>
									{componentError ? "Fix Component" : "Break Component"}
								</Button>
							</div>
							<ErrorProneComponent shouldError={componentError} />
						</div>
					</DashboardErrorBoundary>

					{/* Retry Demo */}
					<RetryDemo />

					{/* Offline Demo */}
					<OfflineDemo />

					{/* Chart Error Demo */}
					<ChartErrorDemo />

					{/* Loading States Demo */}
					<LoadingStatesDemo />

					{/* Error Manager Demo */}
					<ErrorManagerDemo />
				</div>

				{/* Auto Retry Wrapper Demo */}
				<Card>
					<CardHeader>
						<CardTitle>Auto Retry Wrapper Demo</CardTitle>
					</CardHeader>
					<CardContent>
						<AutoRetryWrapper
							retryFn={async () => {
								// Simulate random failure
								if (Math.random() < 0.7) {
									throw new Error("Random failure for demo");
								}
							}}
							showStatus={true}
							showButton={true}
						>
							<div className="p-4 border rounded-lg">
								<p>This content is wrapped with auto-retry functionality.</p>
								<p className="text-sm text-muted-foreground mt-2">
									The wrapper will automatically retry failed operations with
									exponential backoff.
								</p>
							</div>
						</AutoRetryWrapper>
					</CardContent>
				</Card>
			</div>
		</DashboardErrorManagerProvider>
	);
}

export default ErrorHandlingDemo;

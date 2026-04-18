import { ApolloError } from "@apollo/client";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { DashboardViewState } from "@/hooks/use-dashboard-state";
import { useErrorHandling } from "@/hooks/use-error-handling";
import { useOfflineHandler } from "./offline-handler";

export interface DashboardError {
	id: string;
	error: Error | ApolloError;
	context:
		| "overview"
		| "portfolio-detail"
		| "asset-detail"
		| "chart"
		| "component";
	componentName?: string;
	timestamp: Date;
	resolved: boolean;
	retryCount: number;
}

export interface DashboardErrorState {
	errors: DashboardError[];
	hasActiveErrors: boolean;
	criticalError: DashboardError | null;
	isRecovering: boolean;
}

export interface DashboardErrorActions {
	reportError: (
		error: Error | ApolloError,
		context: DashboardError["context"],
		componentName?: string,
	) => void;
	resolveError: (errorId: string) => void;
	clearAllErrors: () => void;
	retryError: (errorId: string, retryFn: () => Promise<void>) => Promise<void>;
	handleViewTransitionError: (
		error: Error,
		fromView: string,
		toView: string,
	) => void;
}

interface DashboardErrorManagerContextType {
	errorState: DashboardErrorState;
	actions: DashboardErrorActions;
	offlineState: ReturnType<typeof useOfflineHandler>["offlineState"];
}

const DashboardErrorManagerContext =
	createContext<DashboardErrorManagerContextType | null>(null);

export function useDashboardErrorManager() {
	const context = useContext(DashboardErrorManagerContext);
	if (!context) {
		throw new Error(
			"useDashboardErrorManager must be used within DashboardErrorManagerProvider",
		);
	}
	return context;
}

interface DashboardErrorManagerProviderProps {
	children: React.ReactNode;
	onCriticalError?: (error: DashboardError) => void;
	onRecovery?: () => void;
}

export function DashboardErrorManagerProvider({
	children,
	onCriticalError,
	onRecovery,
}: DashboardErrorManagerProviderProps) {
	const [errorState, setErrorState] = useState<DashboardErrorState>({
		errors: [],
		hasActiveErrors: false,
		criticalError: null,
		isRecovering: false,
	});

	const { offlineState } = useOfflineHandler();

	const generateErrorId = () =>
		`error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	const isCriticalError = useCallback(
		(error: Error | ApolloError, context: DashboardError["context"]) => {
			// Network errors are not critical if we have offline capabilities
			if (error instanceof ApolloError && error.networkError) {
				return false;
			}

			// Overview context errors are more critical
			if (context === "overview") {
				return true;
			}

			// Component errors are usually not critical
			if (context === "component" || context === "chart") {
				return false;
			}

			// Check for specific error patterns that indicate critical issues
			const errorMessage = error.message.toLowerCase();
			const criticalPatterns = [
				"authentication",
				"authorization",
				"session expired",
				"access denied",
				"server error",
				"internal error",
			];

			return criticalPatterns.some((pattern) => errorMessage.includes(pattern));
		},
		[],
	);

	const reportError = useCallback(
		(
			error: Error | ApolloError,
			context: DashboardError["context"],
			componentName?: string,
		) => {
			const errorId = generateErrorId();
			const newError: DashboardError = {
				id: errorId,
				error,
				context,
				componentName,
				timestamp: new Date(),
				resolved: false,
				retryCount: 0,
			};

			setErrorState((prev) => {
				const updatedErrors = [...prev.errors, newError];
				const activeErrors = updatedErrors.filter((e) => !e.resolved);
				const critical = isCriticalError(error, context)
					? newError
					: prev.criticalError;

				return {
					...prev,
					errors: updatedErrors,
					hasActiveErrors: activeErrors.length > 0,
					criticalError: critical,
				};
			});

			// Notify about critical errors
			if (isCriticalError(error, context) && onCriticalError) {
				onCriticalError(newError);
			}

			// Log error for monitoring
			console.error(
				`Dashboard Error [${context}${componentName ? `:${componentName}` : ""}]:`,
				error,
			);

			return errorId;
		},
		[isCriticalError, onCriticalError],
	);

	const resolveError = useCallback((errorId: string) => {
		setErrorState((prev) => {
			const updatedErrors = prev.errors.map((error) =>
				error.id === errorId ? { ...error, resolved: true } : error,
			);
			const activeErrors = updatedErrors.filter((e) => !e.resolved);
			const criticalError =
				prev.criticalError?.id === errorId ? null : prev.criticalError;

			return {
				...prev,
				errors: updatedErrors,
				hasActiveErrors: activeErrors.length > 0,
				criticalError,
			};
		});
	}, []);

	const clearAllErrors = useCallback(() => {
		setErrorState({
			errors: [],
			hasActiveErrors: false,
			criticalError: null,
			isRecovering: false,
		});
	}, []);

	const retryError = useCallback(
		async (errorId: string, retryFn: () => Promise<void>) => {
			setErrorState((prev) => ({
				...prev,
				isRecovering: true,
			}));

			try {
				await retryFn();

				// Success - resolve the error
				resolveError(errorId);

				setErrorState((prev) => ({
					...prev,
					isRecovering: false,
				}));

				if (onRecovery) {
					onRecovery();
				}
			} catch (error) {
				// Update retry count
				setErrorState((prev) => ({
					...prev,
					errors: prev.errors.map((e) =>
						e.id === errorId ? { ...e, retryCount: e.retryCount + 1 } : e,
					),
					isRecovering: false,
				}));

				throw error; // Re-throw to let retry mechanism handle it
			}
		},
		[resolveError, onRecovery],
	);

	const handleViewTransitionError = useCallback(
		(error: Error, fromView: string, toView: string) => {
			const errorId = reportError(
				error,
				"component",
				`ViewTransition:${fromView}->${toView}`,
			);

			// For view transition errors, we might want to reset to a safe state
			console.warn(
				`View transition error from ${fromView} to ${toView}:`,
				error,
			);

			return errorId;
		},
		[reportError],
	);

	// Auto-cleanup resolved errors after 5 minutes
	useEffect(() => {
		const cleanup = setInterval(() => {
			setErrorState((prev) => ({
				...prev,
				errors: prev.errors.filter((error) => {
					if (!error.resolved) return true;
					const age = Date.now() - error.timestamp.getTime();
					return age < 5 * 60 * 1000; // Keep for 5 minutes
				}),
			}));
		}, 60000); // Check every minute

		return () => clearInterval(cleanup);
	}, []);

	const actions: DashboardErrorActions = {
		reportError,
		resolveError,
		clearAllErrors,
		retryError,
		handleViewTransitionError,
	};

	const contextValue: DashboardErrorManagerContextType = {
		errorState,
		actions,
		offlineState,
	};

	return (
		<DashboardErrorManagerContext.Provider value={contextValue}>
			{children}
		</DashboardErrorManagerContext.Provider>
	);
}

// Hook for component-level error handling with automatic reporting
export function useComponentErrorHandler(
	componentName: string,
	context: DashboardError["context"] = "component",
) {
	const { actions } = useDashboardErrorManager();

	const errorHandling = useErrorHandling({
		onError: (error) => {
			actions.reportError(error, context, componentName);
		},
	});

	const handleErrorWithRetry = useCallback(
		async (operation: () => Promise<void>, _errorMessage?: string) => {
			try {
				await operation();
			} catch (error) {
				const errorId = actions.reportError(
					error as Error,
					context,
					componentName,
				);

				// Return error ID for potential retry
				throw { ...error, errorId };
			}
		},
		[actions, context, componentName],
	);

	return {
		...errorHandling,
		handleErrorWithRetry,
		reportError: (error: Error | ApolloError) =>
			actions.reportError(error, context, componentName),
	};
}

// Hook for view transition error handling
export function useViewTransitionErrorHandler() {
	const { actions, errorState } = useDashboardErrorManager();

	const handleTransitionError = useCallback(
		(
			error: Error,
			fromView: DashboardViewState["viewMode"],
			toView: DashboardViewState["viewMode"],
		) => {
			return actions.handleViewTransitionError(error, fromView, toView);
		},
		[actions],
	);

	const hasTransitionErrors = errorState.errors.some((error) =>
		error.componentName?.startsWith("ViewTransition:"),
	);

	return {
		handleTransitionError,
		hasTransitionErrors,
		isRecovering: errorState.isRecovering,
	};
}

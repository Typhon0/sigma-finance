import React, {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
} from "react";
import { usePerformanceMonitoring } from "@/hooks/use-performance-monitoring";

interface MonitoringContextType {
	sessionId: string;
	userId: string | null;
	recordDashboardEvent: (event: any) => void;
	recordErrorEvent: (errorData: any) => void;
	trackStateTransition: (fromState: string, toState: string) => void;
	trackDataLoad: (
		dataType: string,
		startTime: number,
		success: boolean,
		error?: Error,
	) => void;
	trackUserInteraction: (
		action: string,
		component: string,
		additionalData?: any,
	) => void;
	trackMarketDataUpdate: (
		source: string,
		assetCount: number,
		duration: number,
		success: boolean,
	) => void;
	setUserIdForTracking: (id: string) => void;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

interface MonitoringProviderProps {
	children: ReactNode;
}

export function MonitoringProvider({ children }: MonitoringProviderProps) {
	const monitoring = usePerformanceMonitoring();

	// Set up global error handlers
	useEffect(() => {
		const handleUnhandledError = (event: ErrorEvent) => {
			monitoring.recordErrorEvent({
				error_type: "unhandled_error",
				message: event.message,
				filename: event.filename,
				line: event.lineno,
				column: event.colno,
				stack: event.error?.stack,
				component: "global",
				severity: "error",
			});
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			monitoring.recordErrorEvent({
				error_type: "unhandled_promise_rejection",
				reason: event.reason?.toString(),
				stack: event.reason?.stack,
				component: "global",
				severity: "error",
			});
		};

		// Set up performance observer for Core Web Vitals
		if ("PerformanceObserver" in window) {
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.entryType === "largest-contentful-paint") {
						monitoring.recordDashboardEvent({
							type: "performance_metric",
							data: {
								metric_name: "largest_contentful_paint",
								value: entry.startTime,
								component: "core_web_vitals",
							},
						});
					} else if (entry.entryType === "first-input") {
						const fidEntry = entry as PerformanceEventTiming;
						monitoring.recordDashboardEvent({
							type: "performance_metric",
							data: {
								metric_name: "first_input_delay",
								value: fidEntry.processingStart - fidEntry.startTime,
								component: "core_web_vitals",
							},
						});
					} else if (entry.entryType === "layout-shift") {
						const clsEntry = entry as any;
						if (!clsEntry.hadRecentInput) {
							monitoring.recordDashboardEvent({
								type: "performance_metric",
								data: {
									metric_name: "cumulative_layout_shift",
									value: clsEntry.value,
									component: "core_web_vitals",
								},
							});
						}
					}
				}
			});

			observer.observe({
				entryTypes: ["largest-contentful-paint", "first-input", "layout-shift"],
			});

			return () => {
				observer.disconnect();
				window.removeEventListener("error", handleUnhandledError);
				window.removeEventListener(
					"unhandledrejection",
					handleUnhandledRejection,
				);
			};
		}

		window.addEventListener("error", handleUnhandledError);
		window.addEventListener("unhandledrejection", handleUnhandledRejection);

		return () => {
			window.removeEventListener("error", handleUnhandledError);
			window.removeEventListener(
				"unhandledrejection",
				handleUnhandledRejection,
			);
		};
	}, [monitoring]);

	// Track page visibility changes
	useEffect(() => {
		const handleVisibilityChange = () => {
			monitoring.recordDashboardEvent({
				type: "user_interaction",
				data: {
					action: document.hidden ? "page_hidden" : "page_visible",
					component: "document",
					timestamp: Date.now(),
				},
			});
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, [monitoring]);

	// Track network status changes
	useEffect(() => {
		const handleOnline = () => {
			monitoring.recordDashboardEvent({
				type: "user_interaction",
				data: {
					action: "network_online",
					component: "network",
					timestamp: Date.now(),
				},
			});
		};

		const handleOffline = () => {
			monitoring.recordDashboardEvent({
				type: "user_interaction",
				data: {
					action: "network_offline",
					component: "network",
					timestamp: Date.now(),
				},
			});
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [monitoring]);

	return (
		<MonitoringContext.Provider value={monitoring}>
			{children}
		</MonitoringContext.Provider>
	);
}

export function useMonitoring() {
	const context = useContext(MonitoringContext);
	if (!context) {
		throw new Error("useMonitoring must be used within a MonitoringProvider");
	}
	return context;
}

// Higher-order component for automatic component monitoring
export function withMonitoring<P extends object>(
	WrappedComponent: React.ComponentType<P>,
	componentName: string,
) {
	return function MonitoredComponent(props: P) {
		const { trackUserInteraction, recordErrorEvent } = useMonitoring();
		const mountTime = React.useRef(Date.now());

		// Track component mount
		useEffect(() => {
			trackUserInteraction("component_mount", componentName, {
				mount_time: Date.now() - mountTime.current,
			});

			return () => {
				trackUserInteraction("component_unmount", componentName, {
					session_duration: Date.now() - mountTime.current,
				});
			};
		}, [trackUserInteraction]);

		// Error boundary for the component
		const ErrorBoundary = ({ children }: { children: ReactNode }) => {
			useEffect(() => {
				const _handleError = (error: Error, errorInfo: any) => {
					recordErrorEvent({
						error_type: "component_error",
						component: componentName,
						message: error.message,
						stack: error.stack,
						component_stack: errorInfo.componentStack,
						severity: "error",
					});
				};

				// This is a simplified error boundary - in a real implementation,
				// you'd use React's error boundary pattern
				return () => {};
			}, []);

			return <>{children}</>;
		};

		return (
			<ErrorBoundary>
				<WrappedComponent {...props} />
			</ErrorBoundary>
		);
	};
}

// Hook for tracking specific user actions
export function useActionTracking() {
	const { trackUserInteraction } = useMonitoring();

	const trackClick = (elementId: string, additionalData?: any) => {
		trackUserInteraction("click", elementId, {
			timestamp: Date.now(),
			...additionalData,
		});
	};

	const trackFormSubmit = (
		formName: string,
		success: boolean,
		additionalData?: any,
	) => {
		trackUserInteraction("form_submit", formName, {
			success,
			timestamp: Date.now(),
			...additionalData,
		});
	};

	const trackNavigation = (
		from: string,
		to: string,
		method: string = "click",
	) => {
		trackUserInteraction("navigation", "router", {
			from,
			to,
			method,
			timestamp: Date.now(),
		});
	};

	const trackSearch = (
		query: string,
		resultsCount: number,
		component: string,
	) => {
		trackUserInteraction("search", component, {
			query: query.length > 50 ? `${query.substring(0, 50)}...` : query, // Truncate long queries
			results_count: resultsCount,
			timestamp: Date.now(),
		});
	};

	const trackFilter = (
		filterType: string,
		filterValue: string,
		component: string,
	) => {
		trackUserInteraction("filter", component, {
			filter_type: filterType,
			filter_value: filterValue,
			timestamp: Date.now(),
		});
	};

	return {
		trackClick,
		trackFormSubmit,
		trackNavigation,
		trackSearch,
		trackFilter,
	};
}

// Hook for tracking data loading operations
export function useDataLoadTracking() {
	const { trackDataLoad } = useMonitoring();

	const trackAsyncOperation = async <T,>(
		operation: () => Promise<T>,
		operationType: string,
		_additionalData?: any,
	): Promise<T> => {
		const startTime = Date.now();
		try {
			const result = await operation();
			trackDataLoad(operationType, startTime, true);
			return result;
		} catch (error) {
			trackDataLoad(operationType, startTime, false, error as Error);
			throw error;
		}
	};

	return {
		trackAsyncOperation,
	};
}

// Hook for tracking dashboard state changes
export function useDashboardStateTracking() {
	const { trackStateTransition } = useMonitoring();
	const currentState = React.useRef<string>("initial");

	const transitionTo = (newState: string) => {
		const previousState = currentState.current;
		trackStateTransition(previousState, newState);
		currentState.current = newState;
	};

	return {
		currentState: currentState.current,
		transitionTo,
	};
}

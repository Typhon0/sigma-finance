import { gql, useMutation, useQuery, useSubscription } from "@apollo/client";
import { useCallback, useEffect, useRef, useState } from "react";

// GraphQL queries and mutations
const GET_PERFORMANCE_METRICS = gql`
  query GetPerformanceMetrics($timeRange: String) {
    performanceMetrics(timeRange: $timeRange) {
      dashboardStateTransitions {
        total
        average
        min
        max
        p50
        p95
        p99
        lastHour
        lastDay
        breakdown
      }
      dataLoadTimes {
        total
        average
        min
        max
        p50
        p95
        p99
        lastHour
        lastDay
        breakdown
      }
      userInteractions {
        total
        average
        lastHour
        lastDay
        breakdown
      }
      errorRates {
        total
        average
        lastHour
        lastDay
        breakdown
      }
      marketDataUpdates {
        total
        average
        lastHour
        lastDay
        breakdown
      }
    }
  }
`;

const GET_SYSTEM_HEALTH = gql`
  query GetSystemHealth {
    systemHealth {
      status
      timestamp
      metricsCount
      alertsCount
      recentErrors
      details
    }
  }
`;

const GET_USER_ENGAGEMENT = gql`
  query GetUserEngagementMetrics($timeRange: String) {
    userEngagementMetrics(timeRange: $timeRange) {
      totalUsers
      activeUsers
      avgSessionDuration
      topFeatures {
        feature
        usageCount
        uniqueUsers
        avgDuration
      }
      navigationPatterns {
        pattern
        count
        avgDuration
        conversion
      }
      deviceBreakdown
      errorsByComponent
    }
  }
`;

const RECORD_DASHBOARD_EVENT = gql`
  mutation RecordDashboardEvent($input: DashboardEventInput!) {
    recordDashboardEvent(input: $input)
  }
`;

const PERFORMANCE_METRICS_SUBSCRIPTION = gql`
  subscription PerformanceMetricsUpdated {
    performanceMetricsUpdated {
      dashboardStateTransitions {
        total
        average
        p95
        lastHour
      }
      dataLoadTimes {
        average
        p95
        lastHour
      }
      errorRates {
        total
        lastHour
      }
    }
  }
`;

// Types
interface PerformanceMetrics {
	dashboardStateTransitions?: MetricSummary;
	dataLoadTimes?: MetricSummary;
	userInteractions?: MetricSummary;
	errorRates?: MetricSummary;
	marketDataUpdates?: MetricSummary;
}

interface MetricSummary {
	total: number;
	average: number;
	min: number;
	max: number;
	p50: number;
	p95: number;
	p99: number;
	lastHour: number;
	lastDay: number;
	breakdown: Record<string, number>;
}

interface SystemHealth {
	status: string;
	timestamp: string;
	metricsCount: number;
	alertsCount: number;
	recentErrors: number;
	details: Record<string, unknown>;
}

interface UserEngagementMetrics {
	totalUsers: number;
	activeUsers: number;
	avgSessionDuration: number;
	topFeatures: FeatureUsage[];
	navigationPatterns: NavigationPattern[];
	deviceBreakdown: Record<string, number>;
	errorsByComponent: Record<string, number>;
}

interface FeatureUsage {
	feature: string;
	usageCount: number;
	uniqueUsers: number;
	avgDuration: number;
}

interface NavigationPattern {
	pattern: string;
	count: number;
	avgDuration: number;
	conversion: number;
}

export interface DashboardEvent {
	type: string;
	userId?: string;
	sessionId?: string;
	data: Record<string, unknown>;
}

// Performance monitoring hook
export function usePerformanceMonitoring() {
	const [sessionId] = useState(
		() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
	);
	const [userId, setUserId] = useState<string | null>(null);
	const performanceObserver = useRef<PerformanceObserver | null>(null);
	const _navigationStartTime = useRef<number>(Date.now());
	const stateTransitionTimes = useRef<Map<string, number>>(new Map());

	const [recordEvent] = useMutation(RECORD_DASHBOARD_EVENT);

	// Record dashboard event
	const recordDashboardEvent = useCallback(
		async (event: Omit<DashboardEvent, "sessionId">) => {
			try {
				await recordEvent({
					variables: {
						input: {
							...event,
							userId: userId || undefined,
							sessionId,
						},
					},
				});
			} catch (_error) {}
		},
		[recordEvent, userId, sessionId],
	);

	// Record error event
	const recordErrorEvent = useCallback(
		(errorData: Record<string, unknown>) => {
			recordDashboardEvent({
				type: "error_occurred",
				data: {
					...errorData,
					component: "dashboard",
					severity: "error",
					timestamp: Date.now(),
				},
			});
		},
		[recordDashboardEvent],
	);

	// Handle performance entries
	const handlePerformanceEntry = useCallback(
		(entry: PerformanceEntry) => {
			const eventData: Record<string, unknown> = {
				entry_type: entry.entryType,
				name: entry.name,
				start_time: entry.startTime,
				duration: entry.duration,
			};

			// Add specific data based on entry type
			if (entry.entryType === "navigation") {
				const navEntry = entry as PerformanceNavigationTiming;
				eventData.dom_content_loaded =
					navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart;
				eventData.load_complete = navEntry.loadEventEnd - navEntry.loadEventStart;
				eventData.dns_lookup = navEntry.domainLookupEnd - navEntry.domainLookupStart;
				eventData.tcp_connect = navEntry.connectEnd - navEntry.connectStart;
			} else if (entry.entryType === "paint") {
				eventData.paint_type = entry.name;
			} else if (entry.entryType === "largest-contentful-paint") {
				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				eventData.element = (entry as any).element?.tagName;
				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				eventData.size = (entry as any).size;
			}

			recordDashboardEvent({
				type: "performance_metric",
				data: {
					metric_name: entry.entryType,
					value: entry.duration || entry.startTime,
					component: "browser_performance",
					...eventData,
				},
			});
		},
		[recordDashboardEvent],
	);

	// Initialize performance monitoring
	useEffect(() => {
		// Set up Performance Observer for web vitals
		if ("PerformanceObserver" in window) {
			performanceObserver.current = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					handlePerformanceEntry(entry);
				}
			});

			performanceObserver.current.observe({
				entryTypes: [
					"navigation",
					"paint",
					"largest-contentful-paint",
					"first-input",
					"layout-shift",
				],
			});
		}

		// Set up error tracking
		const handleError = (event: ErrorEvent) => {
			recordErrorEvent({
				error_type: "javascript_error",
				message: event.message,
				filename: event.filename,
				line: event.lineno,
				column: event.colno,
				stack: event.error?.stack,
			});
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			recordErrorEvent({
				error_type: "unhandled_promise_rejection",
				reason: event.reason?.toString(),
				stack: event.reason?.stack,
			});
		};

		window.addEventListener("error", handleError);
		window.addEventListener("unhandledrejection", handleUnhandledRejection);

		return () => {
			performanceObserver.current?.disconnect();
			window.removeEventListener("error", handleError);
			window.removeEventListener("unhandledrejection", handleUnhandledRejection);
		};
	}, [handlePerformanceEntry, recordErrorEvent]);

	// Track dashboard state transitions
	const trackStateTransition = useCallback(
		(fromState: string, toState: string) => {
			const transitionKey = `${fromState}->${toState}`;
			const startTime = stateTransitionTimes.current.get(fromState) || Date.now();
			const duration = Date.now() - startTime;

			recordDashboardEvent({
				type: "dashboard_state_transition",
				data: {
					from_state: fromState,
					to_state: toState,
					duration: duration / 1000, // Convert to seconds
					transition_key: transitionKey,
				},
			});

			stateTransitionTimes.current.set(toState, Date.now());
		},
		[recordDashboardEvent],
	);

	// Track data loading
	const trackDataLoad = useCallback(
		(dataType: string, startTime: number, success: boolean, error?: Error) => {
			const duration = (Date.now() - startTime) / 1000; // Convert to seconds

			recordDashboardEvent({
				type: "dashboard_data_load",
				data: {
					data_type: dataType,
					duration,
					success,
					error_message: error?.message,
					error_stack: error?.stack,
				},
			});
		},
		[recordDashboardEvent],
	);

	// Track user interactions
	const trackUserInteraction = useCallback(
		(action: string, component: string, additionalData?: Record<string, unknown>) => {
			recordDashboardEvent({
				type: "user_interaction",
				data: {
					action,
					component,
					timestamp: Date.now(),
					...additionalData,
				},
			});
		},
		[recordDashboardEvent],
	);

	// Track market data updates
	const trackMarketDataUpdate = useCallback(
		(source: string, assetCount: number, duration: number, success: boolean) => {
			recordDashboardEvent({
				type: "market_data_update",
				data: {
					source,
					asset_count: assetCount,
					duration: duration / 1000, // Convert to seconds
					success,
				},
			});
		},
		[recordDashboardEvent],
	);

	// Set user ID for tracking
	const setUserIdForTracking = useCallback((id: string) => {
		setUserId(id);
	}, []);

	return {
		sessionId,
		userId,
		recordDashboardEvent,
		recordErrorEvent,
		trackStateTransition,
		trackDataLoad,
		trackUserInteraction,
		trackMarketDataUpdate,
		setUserIdForTracking,
	};
}

// Hook for fetching performance metrics
export function usePerformanceMetrics(timeRange?: string) {
	const { data, loading, error, refetch } = useQuery(GET_PERFORMANCE_METRICS, {
		variables: { timeRange },
		pollInterval: 30000, // Poll every 30 seconds
	});

	return {
		metrics: data?.performanceMetrics as PerformanceMetrics | undefined,
		loading,
		error,
		refetch,
	};
}

// Hook for system health monitoring
export function useSystemHealth() {
	const { data, loading, error } = useQuery(GET_SYSTEM_HEALTH, {
		pollInterval: 15000, // Poll every 15 seconds
	});

	return {
		health: data?.systemHealth as SystemHealth | undefined,
		loading,
		error,
	};
}

// Hook for user engagement metrics
export function useUserEngagementMetrics(timeRange?: string) {
	const { data, loading, error } = useQuery(GET_USER_ENGAGEMENT, {
		variables: { timeRange },
		pollInterval: 60000, // Poll every minute
	});

	return {
		engagement: data?.userEngagementMetrics as UserEngagementMetrics | undefined,
		loading,
		error,
	};
}

// Hook for real-time performance monitoring
export function useRealTimePerformanceMonitoring() {
	const { data: subscriptionData } = useSubscription(PERFORMANCE_METRICS_SUBSCRIPTION);
	const [realtimeMetrics, setRealtimeMetrics] = useState<PerformanceMetrics | null>(null);

	useEffect(() => {
		if (subscriptionData?.performanceMetricsUpdated) {
			setRealtimeMetrics(subscriptionData.performanceMetricsUpdated);
		}
	}, [subscriptionData]);

	return {
		realtimeMetrics,
	};
}

// Utility function to measure component render time
export function useMeasureRenderTime(componentName: string) {
	const { trackUserInteraction } = usePerformanceMonitoring();
	const renderStartTime = useRef<number>(Date.now());

	useEffect(() => {
		renderStartTime.current = Date.now();
	});

	useEffect(() => {
		const renderTime = Date.now() - renderStartTime.current;
		trackUserInteraction("component_render", componentName, {
			render_time: renderTime,
		});
	});

	return renderStartTime.current;
}

// Utility function to measure async operation time
export function useMeasureAsyncOperation() {
	const { trackDataLoad } = usePerformanceMonitoring();

	return useCallback(
		async <T>(operation: () => Promise<T>, operationType: string): Promise<T> => {
			const startTime = Date.now();
			try {
				const result = await operation();
				trackDataLoad(operationType, startTime, true);
				return result;
			} catch (error) {
				trackDataLoad(operationType, startTime, false, error as Error);
				throw error;
			}
		},
		[trackDataLoad],
	);
}

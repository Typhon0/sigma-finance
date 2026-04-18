import { useCallback, useEffect, useRef } from "react";
import {
	useActionTracking,
	useDashboardStateTracking,
	useMonitoring,
} from "@/components/monitoring/monitoring-provider";

// Dashboard view states
export type DashboardViewMode =
	| "overview"
	| "portfolio-detail"
	| "asset-detail";

interface DashboardState {
	viewMode: DashboardViewMode;
	selectedPortfolio: string | null;
	selectedAsset: string | null;
}

interface PerformanceMetrics {
	renderTime: number;
	dataLoadTime: number;
	interactionLatency: number;
	memoryUsage?: number;
}

// Hook for comprehensive dashboard monitoring
export function useDashboardMonitoring() {
	const monitoring = useMonitoring();
	const { transitionTo } = useDashboardStateTracking();
	const { trackClick, trackNavigation } = useActionTracking();

	const currentState = useRef<DashboardState>({
		viewMode: "overview",
		selectedPortfolio: null,
		selectedAsset: null,
	});

	const performanceMetrics = useRef<PerformanceMetrics>({
		renderTime: 0,
		dataLoadTime: 0,
		interactionLatency: 0,
	});

	const interactionStartTime = useRef<number>(0);
	const renderStartTime = useRef<number>(0);

	// Track dashboard state changes
	const trackDashboardStateChange = useCallback(
		(newState: Partial<DashboardState>) => {
			const previousState = { ...currentState.current };
			const updatedState = { ...currentState.current, ...newState };

			// Record state transition
			const transitionKey = `${previousState.viewMode}->${updatedState.viewMode}`;
			transitionTo(updatedState.viewMode);

			// Track specific transition metrics
			monitoring.recordDashboardEvent({
				type: "dashboard_state_transition",
				data: {
					from_state: previousState.viewMode,
					to_state: updatedState.viewMode,
					from_portfolio: previousState.selectedPortfolio,
					to_portfolio: updatedState.selectedPortfolio,
					from_asset: previousState.selectedAsset,
					to_asset: updatedState.selectedAsset,
					transition_key: transitionKey,
					duration: Date.now() - interactionStartTime.current,
				},
			});

			currentState.current = updatedState;
		},
		[monitoring, transitionTo],
	);

	// Track portfolio selection
	const trackPortfolioSelection = useCallback(
		(portfolioId: string, method: "click" | "navigation" = "click") => {
			interactionStartTime.current = Date.now();

			trackClick("portfolio-card", {
				portfolio_id: portfolioId,
				method,
				previous_state: currentState.current.viewMode,
			});

			trackDashboardStateChange({
				viewMode: "portfolio-detail",
				selectedPortfolio: portfolioId,
				selectedAsset: null,
			});
		},
		[trackClick, trackDashboardStateChange],
	);

	// Track asset selection
	const trackAssetSelection = useCallback(
		(
			assetId: string,
			portfolioId: string,
			method: "click" | "navigation" = "click",
		) => {
			interactionStartTime.current = Date.now();

			trackClick("asset-card", {
				asset_id: assetId,
				portfolio_id: portfolioId,
				method,
				previous_state: currentState.current.viewMode,
			});

			trackDashboardStateChange({
				viewMode: "asset-detail",
				selectedPortfolio: portfolioId,
				selectedAsset: assetId,
			});
		},
		[trackClick, trackDashboardStateChange],
	);

	// Track return to overview
	const trackReturnToOverview = useCallback(
		(method: "breadcrumb" | "back-button" | "navigation" = "breadcrumb") => {
			interactionStartTime.current = Date.now();

			trackNavigation(currentState.current.viewMode, "overview", method);

			trackDashboardStateChange({
				viewMode: "overview",
				selectedPortfolio: null,
				selectedAsset: null,
			});
		},
		[trackNavigation, trackDashboardStateChange],
	);

	// Track data loading operations
	const trackDataLoading = useCallback(
		async <T>(
			operation: () => Promise<T>,
			dataType: string,
			context?: Record<string, any>,
		): Promise<T> => {
			const startTime = Date.now();

			try {
				const result = await operation();
				const duration = Date.now() - startTime;

				performanceMetrics.current.dataLoadTime = duration;

				monitoring.trackDataLoad(dataType, startTime, true);

				// Record detailed data loading metrics
				monitoring.recordDashboardEvent({
					type: "dashboard_data_load",
					data: {
						data_type: dataType,
						duration: duration / 1000,
						success: true,
						context: context || {},
						view_mode: currentState.current.viewMode,
						portfolio_id: currentState.current.selectedPortfolio,
						asset_id: currentState.current.selectedAsset,
					},
				});

				return result;
			} catch (error) {
				const duration = Date.now() - startTime;

				monitoring.trackDataLoad(dataType, startTime, false, error as Error);

				// Record error details
				monitoring.recordDashboardEvent({
					type: "dashboard_data_load",
					data: {
						data_type: dataType,
						duration: duration / 1000,
						success: false,
						error_message: (error as Error).message,
						error_stack: (error as Error).stack,
						context: context || {},
						view_mode: currentState.current.viewMode,
					},
				});

				throw error;
			}
		},
		[monitoring],
	);

	// Track component render performance
	const trackComponentRender = useCallback(
		(componentName: string, renderTime?: number) => {
			const actualRenderTime =
				renderTime || Date.now() - renderStartTime.current;

			performanceMetrics.current.renderTime = actualRenderTime;

			monitoring.recordDashboardEvent({
				type: "performance_metric",
				data: {
					metric_name: "component_render_time",
					value: actualRenderTime,
					component: componentName,
					view_mode: currentState.current.viewMode,
					portfolio_id: currentState.current.selectedPortfolio,
					asset_id: currentState.current.selectedAsset,
				},
			});
		},
		[monitoring],
	);

	// Track user interactions with timing
	const trackInteraction = useCallback(
		(
			action: string,
			component: string,
			additionalData?: Record<string, any>,
		) => {
			const interactionTime = Date.now() - interactionStartTime.current;

			performanceMetrics.current.interactionLatency = interactionTime;

			monitoring.trackUserInteraction(action, component, {
				interaction_latency: interactionTime,
				view_mode: currentState.current.viewMode,
				portfolio_id: currentState.current.selectedPortfolio,
				asset_id: currentState.current.selectedAsset,
				...additionalData,
			});

			interactionStartTime.current = Date.now();
		},
		[monitoring],
	);

	// Track chart interactions
	const trackChartInteraction = useCallback(
		(
			chartType: string,
			action: string,
			additionalData?: Record<string, any>,
		) => {
			trackInteraction(`chart_${action}`, `${chartType}_chart`, {
				chart_type: chartType,
				...additionalData,
			});
		},
		[trackInteraction],
	);

	// Track form interactions
	const trackFormInteraction = useCallback(
		(
			formName: string,
			action: string,
			success?: boolean,
			additionalData?: Record<string, any>,
		) => {
			trackInteraction(`form_${action}`, formName, {
				success,
				...additionalData,
			});
		},
		[trackInteraction],
	);

	// Track search and filter operations
	const trackSearchFilter = useCallback(
		(
			type: "search" | "filter",
			query: string,
			resultsCount?: number,
			component?: string,
		) => {
			trackInteraction(type, component || "dashboard", {
				query: query.length > 100 ? `${query.substring(0, 100)}...` : query,
				results_count: resultsCount,
				query_length: query.length,
			});
		},
		[trackInteraction],
	);

	// Track error occurrences
	const trackError = useCallback(
		(error: Error, component: string, context?: Record<string, any>) => {
			monitoring.recordErrorEvent({
				error_type: "dashboard_error",
				component,
				message: error.message,
				stack: error.stack,
				severity: "error",
				view_mode: currentState.current.viewMode,
				portfolio_id: currentState.current.selectedPortfolio,
				asset_id: currentState.current.selectedAsset,
				context: context || {},
			});
		},
		[monitoring],
	);

	// Track performance bottlenecks
	const trackPerformanceBottleneck = useCallback(
		(
			bottleneckType: string,
			duration: number,
			component: string,
			details?: Record<string, any>,
		) => {
			monitoring.recordDashboardEvent({
				type: "performance_bottleneck",
				data: {
					bottleneck_type: bottleneckType,
					duration: duration / 1000,
					component,
					view_mode: currentState.current.viewMode,
					details: details || {},
				},
			});
		},
		[monitoring],
	);

	// Track memory usage (if available)
	const trackMemoryUsage = useCallback(() => {
		if ("memory" in performance) {
			const memInfo = (performance as any).memory;
			const memoryUsage = {
				used: memInfo.usedJSHeapSize,
				total: memInfo.totalJSHeapSize,
				limit: memInfo.jsHeapSizeLimit,
			};

			performanceMetrics.current.memoryUsage = memInfo.usedJSHeapSize;

			monitoring.recordDashboardEvent({
				type: "performance_metric",
				data: {
					metric_name: "memory_usage",
					value: memInfo.usedJSHeapSize,
					component: "dashboard",
					memory_info: memoryUsage,
					view_mode: currentState.current.viewMode,
				},
			});
		}
	}, [monitoring]);

	// Set up automatic performance monitoring
	useEffect(() => {
		renderStartTime.current = Date.now();
		interactionStartTime.current = Date.now();

		// Track memory usage periodically
		const memoryInterval = setInterval(trackMemoryUsage, 30000); // Every 30 seconds

		// Track page visibility changes
		const handleVisibilityChange = () => {
			monitoring.recordDashboardEvent({
				type: "user_interaction",
				data: {
					action: document.hidden ? "dashboard_hidden" : "dashboard_visible",
					component: "dashboard",
					view_mode: currentState.current.viewMode,
					timestamp: Date.now(),
				},
			});
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			clearInterval(memoryInterval);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [monitoring, trackMemoryUsage]);

	// Get current performance metrics
	const getCurrentMetrics = useCallback(
		() => ({
			...performanceMetrics.current,
			currentState: { ...currentState.current },
		}),
		[],
	);

	return {
		// State tracking
		trackDashboardStateChange,
		trackPortfolioSelection,
		trackAssetSelection,
		trackReturnToOverview,

		// Data operations
		trackDataLoading,

		// Performance tracking
		trackComponentRender,
		trackInteraction,
		trackChartInteraction,
		trackFormInteraction,
		trackSearchFilter,

		// Error tracking
		trackError,
		trackPerformanceBottleneck,

		// Memory tracking
		trackMemoryUsage,

		// Utilities
		getCurrentMetrics,
		currentState: currentState.current,
		performanceMetrics: performanceMetrics.current,
	};
}

// Hook for monitoring specific dashboard components
export function useComponentMonitoring(componentName: string) {
	const { trackComponentRender, trackError, trackInteraction } =
		useDashboardMonitoring();
	const mountTime = useRef(Date.now());
	const renderCount = useRef(0);

	useEffect(() => {
		renderCount.current++;
		const renderTime = Date.now() - mountTime.current;

		trackComponentRender(componentName, renderTime);

		return () => {
			// Track component unmount
			trackInteraction("component_unmount", componentName, {
				total_renders: renderCount.current,
				lifetime: Date.now() - mountTime.current,
			});
		};
	});

	const trackComponentError = useCallback(
		(error: Error, context?: Record<string, any>) => {
			trackError(error, componentName, {
				render_count: renderCount.current,
				component_lifetime: Date.now() - mountTime.current,
				...context,
			});
		},
		[trackError, componentName],
	);

	const trackComponentInteraction = useCallback(
		(action: string, additionalData?: Record<string, any>) => {
			trackInteraction(action, componentName, additionalData);
		},
		[trackInteraction, componentName],
	);

	return {
		trackComponentError,
		trackComponentInteraction,
		renderCount: renderCount.current,
		componentLifetime: Date.now() - mountTime.current,
	};
}

// Hook for monitoring chart performance specifically
export function useChartMonitoring(chartType: string) {
	const { trackChartInteraction, trackError, trackPerformanceBottleneck } =
		useDashboardMonitoring();
	const chartRenderTime = useRef<number>(0);
	const dataPoints = useRef<number>(0);

	const trackChartRender = useCallback(
		(renderTime: number, dataPointCount: number) => {
			chartRenderTime.current = renderTime;
			dataPoints.current = dataPointCount;

			trackChartInteraction(chartType, "render", {
				render_time: renderTime,
				data_points: dataPointCount,
				performance_ratio: dataPointCount / renderTime, // points per ms
			});

			// Track performance bottleneck if render time is too high
			if (renderTime > 1000) {
				// More than 1 second
				trackPerformanceBottleneck(
					"slow_chart_render",
					renderTime,
					`${chartType}_chart`,
					{
						data_points: dataPointCount,
					},
				);
			}
		},
		[trackChartInteraction, trackPerformanceBottleneck, chartType],
	);

	const trackChartError = useCallback(
		(error: Error, context?: Record<string, any>) => {
			trackError(error, `${chartType}_chart`, {
				data_points: dataPoints.current,
				last_render_time: chartRenderTime.current,
				...context,
			});
		},
		[trackError, chartType],
	);

	const trackChartDataUpdate = useCallback(
		(updateTime: number, newDataPointCount: number) => {
			trackChartInteraction(chartType, "data_update", {
				update_time: updateTime,
				new_data_points: newDataPointCount,
				previous_data_points: dataPoints.current,
			});

			dataPoints.current = newDataPointCount;
		},
		[trackChartInteraction, chartType],
	);

	return {
		trackChartRender,
		trackChartError,
		trackChartDataUpdate,
		chartMetrics: {
			lastRenderTime: chartRenderTime.current,
			dataPoints: dataPoints.current,
		},
	};
}

/**
 * Optimized dashboard state management with performance enhancements
 */

import { debounce, throttle } from "lodash-es";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

export interface Portfolio {
	id: string;
	name: string;
	totalValue: number;
	assets: Asset[];
	// ... other portfolio properties
}

export interface Asset {
	id: string;
	name: string;
	symbol?: string;
	value: number;
	portfolioWeight: number;
	dividendYield?: number;
	peRatio?: number;
	sparklineData: number[];
	// ... other asset properties
}

export interface TargetAllocation {
	sector: string;
	targetPercentage: number;
}

export interface BreadcrumbItem {
	title: string;
	href?: string;
	onClick?: () => void;
}

export type ViewMode = "overview" | "portfolio-detail" | "asset-detail";

export interface DashboardState {
	viewMode: ViewMode;
	selectedPortfolio: Portfolio | null;
	selectedAsset: Asset | null;
	breadcrumbPath: BreadcrumbItem[];

	// Performance optimization fields
	lastUpdate: number;
	transitionInProgress: boolean;
	preloadedData: Map<string, any>;
	stateHistory: DashboardState[];
	maxHistorySize: number;
}

export type DashboardAction =
	| { type: "VIEW_PORTFOLIO"; payload: Portfolio }
	| { type: "VIEW_ASSET"; payload: { asset: Asset; portfolio: Portfolio } }
	| { type: "BACK_TO_OVERVIEW" }
	| { type: "BACK_TO_PORTFOLIO"; payload: Portfolio }
	| { type: "START_TRANSITION" }
	| { type: "END_TRANSITION" }
	| { type: "PRELOAD_DATA"; payload: { key: string; data: any } }
	| { type: "CLEAR_PRELOADED_DATA" }
	| { type: "UPDATE_PORTFOLIO"; payload: Portfolio }
	| { type: "UPDATE_ASSET"; payload: Asset };

// Memoized breadcrumb generators
const createOverviewBreadcrumb = (): BreadcrumbItem[] => [{ title: "Dashboard" }];

const createPortfolioBreadcrumb = (portfolio: Portfolio, onBack: () => void): BreadcrumbItem[] => [
	{ title: "Dashboard", onClick: onBack },
	{ title: portfolio.name },
];

const createAssetBreadcrumb = (
	asset: Asset,
	portfolio: Portfolio,
	onBackToOverview: () => void,
	onBackToPortfolio: () => void,
): BreadcrumbItem[] => [
	{ title: "Dashboard", onClick: onBackToOverview },
	{ title: portfolio.name, onClick: onBackToPortfolio },
	{ title: asset.name },
];

// Optimized reducer with memoization
function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
	const now = Date.now();

	// Prevent unnecessary updates if state hasn't changed
	if (action.type !== "START_TRANSITION" && action.type !== "END_TRANSITION") {
		if (now - state.lastUpdate < 16) {
			// 60fps throttling
			return state;
		}
	}

	const newState = (() => {
		switch (action.type) {
			case "VIEW_PORTFOLIO": {
				const portfolio = action.payload;
				return {
					...state,
					viewMode: "portfolio-detail" as const,
					selectedPortfolio: portfolio,
					selectedAsset: null,
					breadcrumbPath: createPortfolioBreadcrumb(portfolio, () => {}), // Will be updated with actual callback
					lastUpdate: now,
				};
			}

			case "VIEW_ASSET": {
				const { asset, portfolio } = action.payload;
				return {
					...state,
					viewMode: "asset-detail" as const,
					selectedPortfolio: portfolio,
					selectedAsset: asset,
					breadcrumbPath: createAssetBreadcrumb(
						asset,
						portfolio,
						() => {},
						() => {},
					), // Will be updated with actual callbacks
					lastUpdate: now,
				};
			}

			case "BACK_TO_OVERVIEW":
				return {
					...state,
					viewMode: "overview" as const,
					selectedPortfolio: null,
					selectedAsset: null,
					breadcrumbPath: createOverviewBreadcrumb(),
					lastUpdate: now,
				};

			case "BACK_TO_PORTFOLIO": {
				const portfolio = action.payload;
				return {
					...state,
					viewMode: "portfolio-detail" as const,
					selectedPortfolio: portfolio,
					selectedAsset: null,
					breadcrumbPath: createPortfolioBreadcrumb(portfolio, () => {}), // Will be updated with actual callback
					lastUpdate: now,
				};
			}

			case "START_TRANSITION":
				return {
					...state,
					transitionInProgress: true,
				};

			case "END_TRANSITION":
				return {
					...state,
					transitionInProgress: false,
				};

			case "PRELOAD_DATA": {
				const newPreloadedData = new Map(state.preloadedData);
				newPreloadedData.set(action.payload.key, action.payload.data);
				return {
					...state,
					preloadedData: newPreloadedData,
				};
			}

			case "CLEAR_PRELOADED_DATA":
				return {
					...state,
					preloadedData: new Map(),
				};

			case "UPDATE_PORTFOLIO": {
				const updatedPortfolio = action.payload;
				return {
					...state,
					selectedPortfolio:
						state.selectedPortfolio?.id === updatedPortfolio.id
							? updatedPortfolio
							: state.selectedPortfolio,
					lastUpdate: now,
				};
			}

			case "UPDATE_ASSET": {
				const updatedAsset = action.payload;
				return {
					...state,
					selectedAsset:
						state.selectedAsset?.id === updatedAsset.id ? updatedAsset : state.selectedAsset,
					lastUpdate: now,
				};
			}

			default:
				return state;
		}
	})();

	// Add to history for undo/redo functionality
	if (newState !== state) {
		const newHistory = [...state.stateHistory, state].slice(-state.maxHistorySize);
		return {
			...newState,
			stateHistory: newHistory,
		};
	}

	return newState;
}

// Initial state factory
function createInitialState(): DashboardState {
	return {
		viewMode: "overview",
		selectedPortfolio: null,
		selectedAsset: null,
		breadcrumbPath: createOverviewBreadcrumb(),
		lastUpdate: Date.now(),
		transitionInProgress: false,
		preloadedData: new Map(),
		stateHistory: [],
		maxHistorySize: 10,
	};
}

/**
 * Optimized dashboard state hook with performance enhancements
 */
export function useOptimizedDashboardState() {
	const [state, dispatch] = useReducer(dashboardReducer, null, createInitialState);

	// Refs for stable callbacks
	const stateRef = useRef(state);
	const dispatchRef = useRef(dispatch);

	// Update refs when state changes
	useEffect(() => {
		stateRef.current = state;
		dispatchRef.current = dispatch;
	}, [state]);

	// Throttled dispatch to prevent excessive updates
	const throttledDispatch = useMemo(
		() =>
			throttle((action: DashboardAction) => {
				dispatchRef.current(action);
			}, 16), // 60fps
		[],
	);

	// Debounced data preloading
	const debouncedPreloadData = useMemo(
		() =>
			debounce((key: string, data: any) => {
				throttledDispatch({ type: "PRELOAD_DATA", payload: { key, data } });
			}, 100),
		[throttledDispatch],
	);

	// Memoized action creators with performance optimizations
	const actions = useMemo(
		() => ({
			viewPortfolio: (portfolio: Portfolio) => {
				throttledDispatch({ type: "START_TRANSITION" });

				// Preload portfolio data
				debouncedPreloadData(`portfolio_${portfolio.id}`, portfolio);

				setTimeout(() => {
					throttledDispatch({ type: "VIEW_PORTFOLIO", payload: portfolio });
					throttledDispatch({ type: "END_TRANSITION" });
				}, 0);
			},

			viewAsset: (asset: Asset, portfolio: Portfolio) => {
				throttledDispatch({ type: "START_TRANSITION" });

				// Preload asset data
				debouncedPreloadData(`asset_${asset.id}`, asset);

				setTimeout(() => {
					throttledDispatch({
						type: "VIEW_ASSET",
						payload: { asset, portfolio },
					});
					throttledDispatch({ type: "END_TRANSITION" });
				}, 0);
			},

			backToOverview: () => {
				throttledDispatch({ type: "START_TRANSITION" });

				setTimeout(() => {
					throttledDispatch({ type: "BACK_TO_OVERVIEW" });
					throttledDispatch({ type: "END_TRANSITION" });
				}, 0);
			},

			backToPortfolio: (portfolio: Portfolio) => {
				throttledDispatch({ type: "START_TRANSITION" });

				setTimeout(() => {
					throttledDispatch({ type: "BACK_TO_PORTFOLIO", payload: portfolio });
					throttledDispatch({ type: "END_TRANSITION" });
				}, 0);
			},

			updatePortfolio: (portfolio: Portfolio) => {
				throttledDispatch({ type: "UPDATE_PORTFOLIO", payload: portfolio });
			},

			updateAsset: (asset: Asset) => {
				throttledDispatch({ type: "UPDATE_ASSET", payload: asset });
			},

			preloadData: (key: string, data: any) => {
				debouncedPreloadData(key, data);
			},

			clearPreloadedData: () => {
				throttledDispatch({ type: "CLEAR_PRELOADED_DATA" });
			},

			// Navigation history
			canGoBack: () => state.stateHistory.length > 0,

			goBack: () => {
				if (state.stateHistory.length > 0) {
					const _previousState = state.stateHistory[state.stateHistory.length - 1];
					// Restore previous state (simplified - would need more complex logic)
					throttledDispatch({ type: "BACK_TO_OVERVIEW" });
				}
			},
		}),
		[throttledDispatch, debouncedPreloadData, state.stateHistory],
	);

	// Memoized breadcrumb path with proper callbacks
	const breadcrumbPath = useMemo(() => {
		switch (state.viewMode) {
			case "overview":
				return createOverviewBreadcrumb();

			case "portfolio-detail":
				return state.selectedPortfolio
					? createPortfolioBreadcrumb(state.selectedPortfolio, actions.backToOverview)
					: createOverviewBreadcrumb();

			case "asset-detail":
				return state.selectedAsset && state.selectedPortfolio
					? createAssetBreadcrumb(
							state.selectedAsset,
							state.selectedPortfolio,
							actions.backToOverview,
							() => actions.backToPortfolio(state.selectedPortfolio!),
						)
					: createOverviewBreadcrumb();

			default:
				return createOverviewBreadcrumb();
		}
	}, [state.viewMode, state.selectedPortfolio, state.selectedAsset, actions]);

	// Enhanced state with computed properties
	const enhancedState = useMemo(
		() => ({
			...state,
			breadcrumbPath,

			// Performance metrics
			isTransitioning: state.transitionInProgress,
			hasPreloadedData: (key: string) => state.preloadedData.has(key),
			getPreloadedData: (key: string) => state.preloadedData.get(key),

			// Navigation helpers
			canNavigateBack: state.stateHistory.length > 0,
			currentPath: `/${state.viewMode}${state.selectedPortfolio ? `/${state.selectedPortfolio.id}` : ""}${state.selectedAsset ? `/${state.selectedAsset.id}` : ""}`,
		}),
		[state, breadcrumbPath],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			throttledDispatch.cancel();
			debouncedPreloadData.cancel();
		};
	}, [throttledDispatch, debouncedPreloadData]);

	return [enhancedState, actions] as const;
}

/**
 * Performance monitoring hook for dashboard state
 */
export function useDashboardPerformanceMonitor() {
	const renderCount = useRef(0);
	const lastRenderTime = useRef(Date.now());
	const renderTimes = useRef<number[]>([]);

	useEffect(() => {
		renderCount.current++;
		const now = Date.now();
		const renderTime = now - lastRenderTime.current;

		renderTimes.current.push(renderTime);
		if (renderTimes.current.length > 100) {
			renderTimes.current = renderTimes.current.slice(-50);
		}

		lastRenderTime.current = now;
	});

	const getPerformanceStats = useCallback(() => {
		const times = renderTimes.current;
		const avgRenderTime =
			times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;

		const maxRenderTime = times.length > 0 ? Math.max(...times) : 0;
		const minRenderTime = times.length > 0 ? Math.min(...times) : 0;

		return {
			renderCount: renderCount.current,
			avgRenderTime,
			maxRenderTime,
			minRenderTime,
			recentRenderTimes: times.slice(-10),
		};
	}, []);

	return {
		getPerformanceStats,
		renderCount: renderCount.current,
	};
}

/**
 * Context switching performance optimizer
 */
export function useContextSwitchingOptimizer() {
	const switchCount = useRef(0);
	const lastSwitchTime = useRef(Date.now());
	const switchTimes = useRef<number[]>([]);

	const recordContextSwitch = useCallback((_fromContext: string, _toContext: string) => {
		switchCount.current++;
		const now = Date.now();
		const switchTime = now - lastSwitchTime.current;

		switchTimes.current.push(switchTime);
		if (switchTimes.current.length > 50) {
			switchTimes.current = switchTimes.current.slice(-25);
		}

		lastSwitchTime.current = now;

		// Log slow context switches
		if (switchTime > 100) {
		}
	}, []);

	const getContextSwitchStats = useCallback(() => {
		const times = switchTimes.current;
		const avgSwitchTime =
			times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;

		return {
			switchCount: switchCount.current,
			avgSwitchTime,
			recentSwitchTimes: times.slice(-10),
		};
	}, []);

	return {
		recordContextSwitch,
		getContextSwitchStats,
	};
}

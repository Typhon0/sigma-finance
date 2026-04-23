import { createContext, type ReactNode, useContext, useEffect, useReducer } from "react";
import {
	useAlertNotifications,
	usePortfolioUpdates,
	usePriceUpdates,
	useWebSocket,
} from "@/hooks/useWebSocket";

export interface DashboardState {
	// Price data
	assetPrices: Map<
		string,
		{
			price: number;
			change: number;
			changePercent: number;
			timestamp: number;
		}
	>;

	// Portfolio data
	portfolioValues: Map<
		string,
		{
			totalValue: number;
			totalCost: number;
			gainLoss: number;
			gainLossPercent: number;
			timestamp: number;
		}
	>;

	// Alert data
	alerts: Array<{
		id: string;
		type: string;
		title: string;
		message: string;
		timestamp: number;
		acknowledged: boolean;
	}>;
	unreadAlertCount: number;

	// Connection state
	isConnected: boolean;
	isConnecting: boolean;
	connectionError: string | null;

	// UI state
	optimisticUpdates: Map<string, Record<string, unknown>>;
}

export interface PriceData {
	price: number;
	change: number;
	changePercent: number;
	timestamp: number;
}

export interface PortfolioData {
	totalValue: number;
	totalCost: number;
	gainLoss: number;
	gainLossPercent: number;
	timestamp: number;
}

export interface AlertData {
	id: string;
	type: string;
	title: string;
	message: string;
	timestamp: number;
	acknowledged: boolean;
}

type DashboardAction =
	| { type: "UPDATE_PRICE"; payload: { assetId: string; data: PriceData } }
	| { type: "UPDATE_PORTFOLIO"; payload: { portfolioId: string; data: PortfolioData } }
	| { type: "ADD_ALERT"; payload: AlertData }
	| { type: "ACKNOWLEDGE_ALERT"; payload: { alertId: string } }
	| {
			type: "SET_CONNECTION_STATE";
			payload: {
				connected: boolean;
				connecting: boolean;
				error: string | null;
			};
	  }
	| { type: "ADD_OPTIMISTIC_UPDATE"; payload: { key: string; data: Record<string, unknown> } }
	| { type: "REMOVE_OPTIMISTIC_UPDATE"; payload: { key: string } }
	| { type: "CLEAR_OPTIMISTIC_UPDATES" };

const initialState: DashboardState = {
	assetPrices: new Map(),
	portfolioValues: new Map(),
	alerts: [],
	unreadAlertCount: 0,
	isConnected: false,
	isConnecting: false,
	connectionError: null,
	optimisticUpdates: new Map(),
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
	switch (action.type) {
		case "UPDATE_PRICE":
			return {
				...state,
				assetPrices: new Map(state.assetPrices.set(action.payload.assetId, action.payload.data)),
			};

		case "UPDATE_PORTFOLIO":
			return {
				...state,
				portfolioValues: new Map(
					state.portfolioValues.set(action.payload.portfolioId, action.payload.data),
				),
			};

		case "ADD_ALERT":
			return {
				...state,
				alerts: [action.payload, ...state.alerts].slice(0, 50), // Keep last 50 alerts
				unreadAlertCount: action.payload.acknowledged
					? state.unreadAlertCount
					: state.unreadAlertCount + 1,
			};

		case "ACKNOWLEDGE_ALERT":
			return {
				...state,
				alerts: state.alerts.map((alert) =>
					alert.id === action.payload.alertId ? { ...alert, acknowledged: true } : alert,
				),
				unreadAlertCount: Math.max(0, state.unreadAlertCount - 1),
			};

		case "SET_CONNECTION_STATE":
			return {
				...state,
				isConnected: action.payload.connected,
				isConnecting: action.payload.connecting,
				connectionError: action.payload.error,
			};

		case "ADD_OPTIMISTIC_UPDATE":
			return {
				...state,
				optimisticUpdates: new Map(
					state.optimisticUpdates.set(action.payload.key, action.payload.data),
				),
			};

		case "REMOVE_OPTIMISTIC_UPDATE": {
			const newOptimisticUpdates = new Map(state.optimisticUpdates);
			newOptimisticUpdates.delete(action.payload.key);
			return {
				...state,
				optimisticUpdates: newOptimisticUpdates,
			};
		}

		case "CLEAR_OPTIMISTIC_UPDATES":
			return {
				...state,
				optimisticUpdates: new Map(),
			};

		default:
			return state;
	}
}

interface RealTimeDashboardContextType {
	state: DashboardState;
	actions: {
		acknowledgeAlert: (alertId: string) => void;
		addOptimisticUpdate: (key: string, data: Record<string, unknown>) => void;
		removeOptimisticUpdate: (key: string) => void;
		clearOptimisticUpdates: () => void;
		getAssetPrice: (assetId: string) => PriceData | undefined;
		getPortfolioValue: (portfolioId: string) => PortfolioData | undefined;
	};
}

const RealTimeDashboardContext = createContext<RealTimeDashboardContextType | null>(null);

interface RealTimeDashboardProviderProps {
	children: ReactNode;
	trackedAssets?: string[];
	trackedPortfolios?: string[];
}

export function RealTimeDashboardProvider({
	children,
	trackedAssets = [],
	trackedPortfolios = [],
}: RealTimeDashboardProviderProps) {
	const [state, dispatch] = useReducer(dashboardReducer, initialState);

	// WebSocket connection state
	const { connected, connecting, error } = useWebSocket();

	// Real-time data subscriptions
	const { prices, getPriceForAsset } = usePriceUpdates(trackedAssets);
	const { portfolios, getPortfolioUpdate } = usePortfolioUpdates(trackedPortfolios);
	const { alerts, acknowledgeAlert: wsAcknowledgeAlert } = useAlertNotifications();

	// Update connection state
	useEffect(() => {
		dispatch({
			type: "SET_CONNECTION_STATE",
			payload: { connected, connecting, error },
		});
	}, [connected, connecting, error]);

	// Update prices
	useEffect(() => {
		prices.forEach((priceUpdate) => {
			dispatch({
				type: "UPDATE_PRICE",
				payload: {
					assetId: priceUpdate.assetId,
					data: {
						price: priceUpdate.price,
						change: priceUpdate.change,
						changePercent: priceUpdate.changePercent,
						timestamp: priceUpdate.timestamp,
					},
				},
			});
		});
	}, [prices]);

	// Update portfolios
	useEffect(() => {
		portfolios.forEach((portfolioUpdate) => {
			dispatch({
				type: "UPDATE_PORTFOLIO",
				payload: {
					portfolioId: portfolioUpdate.portfolioId,
					data: {
						totalValue: portfolioUpdate.totalValue,
						totalCost: portfolioUpdate.totalCost,
						gainLoss: portfolioUpdate.gainLoss,
						gainLossPercent: portfolioUpdate.gainLossPercent,
						timestamp: portfolioUpdate.timestamp,
					},
				},
			});
		});
	}, [portfolios]);

	// Update alerts
	useEffect(() => {
		alerts.forEach((alert) => {
			dispatch({
				type: "ADD_ALERT",
				payload: alert,
			});
		});
	}, [alerts]);

	const actions = {
		acknowledgeAlert: (alertId: string) => {
			dispatch({ type: "ACKNOWLEDGE_ALERT", payload: { alertId } });
			wsAcknowledgeAlert(alertId);
		},

		addOptimisticUpdate: (key: string, data: any) => {
			dispatch({ type: "ADD_OPTIMISTIC_UPDATE", payload: { key, data } });
		},

		removeOptimisticUpdate: (key: string) => {
			dispatch({ type: "REMOVE_OPTIMISTIC_UPDATE", payload: { key } });
		},

		clearOptimisticUpdates: () => {
			dispatch({ type: "CLEAR_OPTIMISTIC_UPDATES" });
		},

		getAssetPrice: (assetId: string) => {
			return state.assetPrices.get(assetId) || getPriceForAsset(assetId);
		},

		getPortfolioValue: (portfolioId: string) => {
			return state.portfolioValues.get(portfolioId) || getPortfolioUpdate(portfolioId);
		},
	};

	return (
		<RealTimeDashboardContext.Provider value={{ state, actions }}>
			{children}
		</RealTimeDashboardContext.Provider>
	);
}

export function useRealTimeDashboard() {
	const context = useContext(RealTimeDashboardContext);
	if (!context) {
		throw new Error("useRealTimeDashboard must be used within a RealTimeDashboardProvider");
	}
	return context;
}

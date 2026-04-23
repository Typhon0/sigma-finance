import { useCallback, useEffect, useRef, useState } from "react";
import {
	type AlertNotification,
	getWebSocketManager,
	type PortfolioUpdate,
	type PriceUpdate,
	type WebSocketMessage,
} from "@/lib/websocket/websocket-manager";

export interface WebSocketState {
	connected: boolean;
	connecting: boolean;
	error: string | null;
}

/**
 * Hook for managing WebSocket connection state
 */
export function useWebSocket() {
	const [state, setState] = useState<WebSocketState>({
		connected: false,
		connecting: false,
		error: null,
	});

	const wsManager = getWebSocketManager();

	useEffect(() => {
		const unsubscribe = wsManager.subscribe("CONNECTION_STATUS", (message) => {
			setState((prev) => ({
				...prev,
				connected: message.payload.connected,
				connecting: false,
				error: message.payload.connected ? null : prev.error,
			}));
		});

		// Connect if not already connected
		if (!wsManager.isConnected()) {
			setState((prev) => ({ ...prev, connecting: true }));
			wsManager.connect().catch((error) => {
				setState((prev) => ({
					...prev,
					connecting: false,
					error: error.message,
				}));
			});
		} else {
			setState((prev) => ({ ...prev, connected: true }));
		}

		return unsubscribe;
	}, [wsManager]);

	const reconnect = useCallback(() => {
		setState((prev) => ({ ...prev, connecting: true, error: null }));
		wsManager.connect().catch((error) => {
			setState((prev) => ({
				...prev,
				connecting: false,
				error: error.message,
			}));
		});
	}, [wsManager]);

	return {
		...state,
		reconnect,
	};
}

/**
 * Hook for subscribing to real-time price updates
 */
export function usePriceUpdates(assetIds?: string[]) {
	const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
	const wsManager = getWebSocketManager();
	const assetIdsRef = useRef(assetIds);

	useEffect(() => {
		assetIdsRef.current = assetIds;
	}, [assetIds]);

	useEffect(() => {
		const unsubscribe = wsManager.subscribe("PRICE_UPDATE", (message: WebSocketMessage) => {
			const priceUpdate = message.payload as PriceUpdate;

			// Only update if we're tracking this asset
			if (!assetIdsRef.current || assetIdsRef.current.includes(priceUpdate.assetId)) {
				setPrices((prev) => new Map(prev.set(priceUpdate.assetId, priceUpdate)));
			}
		});

		// Subscribe to specific assets if provided
		if (assetIds && assetIds.length > 0) {
			wsManager.send({
				type: "SUBSCRIBE_PRICES",
				assetIds,
			});
		}

		return () => {
			unsubscribe();
			// Unsubscribe from price updates
			if (assetIds && assetIds.length > 0) {
				wsManager.send({
					type: "UNSUBSCRIBE_PRICES",
					assetIds,
				});
			}
		};
	}, [wsManager, assetIds]);

	const getPriceForAsset = useCallback(
		(assetId: string) => {
			return prices.get(assetId);
		},
		[prices],
	);

	return {
		prices: Array.from(prices.values()),
		getPriceForAsset,
	};
}

/**
 * Hook for subscribing to real-time portfolio updates
 */
export function usePortfolioUpdates(portfolioIds?: string[]) {
	const [portfolios, setPortfolios] = useState<Map<string, PortfolioUpdate>>(new Map());
	const wsManager = getWebSocketManager();
	const portfolioIdsRef = useRef(portfolioIds);

	useEffect(() => {
		portfolioIdsRef.current = portfolioIds;
	}, [portfolioIds]);

	useEffect(() => {
		const unsubscribe = wsManager.subscribe("PORTFOLIO_UPDATE", (message: WebSocketMessage) => {
			const portfolioUpdate = message.payload as PortfolioUpdate;

			// Only update if we're tracking this portfolio
			if (
				!portfolioIdsRef.current ||
				portfolioIdsRef.current.includes(portfolioUpdate.portfolioId)
			) {
				setPortfolios((prev) => new Map(prev.set(portfolioUpdate.portfolioId, portfolioUpdate)));
			}
		});

		// Subscribe to specific portfolios if provided
		if (portfolioIds && portfolioIds.length > 0) {
			wsManager.send({
				type: "SUBSCRIBE_PORTFOLIOS",
				portfolioIds,
			});
		}

		return () => {
			unsubscribe();
			// Unsubscribe from portfolio updates
			if (portfolioIds && portfolioIds.length > 0) {
				wsManager.send({
					type: "UNSUBSCRIBE_PORTFOLIOS",
					portfolioIds: portfolioIds!,
				});
			}
		};
	}, [wsManager, portfolioIds]);

	const getPortfolioUpdate = useCallback(
		(portfolioId: string) => {
			return portfolios.get(portfolioId);
		},
		[portfolios],
	);

	return {
		portfolios: Array.from(portfolios.values()),
		getPortfolioUpdate,
	};
}

/**
 * Hook for subscribing to real-time alert notifications
 */
export function useAlertNotifications() {
	const [alerts, setAlerts] = useState<AlertNotification[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const wsManager = getWebSocketManager();

	useEffect(() => {
		const unsubscribe = wsManager.subscribe("ALERT_NOTIFICATION", (message: WebSocketMessage) => {
			const alert = message.payload as AlertNotification;

			setAlerts((prev) => {
				const newAlerts = [alert, ...prev];
				// Keep only last 50 alerts
				return newAlerts.slice(0, 50);
			});

			if (!alert.acknowledged) {
				setUnreadCount((prev) => prev + 1);
			}
		});

		return unsubscribe;
	}, [wsManager]);

	const acknowledgeAlert = useCallback(
		(alertId: string) => {
			setAlerts((prev) =>
				prev.map((alert) => (alert.id === alertId ? { ...alert, acknowledged: true } : alert)),
			);

			setUnreadCount((prev) => Math.max(0, prev - 1));

			// Send acknowledgment to server
			wsManager.send({
				type: "ACKNOWLEDGE_ALERT",
				alertId,
			});
		},
		[wsManager],
	);

	const clearAllAlerts = useCallback(() => {
		setAlerts([]);
		setUnreadCount(0);
	}, []);

	return {
		alerts,
		unreadCount,
		acknowledgeAlert,
		clearAllAlerts,
	};
}

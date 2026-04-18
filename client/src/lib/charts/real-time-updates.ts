/**
 * Real-time price update utilities for Lightweight Charts™
 * Handles WebSocket connections, price streaming, and chart updates
 */

import type { CandlestickData, ISeriesApi, LineData } from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";
import { toChartTime } from "./lightweight-charts";

/**
 * Price update interfaces
 */
export interface PriceUpdate {
	assetId: string;
	symbol?: string;
	price: number;
	volume?: number;
	timestamp: string;
	change?: number;
	changePercent?: number;
	bid?: number;
	ask?: number;
	high24h?: number;
	low24h?: number;
}

export interface CandlestickUpdate {
	assetId: string;
	timestamp: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

/**
 * WebSocket connection states
 */
export type ConnectionState =
	| "connecting"
	| "connected"
	| "disconnected"
	| "error";

/**
 * Real-time update configuration
 */
export interface RealTimeConfig {
	wsUrl?: string;
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
	heartbeatInterval?: number;
	updateThrottleMs?: number;
	enableBatching?: boolean;
	batchSize?: number;
	batchIntervalMs?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<RealTimeConfig> = {
	wsUrl: process.env.VITE_WS_URL || "ws://localhost:8080/ws",
	reconnectInterval: 5000,
	maxReconnectAttempts: 10,
	heartbeatInterval: 30000,
	updateThrottleMs: 100,
	enableBatching: true,
	batchSize: 50,
	batchIntervalMs: 250,
};

/**
 * WebSocket message types
 */
export interface WSMessage {
	type:
		| "subscribe"
		| "unsubscribe"
		| "price_update"
		| "candlestick_update"
		| "heartbeat"
		| "error";
	payload?: any;
}

/**
 * Real-time price update manager
 */
export class RealTimePriceManager {
	private ws: WebSocket | null = null;
	private config: Required<RealTimeConfig>;
	private subscriptions = new Set<string>();
	private listeners = new Map<string, Set<(update: PriceUpdate) => void>>();
	private candlestickListeners = new Map<
		string,
		Set<(update: CandlestickUpdate) => void>
	>();
	private connectionState: ConnectionState = "disconnected";
	private reconnectAttempts = 0;
	private heartbeatTimer: NodeJS.Timeout | null = null;
	private updateQueue: PriceUpdate[] = [];
	private batchTimer: NodeJS.Timeout | null = null;
	private lastUpdateTime = new Map<string, number>();

	constructor(config: Partial<RealTimeConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Connect to WebSocket
	 */
	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				resolve();
				return;
			}

			this.connectionState = "connecting";
			this.ws = new WebSocket(this.config.wsUrl);

			this.ws.onopen = () => {
				this.connectionState = "connected";
				this.reconnectAttempts = 0;
				this.startHeartbeat();

				// Resubscribe to existing subscriptions
				this.subscriptions.forEach((assetId) => {
					this.sendMessage({
						type: "subscribe",
						payload: { assetId },
					});
				});

				resolve();
			};

			this.ws.onmessage = (event) => {
				this.handleMessage(event.data);
			};

			this.ws.onclose = () => {
				this.connectionState = "disconnected";
				this.stopHeartbeat();
				this.handleReconnect();
			};

			this.ws.onerror = (error) => {
				this.connectionState = "error";
				console.error("WebSocket error:", error);
				reject(error);
			};
		});
	}

	/**
	 * Disconnect from WebSocket
	 */
	disconnect(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.stopHeartbeat();
		this.clearBatchTimer();
		this.connectionState = "disconnected";
	}

	/**
	 * Subscribe to price updates for an asset
	 */
	subscribe(
		assetId: string,
		callback: (update: PriceUpdate) => void,
	): () => void {
		// Add to subscriptions
		this.subscriptions.add(assetId);

		// Add listener
		if (!this.listeners.has(assetId)) {
			this.listeners.set(assetId, new Set());
		}
		this.listeners.get(assetId)?.add(callback);

		// Send subscription message if connected
		if (this.connectionState === "connected") {
			this.sendMessage({
				type: "subscribe",
				payload: { assetId },
			});
		}

		// Return unsubscribe function
		return () => {
			this.unsubscribe(assetId, callback);
		};
	}

	/**
	 * Subscribe to candlestick updates for an asset
	 */
	subscribeCandlestick(
		assetId: string,
		callback: (update: CandlestickUpdate) => void,
	): () => void {
		if (!this.candlestickListeners.has(assetId)) {
			this.candlestickListeners.set(assetId, new Set());
		}
		this.candlestickListeners.get(assetId)?.add(callback);

		return () => {
			this.candlestickListeners.get(assetId)?.delete(callback);
			if (this.candlestickListeners.get(assetId)?.size === 0) {
				this.candlestickListeners.delete(assetId);
			}
		};
	}

	/**
	 * Unsubscribe from price updates
	 */
	private unsubscribe(
		assetId: string,
		callback: (update: PriceUpdate) => void,
	): void {
		this.listeners.get(assetId)?.delete(callback);

		if (this.listeners.get(assetId)?.size === 0) {
			this.listeners.delete(assetId);
			this.subscriptions.delete(assetId);

			if (this.connectionState === "connected") {
				this.sendMessage({
					type: "unsubscribe",
					payload: { assetId },
				});
			}
		}
	}

	/**
	 * Get connection state
	 */
	getConnectionState(): ConnectionState {
		return this.connectionState;
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(data: string): void {
		try {
			const message: WSMessage = JSON.parse(data);

			switch (message.type) {
				case "price_update":
					this.handlePriceUpdate(message.payload);
					break;
				case "candlestick_update":
					this.handleCandlestickUpdate(message.payload);
					break;
				case "heartbeat":
					// Heartbeat received, connection is alive
					break;
				case "error":
					console.error("WebSocket error message:", message.payload);
					break;
			}
		} catch (error) {
			console.error("Error parsing WebSocket message:", error);
		}
	}

	/**
	 * Handle price updates with throttling
	 */
	private handlePriceUpdate(update: PriceUpdate): void {
		const now = Date.now();
		const lastUpdate = this.lastUpdateTime.get(update.assetId) || 0;

		// Throttle updates
		if (now - lastUpdate < this.config.updateThrottleMs) {
			return;
		}

		this.lastUpdateTime.set(update.assetId, now);

		if (this.config.enableBatching) {
			this.updateQueue.push(update);
			this.scheduleBatchUpdate();
		} else {
			this.notifyListeners(update);
		}
	}

	/**
	 * Handle candlestick updates
	 */
	private handleCandlestickUpdate(update: CandlestickUpdate): void {
		const listeners = this.candlestickListeners.get(update.assetId);
		if (listeners) {
			for (const callback of listeners) {
				callback(update);
			}
		}
	}

	/**
	 * Schedule batch update
	 */
	private scheduleBatchUpdate(): void {
		if (this.batchTimer) return;

		this.batchTimer = setTimeout(() => {
			this.processBatchUpdates();
			this.batchTimer = null;
		}, this.config.batchIntervalMs);
	}

	/**
	 * Process batched updates
	 */
	private processBatchUpdates(): void {
		if (this.updateQueue.length === 0) return;

		// Group updates by asset ID and keep only the latest
		const latestUpdates = new Map<string, PriceUpdate>();

		this.updateQueue.forEach((update) => {
			latestUpdates.set(update.assetId, update);
		});

		// Notify listeners with latest updates
		latestUpdates.forEach((update) => {
			this.notifyListeners(update);
		});

		this.updateQueue = [];
	}

	/**
	 * Notify listeners of price updates
	 */
	private notifyListeners(update: PriceUpdate): void {
		const listeners = this.listeners.get(update.assetId);
		if (listeners) {
			listeners.forEach((callback) => {
				try {
					callback(update);
				} catch (error) {
					console.error("Error in price update callback:", error);
				}
			});
		}
	}

	/**
	 * Send message to WebSocket
	 */
	private sendMessage(message: WSMessage): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}

	/**
	 * Start heartbeat
	 */
	private startHeartbeat(): void {
		this.heartbeatTimer = setInterval(() => {
			this.sendMessage({ type: "heartbeat" });
		}, this.config.heartbeatInterval);
	}

	/**
	 * Stop heartbeat
	 */
	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	/**
	 * Handle reconnection
	 */
	private handleReconnect(): void {
		if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
			console.error("Max reconnection attempts reached");
			return;
		}

		this.reconnectAttempts++;

		setTimeout(() => {
			console.log(
				`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`,
			);
			this.connect().catch((error) => {
				console.error("Reconnection failed:", error);
			});
		}, this.config.reconnectInterval);
	}

	/**
	 * Clear batch timer
	 */
	private clearBatchTimer(): void {
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
			this.batchTimer = null;
		}
	}
}

/**
 * Global real-time manager instance
 */
let globalManager: RealTimePriceManager | null = null;

/**
 * Get or create global real-time manager
 */
export function getRealTimeManager(
	config?: Partial<RealTimeConfig>,
): RealTimePriceManager {
	if (!globalManager) {
		globalManager = new RealTimePriceManager(config);
	}
	return globalManager;
}

/**
 * Hook for real-time price updates
 */
export function useRealTimePrices(
	assetIds: string[],
	config?: Partial<RealTimeConfig>,
): {
	updates: Map<string, PriceUpdate>;
	connectionState: ConnectionState;
	subscribe: (assetId: string) => void;
	unsubscribe: (assetId: string) => void;
} {
	const [updates, setUpdates] = useState<Map<string, PriceUpdate>>(new Map());
	const [connectionState, setConnectionState] =
		useState<ConnectionState>("disconnected");
	const managerRef = useRef<RealTimePriceManager | null>(null);
	const unsubscribeFnsRef = useRef<Map<string, () => void>>(new Map());

	// Initialize manager
	useEffect(() => {
		managerRef.current = getRealTimeManager(config);

		// Connect to WebSocket
		managerRef.current.connect().catch((error) => {
			console.error("Failed to connect to real-time updates:", error);
		});

		// Monitor connection state
		const checkConnectionState = () => {
			if (managerRef.current) {
				setConnectionState(managerRef.current.getConnectionState());
			}
		};

		const interval = setInterval(checkConnectionState, 1000);

		return () => {
			clearInterval(interval);
			if (managerRef.current) {
				managerRef.current.disconnect();
			}
		};
	}, []);

	// Subscribe to asset updates
	const subscribe = useCallback((assetId: string) => {
		if (!managerRef.current || unsubscribeFnsRef.current.has(assetId)) return;

		const unsubscribe = managerRef.current.subscribe(assetId, (update) => {
			setUpdates((prev) => new Map(prev.set(assetId, update)));
		});

		unsubscribeFnsRef.current.set(assetId, unsubscribe);
	}, []);

	// Unsubscribe from asset updates
	const unsubscribe = useCallback((assetId: string) => {
		const unsubscribeFn = unsubscribeFnsRef.current.get(assetId);
		if (unsubscribeFn) {
			unsubscribeFn();
			unsubscribeFnsRef.current.delete(assetId);
			setUpdates((prev) => {
				const newMap = new Map(prev);
				newMap.delete(assetId);
				return newMap;
			});
		}
	}, []);

	// Auto-subscribe to provided asset IDs
	useEffect(() => {
		for (const assetId of assetIds) {
			subscribe(assetId);
		}

		return () => {
			for (const assetId of assetIds) {
				unsubscribe(assetId);
			}
		};
	}, [assetIds, subscribe, unsubscribe]);

	return {
		updates,
		connectionState,
		subscribe,
		unsubscribe,
	};
}

/**
 * Hook for chart series real-time updates
 */
export function useChartRealTimeUpdates(
	assetId: string,
	series: ISeriesApi<"Candlestick" | "Line"> | null,
	chartType: "candlestick" | "line" = "line",
): {
	lastUpdate: PriceUpdate | null;
	connectionState: ConnectionState;
} {
	const [lastUpdate, setLastUpdate] = useState<PriceUpdate | null>(null);
	const { updates, connectionState } = useRealTimePrices([assetId]);

	// Update chart series when new data arrives
	useEffect(() => {
		const update = updates.get(assetId);
		if (!update || !series) return;

		try {
			const timestamp = toChartTime(update.timestamp);

			if (chartType === "candlestick") {
				// For candlestick charts, we need to update or create a new candle
				// This is a simplified implementation
				const candlestickData: CandlestickData = {
					time: timestamp,
					open: update.price,
					high: update.price,
					low: update.price,
					close: update.price,
				};
				series.update(candlestickData);
			} else {
				// For line charts, add new data point
				const lineData: LineData = {
					time: timestamp,
					value: update.price,
				};
				series.update(lineData);
			}

			setLastUpdate(update);
		} catch (error) {
			console.error("Error updating chart with real-time data:", error);
		}
	}, [updates, assetId, series, chartType]);

	return {
		lastUpdate,
		connectionState,
	};
}

/**
 * Mock real-time data generator for development
 */
export function createMockRealTimeData(assetIds: string[]): () => void {
	const intervals: NodeJS.Timeout[] = [];

	assetIds.forEach((assetId) => {
		const interval = setInterval(
			() => {
				const basePrice = 100 + Math.random() * 50;
				const change = (Math.random() - 0.5) * 10;

				const mockUpdate: PriceUpdate = {
					assetId,
					price: basePrice + change,
					volume: Math.floor(Math.random() * 1000000),
					timestamp: new Date().toISOString(),
					change,
					changePercent: (change / basePrice) * 100,
				};

				// Simulate WebSocket message
				const manager = getRealTimeManager();
				(manager as any).handlePriceUpdate(mockUpdate);
			},
			1000 + Math.random() * 2000,
		); // Random interval between 1-3 seconds

		intervals.push(interval);
	});

	// Return cleanup function
	return () => {
		for (const interval of intervals) {
			clearInterval(interval);
		}
	};
}

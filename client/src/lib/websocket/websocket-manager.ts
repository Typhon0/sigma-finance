/**
 * WebSocket Manager for Real-time Updates
 * Handles connection management, reconnection logic, and message routing
 */

export interface WebSocketMessage {
	type: "PRICE_UPDATE" | "PORTFOLIO_UPDATE" | "ALERT_NOTIFICATION" | "CONNECTION_STATUS";
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	payload: any;
	timestamp: number;
}

export interface PriceUpdate {
	assetId: string;
	symbol: string;
	price: number;
	change: number;
	changePercent: number;
	timestamp: number;
	volume?: number;
}

export interface PortfolioUpdate {
	portfolioId: string;
	totalValue: number;
	totalCost: number;
	gainLoss: number;
	gainLossPercent: number;
	timestamp: number;
}

export interface AlertNotification {
	id: string;
	type: "PRICE" | "PERCENTAGE_CHANGE" | "PORTFOLIO_VALUE";
	title: string;
	message: string;
	assetId?: string;
	portfolioId?: string;
	timestamp: number;
	acknowledged: boolean;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class WebSocketManager {
	private ws: WebSocket | null = null;
	private url: string;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
	private isConnecting = false;
	private shouldReconnect = true;

	constructor(url: string) {
		this.url = url;
	}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				resolve();
				return;
			}

			if (this.isConnecting) {
				reject(new Error("Connection already in progress"));
				return;
			}

			this.isConnecting = true;

			try {
				this.ws = new WebSocket(this.url);

				this.ws.onopen = () => {
					this.isConnecting = false;
					this.reconnectAttempts = 0;
					this.startHeartbeat();
					this.emit("CONNECTION_STATUS", { connected: true });
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const message: WebSocketMessage = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (_error) {}
				};

				this.ws.onclose = (_event) => {
					this.isConnecting = false;
					this.stopHeartbeat();
					this.emit("CONNECTION_STATUS", { connected: false });

					if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
						this.scheduleReconnect();
					}
				};

				this.ws.onerror = (error) => {
					this.isConnecting = false;
					reject(error);
				};
			} catch (error) {
				this.isConnecting = false;
				reject(error);
			}
		});
	}

	disconnect(): void {
		this.shouldReconnect = false;
		this.stopHeartbeat();

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	subscribe(eventType: string, handler: WebSocketEventHandler): () => void {
		if (!this.eventHandlers.has(eventType)) {
			this.eventHandlers.set(eventType, []);
		}

		this.eventHandlers.get(eventType)?.push(handler);

		// Return unsubscribe function
		return () => {
			const handlers = this.eventHandlers.get(eventType);
			if (handlers) {
				const index = handlers.indexOf(handler);
				if (index > -1) {
					handlers.splice(index, 1);
				}
			}
		};
	}

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	send(message: any): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
		}
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	private handleMessage(message: WebSocketMessage): void {
		const handlers = this.eventHandlers.get(message.type);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(message);
				} catch (_error) {}
			});
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	private emit(type: string, payload: any): void {
		const message: WebSocketMessage = {
			// biome-ignore lint/suspicious/noExplicitAny: unavoidable
			type: type as any,
			payload,
			timestamp: Date.now(),
		};
		this.handleMessage(message);
	}

	private scheduleReconnect(): void {
		const delay = Math.min(this.reconnectDelay * 2 ** this.reconnectAttempts, 30000);

		setTimeout(() => {
			if (this.shouldReconnect) {
				this.reconnectAttempts++;
				this.connect().catch((_error) => {});
			}
		}, delay);
	}

	private startHeartbeat(): void {
		this.heartbeatInterval = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.send({ type: "PING" });
			}
		}, 30000); // Send ping every 30 seconds
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}
}

// Singleton instance
let wsManager: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
	if (!wsManager) {
		// Use environment variable or default to localhost
		const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";
		wsManager = new WebSocketManager(wsUrl);
	}
	return wsManager;
}

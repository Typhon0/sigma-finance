export interface BinanceKline {
	symbol: string;
	interval: string;
	kline: {
		startTime: number;
		openTime: number;
		closeTime: number;
		open: string;
		high: string;
		low: string;
		close: string;
		volume: string;
		isClosed: boolean;
	};
}

export interface BinanceTicker {
	symbol: string;
	priceChange: string;
	priceChangePercent: string;
	lastPrice: string;
	volume: string;
	quoteVolume: string;
}

export interface BinanceDepth {
	symbol: string;
	bids: [string, string][];
	asks: [string, string][];
}

export type BinanceEventType =
	| "kline"
	| "ticker"
	| "depth"
	| "trade"
	| "aggTrade";

export interface BinanceWebSocketMessage {
	e: BinanceEventType;
	E: number;
	s: string;
	k?: BinanceKline["kline"];
	p?: string;
	P?: string;
	c?: string;
	v?: string;
	q?: string;
}

type BinanceMessageHandler = (data: BinanceWebSocketMessage) => void;

export class BinanceWebSocketManager {
	private ws: WebSocket | null = null;
	private streamUrl = "wss://stream.binance.com:9443/ws";
	private subscribedStreams: Set<string> = new Set();
	private handlers: Map<BinanceEventType, BinanceMessageHandler[]> = new Map();
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private shouldReconnect = true;
	private pingInterval: ReturnType<typeof setInterval> | null = null;

	connect(streams: string[]): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.updateSubscriptions(streams);
				resolve();
				return;
			}

			this.ws = new WebSocket(`${this.streamUrl}/${streams.join("/")}`);

			this.ws.onopen = () => {
				console.log("Binance WebSocket connected");
				this.reconnectAttempts = 0;
				for (const s of streams) {
					this.subscribedStreams.add(s);
				}
				this.startPing();
				resolve();
			};

			this.ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					this.handleMessage(data);
				} catch (error) {
					console.error("Failed to parse Binance message:", error);
				}
			};

			this.ws.onclose = (event) => {
				console.log(
					"Binance WebSocket disconnected:",
					event.code,
					event.reason,
				);
				this.stopPing();

				if (
					this.shouldReconnect &&
					this.reconnectAttempts < this.maxReconnectAttempts
				) {
					this.scheduleReconnect(streams);
				}
			};

			this.ws.onerror = (error) => {
				console.error("Binance WebSocket error:", error);
				reject(error);
			};
		});
	}

	disconnect(): void {
		this.shouldReconnect = false;
		this.stopPing();

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		this.subscribedStreams.clear();
	}

	subscribe(
		eventType: BinanceEventType,
		handler: BinanceMessageHandler,
	): () => void {
		if (!this.handlers.has(eventType)) {
			this.handlers.set(eventType, []);
		}
		this.handlers.get(eventType)?.push(handler);

		return () => {
			const handlers = this.handlers.get(eventType);
			if (handlers) {
				const index = handlers.indexOf(handler);
				if (index > -1) {
					handlers.splice(index, 1);
				}
			}
		};
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	private handleMessage(data: BinanceWebSocketMessage): void {
		const handlers = this.handlers.get(data.e);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(data);
				} catch (error) {
					console.error("Error in Binance message handler:", error);
				}
			});
		}
	}

	private updateSubscriptions(streams: string[]): void {
		const newStreams = streams.filter((s) => !this.subscribedStreams.has(s));
		if (newStreams.length === 0) return;

		const subscribeMsg = {
			method: "SUBSCRIBE",
			params: newStreams,
			id: Date.now(),
		};

		this.ws?.send(JSON.stringify(subscribeMsg));
		for (const s of newStreams) {
			this.subscribedStreams.add(s);
		}
	}

	private scheduleReconnect(streams: string[]): void {
		const delay = Math.min(
			this.reconnectDelay * 2 ** this.reconnectAttempts,
			30000,
		);

		setTimeout(() => {
			if (this.shouldReconnect) {
				this.reconnectAttempts++;
				console.log(
					`Binance reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
				);
				this.connect(streams).catch((error) => {
					console.error("Binance reconnection failed:", error);
				});
			}
		}, delay);
	}

	private startPing(): void {
		this.pingInterval = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ method: "PING" }));
			}
		}, 30000);
	}

	private stopPing(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	static formatSymbol(symbol: string, interval: string): string {
		return `${symbol.toLowerCase()}@kline_${interval}`;
	}

	static formatTicker(symbol: string): string {
		return `${symbol.toLowerCase()}@ticker`;
	}

	static formatDepth(symbol: string): string {
		return `${symbol.toLowerCase()}@depth20@100ms`;
	}
}

let binanceWsManager: BinanceWebSocketManager | null = null;

export function getBinanceWebSocketManager(): BinanceWebSocketManager {
	if (!binanceWsManager) {
		binanceWsManager = new BinanceWebSocketManager();
	}
	return binanceWsManager;
}

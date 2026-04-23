import { useCallback, useEffect, useRef, useState } from "react";
import {
	type BinanceWebSocketManager,
	type BinanceWebSocketMessage,
	getBinanceWebSocketManager,
} from "@/lib/websocket/binance-websocket";

export interface UseBinanceKlineOptions {
	symbol: string;
	interval?: string;
	enabled?: boolean;
}

export interface BinanceCandle {
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export function useBinanceKline({
	symbol,
	interval = "1m",
	enabled = true,
}: UseBinanceKlineOptions) {
	const [candles, setCandles] = useState<BinanceCandle[]>([]);
	const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const managerRef = useRef<BinanceWebSocketManager | null>(null);

	useEffect(() => {
		if (!enabled || !symbol) return;

		const manager = getBinanceWebSocketManager();
		managerRef.current = manager;

		const streamName = `${symbol.toLowerCase()}@kline_${interval}`;

		const handleKline = (data: BinanceWebSocketMessage) => {
			if (!data.k) return;

			const k = data.k;
			const candle: BinanceCandle = {
				timestamp: k.startTime,
				open: parseFloat(k.open),
				high: parseFloat(k.high),
				low: parseFloat(k.low),
				close: parseFloat(k.close),
				volume: parseFloat(k.volume),
			};

			setCandles((prev) => {
				if (prev.length === 0) return [candle];

				const lastCandle = prev[prev.length - 1];
				if (lastCandle.timestamp === candle.timestamp) {
					return [...prev.slice(0, -1), candle];
				}
				return [...prev, candle].slice(-500);
			});
			setLastUpdate(new Date());
		};

		const unsubscribe = manager.subscribe("kline", handleKline);

		manager
			.connect([streamName])
			.then(() => setIsConnected(true))
			.catch((_err) => {});

		return () => {
			unsubscribe();
		};
	}, [symbol, interval, enabled]);

	const disconnect = useCallback(() => {
		if (managerRef.current) {
			managerRef.current.disconnect();
			setIsConnected(false);
		}
	}, []);

	return {
		candles,
		lastUpdate,
		isConnected,
		disconnect,
	};
}

export function useBinanceTicker(symbol: string, enabled = true) {
	const [ticker, setTicker] = useState<{
		price: number;
		change: number;
		changePercent: number;
		volume: number;
	} | null>(null);
	const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const managerRef = useRef<BinanceWebSocketManager | null>(null);

	useEffect(() => {
		if (!enabled || !symbol) return;

		const manager = getBinanceWebSocketManager();
		managerRef.current = manager;

		const streamName = `${symbol.toLowerCase()}@ticker`;

		const handleTicker = (data: BinanceWebSocketMessage) => {
			setTicker({
				price: parseFloat(data.c || "0"),
				change: parseFloat(data.p || "0"),
				changePercent: parseFloat(data.P || "0"),
				volume: parseFloat(data.v || "0"),
			});
			setLastUpdate(new Date());
		};

		const unsubscribe = manager.subscribe("ticker", handleTicker);

		manager
			.connect([streamName])
			.then(() => setIsConnected(true))
			.catch((_err) => {});

		return () => {
			unsubscribe();
		};
	}, [symbol, enabled]);

	return {
		ticker,
		lastUpdate,
		isConnected,
	};
}

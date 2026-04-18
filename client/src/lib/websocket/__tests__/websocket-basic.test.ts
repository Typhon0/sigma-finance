import { describe, expect, it, vi } from "vitest";
import { WebSocketManager } from "../websocket-manager";

// Mock WebSocket
class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	readyState = MockWebSocket.OPEN; // Start as open for simplicity
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	constructor(public url: string) {
		// Immediately trigger open for testing
		setTimeout(() => {
			this.onopen?.(new Event("open"));
		}, 0);
	}

	send(_data: string) {
		// Mock successful send
	}

	close() {
		this.readyState = MockWebSocket.CLOSED;
		this.onclose?.(
			new CloseEvent("close", { code: 1000, reason: "Normal closure" }),
		);
	}

	// Helper method to simulate incoming messages
	simulateMessage(data: any) {
		this.onmessage?.(
			new MessageEvent("message", { data: JSON.stringify(data) }),
		);
	}
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe("WebSocketManager Basic Tests", () => {
	it("should create WebSocket manager instance", () => {
		const wsManager = new WebSocketManager("ws://localhost:8080/test");
		expect(wsManager).toBeDefined();
	});

	it("should handle message subscription and unsubscription", () => {
		const wsManager = new WebSocketManager("ws://localhost:8080/test");
		const handler = vi.fn();

		const unsubscribe = wsManager.subscribe("PRICE_UPDATE", handler);
		expect(typeof unsubscribe).toBe("function");

		// Unsubscribe should work without errors
		unsubscribe();

		wsManager.disconnect();
	});

	it("should handle message routing", async () => {
		const wsManager = new WebSocketManager("ws://localhost:8080/test");
		const handler = vi.fn();

		wsManager.subscribe("PRICE_UPDATE", handler);

		// Connect and wait for connection
		await wsManager.connect();

		// Simulate message
		const ws = (wsManager as any).ws as MockWebSocket;
		const testMessage = {
			type: "PRICE_UPDATE",
			payload: {
				assetId: "asset-1",
				price: 150.0,
			},
			timestamp: Date.now(),
		};

		ws.simulateMessage(testMessage);

		expect(handler).toHaveBeenCalledWith(testMessage);

		wsManager.disconnect();
	});

	it("should handle connection state", async () => {
		const wsManager = new WebSocketManager("ws://localhost:8080/test");

		expect(wsManager.isConnected()).toBe(false);

		await wsManager.connect();
		expect(wsManager.isConnected()).toBe(true);

		wsManager.disconnect();
		expect(wsManager.isConnected()).toBe(false);
	});

	it("should handle malformed messages gracefully", async () => {
		const wsManager = new WebSocketManager("ws://localhost:8080/test");
		const handler = vi.fn();

		wsManager.subscribe("PRICE_UPDATE", handler);
		await wsManager.connect();

		const ws = (wsManager as any).ws as MockWebSocket;

		// Simulate malformed message
		if (ws.onmessage) {
			ws.onmessage(new MessageEvent("message", { data: "invalid json" }));
		}

		// Handler should not be called for malformed messages
		expect(handler).not.toHaveBeenCalled();

		wsManager.disconnect();
	});

	it("should send messages when connected", async () => {
		const wsManager = new WebSocketManager("ws://localhost:8080/test");
		await wsManager.connect();

		const ws = (wsManager as any).ws as MockWebSocket;
		const sendSpy = vi.spyOn(ws, "send");

		const message = {
			type: "SUBSCRIBE_PRICES",
			assetIds: ["asset-1"],
		};

		wsManager.send(message);

		expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(message));

		wsManager.disconnect();
	});
});

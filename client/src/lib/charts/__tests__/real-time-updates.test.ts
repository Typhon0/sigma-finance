// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealTimePriceManager } from "../real-time-updates";

class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;
	static instances: MockWebSocket[] = [];

	readyState = MockWebSocket.CONNECTING;
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	constructor(public url: string) {
		MockWebSocket.instances.push(this);
		setTimeout(() => {
			if (this.readyState !== MockWebSocket.CONNECTING) return;
			this.readyState = MockWebSocket.OPEN;
			this.onopen?.(new Event("open"));
		}, 0);
	}

	send(_data: string) {}

	close() {
		this.readyState = MockWebSocket.CLOSED;
		this.onclose?.(new CloseEvent("close", { code: 1000, reason: "Normal closure" }));
	}
}

describe("RealTimePriceManager reconnect timer", () => {
	beforeEach(() => {
		MockWebSocket.instances = [];
		vi.stubGlobal("WebSocket", MockWebSocket);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("cancels the pending reconnect when disconnected", async () => {
		const manager = new RealTimePriceManager({
			wsUrl: "ws://localhost/ws",
			reconnectInterval: 1000,
		});

		const connectPromise = manager.connect();
		vi.advanceTimersByTime(1);
		await connectPromise;
		expect(MockWebSocket.instances).toHaveLength(1);

		// Losing the socket schedules a reconnect.
		MockWebSocket.instances[0].close();

		// Disconnecting before that timer fires must cancel it, not reconnect later.
		manager.disconnect();
		vi.advanceTimersByTime(5000);

		expect(MockWebSocket.instances).toHaveLength(1);
	});
});

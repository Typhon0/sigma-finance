import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

global.React = React;

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}));

// Mock localStorage with actual store
const store = new Map<string, string>();
const localStorageMock = {
	getItem: vi.fn((key: string) => store.get(key) ?? null),
	setItem: vi.fn((key: string, value: string) => store.set(key, String(value))),
	removeItem: vi.fn((key: string) => store.delete(key)),
	clear: vi.fn(() => store.clear()),
	get length() {
		return store.size;
	},
	key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
};
global.localStorage = localStorageMock as unknown as Storage;

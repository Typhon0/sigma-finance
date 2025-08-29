import { MockedProvider } from "@apollo/client/testing";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../lib/auth-context";
import {
	useAuthentication,
	useAuthForm,
	useAuthGuard,
} from "../use-authentication";

// Mock the auth context
vi.mock("../../lib/auth-context", () => ({
	AuthProvider: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	useAuth: () => ({
		user: {
			id: "1",
			email: "test@example.com",
			name: "Test User",
			emailVerified: true,
		},
		isAuthenticated: true,
		isLoading: false,
		error: null,
		login: vi.fn(),
		register: vi.fn(),
		logout: vi.fn(),
		resetPassword: vi.fn(),
		confirmPasswordReset: vi.fn(),
		verifyEmail: vi.fn(),
		resendVerification: vi.fn(),
		refreshToken: vi.fn(),
		refreshUserData: vi.fn(),
	}),
}));

// Mock the auth hooks
vi.mock("../use-auth", () => ({
	useAuth: () => ({
		user: {
			id: "1",
			email: "test@example.com",
			name: "Test User",
			emailVerified: true,
		},
		isAuthenticated: true,
		isLoading: false,
		error: null,
		login: vi.fn(),
		register: vi.fn(),
		logout: vi.fn(),
		resetPassword: vi.fn(),
		confirmPasswordReset: vi.fn(),
		verifyEmail: vi.fn(),
		resendVerification: vi.fn(),
		refreshToken: vi.fn(),
		refreshUserData: vi.fn(),
	}),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
	<MockedProvider mocks={[]}>
		<AuthProvider>{children}</AuthProvider>
	</MockedProvider>
);

describe("useAuthentication", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should provide authentication state and actions", () => {
		const { result } = renderHook(() => useAuthentication(), { wrapper });

		expect(result.current.user).toEqual({
			id: "1",
			email: "test@example.com",
			name: "Test User",
			emailVerified: true,
		});
		expect(result.current.isAuthenticated).toBe(true);
		expect(result.current.isLoading).toBe(false);
		expect(typeof result.current.login).toBe("function");
		expect(typeof result.current.register).toBe("function");
		expect(typeof result.current.logout).toBe("function");
	});

	it("should track action loading states", () => {
		const { result } = renderHook(() => useAuthentication(), { wrapper });

		expect(result.current.isActionLoading("login")).toBe(false);
		expect(result.current.isAnyActionLoading).toBe(false);
		expect(result.current.currentAction).toBe(null);
	});
});

describe("useAuthForm", () => {
	it("should provide form state management", () => {
		const { result } = renderHook(() => useAuthForm());

		expect(result.current.fieldErrors).toEqual({});
		expect(result.current.isSubmitting).toBe(false);
		expect(typeof result.current.handleFormSubmit).toBe("function");
		expect(typeof result.current.clearFieldError).toBe("function");
		expect(typeof result.current.clearAllErrors).toBe("function");
	});

	it("should handle field errors", () => {
		const { result } = renderHook(() => useAuthForm());

		act(() => {
			result.current.clearFieldError("email");
		});

		expect(result.current.hasFieldError("email")).toBe(false);
		expect(result.current.getFieldError("email")).toBeUndefined();
	});
});

describe("useAuthGuard", () => {
	it("should provide authentication guards", () => {
		const { result } = renderHook(() => useAuthGuard(), { wrapper });

		expect(result.current.isAuthenticated).toBe(true);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.isEmailVerified).toBe(true);
		expect(typeof result.current.requireAuth).toBe("function");
		expect(typeof result.current.requireEmailVerification).toBe("function");
		expect(typeof result.current.requireGuest).toBe("function");
	});

	it("should check access permissions", () => {
		const { result } = renderHook(() => useAuthGuard(), { wrapper });

		expect(result.current.canAccess(true)).toBe(true); // requires auth
		expect(result.current.canAccess(true, true)).toBe(true); // requires auth + verification
		expect(result.current.canAccess(false)).toBe(true); // no requirements
	});
});

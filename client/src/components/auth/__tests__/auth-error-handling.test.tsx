import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AUTH_ERROR_CODES } from "../../../lib/types/auth.types";
import { AuthErrorDisplay } from "../auth-error-display";
import { AuthLoadingDisplay } from "../auth-loading-display";
import { AuthSuccessDisplay } from "../auth-success-display";

describe("Authentication Error Handling Components", () => {
	describe("AuthErrorDisplay", () => {
		it("displays error message correctly", () => {
			const errors = [
				{
					code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
					message: "Invalid email or password. Please try again.",
				},
			];

			render(<AuthErrorDisplay errors={errors} />);

			expect(screen.getByText("Invalid Credentials")).toBeInTheDocument();
			expect(
				screen.getByText("Invalid email or password. Please try again."),
			).toBeInTheDocument();
		});

		it("displays multiple errors indicator", () => {
			const errors = [
				{
					code: AUTH_ERROR_CODES.INVALID_EMAIL,
					message: "Please enter a valid email address.",
				},
				{
					code: AUTH_ERROR_CODES.WEAK_PASSWORD,
					message: "Password is too weak.",
				},
			];

			render(<AuthErrorDisplay errors={errors} />);

			expect(
				screen.getByText("1 additional error occurred."),
			).toBeInTheDocument();
		});

		it("shows resend verification button for email not verified error", () => {
			const errors = [
				{
					code: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
					message: "Please verify your email address before logging in.",
				},
			];

			const mockResendVerification = vi.fn();

			render(
				<AuthErrorDisplay
					errors={errors}
					onResendVerification={mockResendVerification}
				/>,
			);

			expect(
				screen.getByText("Email Verification Required"),
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /resend verification/i }),
			).toBeInTheDocument();
		});
	});

	describe("AuthSuccessDisplay", () => {
		it("displays registration success message", () => {
			render(
				<AuthSuccessDisplay type="registration" email="test@example.com" />,
			);

			expect(
				screen.getByText("Account Created Successfully!"),
			).toBeInTheDocument();
			expect(
				screen.getByText(
					/verification email has been sent to test@example.com/i,
				),
			).toBeInTheDocument();
		});

		it("displays login success message", () => {
			render(<AuthSuccessDisplay type="login" />);

			expect(screen.getByText("Welcome Back!")).toBeInTheDocument();
			expect(screen.getByText(/successfully logged in/i)).toBeInTheDocument();
		});

		it("displays password reset success message", () => {
			render(
				<AuthSuccessDisplay type="password-reset" email="test@example.com" />,
			);

			expect(screen.getByText("Reset Link Sent!")).toBeInTheDocument();
			expect(
				screen.getByText(
					/password reset link has been sent to test@example.com/i,
				),
			).toBeInTheDocument();
		});
	});

	describe("AuthLoadingDisplay", () => {
		it("displays login loading state", () => {
			render(<AuthLoadingDisplay type="login" />);

			expect(screen.getByText("Signing you in...")).toBeInTheDocument();
			expect(screen.getByRole("status")).toBeInTheDocument();
		});

		it("displays register loading state", () => {
			render(<AuthLoadingDisplay type="register" />);

			expect(screen.getByText("Creating your account...")).toBeInTheDocument();
		});

		it("displays custom loading message", () => {
			render(
				<AuthLoadingDisplay
					type="login"
					message="Please wait while we authenticate you..."
				/>,
			);

			expect(
				screen.getByText("Please wait while we authenticate you..."),
			).toBeInTheDocument();
		});
	});
});

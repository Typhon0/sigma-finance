import { describe, expect, it } from "vitest";

// Test validation schemas and utility functions
import {
	emailVerificationSchema,
	passwordResetConfirmSchema,
	passwordResetSchema,
} from "../../../lib/validations/auth.schemas";

describe("Email Verification and Password Reset Workflows", () => {
	describe("Validation Schemas", () => {
		it("should validate password reset email correctly", () => {
			const validData = { email: "test@example.com" };
			const result = passwordResetSchema.safeParse(validData);
			expect(result.success).toBe(true);

			const invalidData = { email: "invalid-email" };
			const invalidResult = passwordResetSchema.safeParse(invalidData);
			expect(invalidResult.success).toBe(false);
		});

		it("should validate password reset confirmation correctly", () => {
			const validData = {
				token: "valid-token",
				newPassword: "Password123!",
				confirmPassword: "Password123!",
			};
			const result = passwordResetConfirmSchema.safeParse(validData);
			expect(result.success).toBe(true);

			const mismatchData = {
				token: "valid-token",
				newPassword: "Password123!",
				confirmPassword: "DifferentPassword123!",
			};
			const mismatchResult = passwordResetConfirmSchema.safeParse(mismatchData);
			expect(mismatchResult.success).toBe(false);
		});

		it("should validate email verification token correctly", () => {
			const validData = { token: "valid-verification-token" };
			const result = emailVerificationSchema.safeParse(validData);
			expect(result.success).toBe(true);

			const invalidData = { token: "" };
			const invalidResult = emailVerificationSchema.safeParse(invalidData);
			expect(invalidResult.success).toBe(false);
		});
	});

	describe("Password Strength Requirements", () => {
		it("should enforce minimum password length", () => {
			const shortPassword = {
				token: "token",
				newPassword: "short",
				confirmPassword: "short",
			};
			const result = passwordResetConfirmSchema.safeParse(shortPassword);
			expect(result.success).toBe(false);
		});

		it("should require uppercase, lowercase, and number", () => {
			const weakPassword = {
				token: "token",
				newPassword: "password123",
				confirmPassword: "password123",
			};
			const result = passwordResetConfirmSchema.safeParse(weakPassword);
			expect(result.success).toBe(false);
		});
	});
});

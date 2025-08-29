import { z } from "zod";

// Portfolio form validation schema
export const portfolioFormSchema = z.object({
	name: z
		.string()
		.min(1, "Portfolio name is required")
		.min(3, "Portfolio name must be at least 3 characters")
		.max(100, "Portfolio name must be less than 100 characters")
		.regex(
			/^[a-zA-Z0-9\s\-_.]+$/,
			"Portfolio name can only contain letters, numbers, spaces, hyphens, underscores, and periods",
		)
		.refine(
			(name) => name.trim().length >= 3,
			"Portfolio name must contain at least 3 non-whitespace characters",
		),
	description: z
		.string()
		.max(500, "Description must be less than 500 characters")
		.optional()
		.transform((val) => (val === "" ? undefined : val)),
});

// Create portfolio input schema (extends form schema with user ID)
export const createPortfolioSchema = portfolioFormSchema.extend({
	userID: z.string().min(1, "User ID is required"),
});

// Update portfolio input schema (all fields optional except validation rules)
export const updatePortfolioSchema = z.object({
	name: portfolioFormSchema.shape.name.optional(),
	description: portfolioFormSchema.shape.description.optional(),
	sortOrder: z.number().int().min(0).optional(),
});

// Portfolio form data type
export type PortfolioFormData = z.infer<typeof portfolioFormSchema>;

// Create portfolio input type
export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;

// Update portfolio input type
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;

// Portfolio form mode type
export type PortfolioFormMode = "create" | "edit";

// Portfolio form error type
export interface PortfolioFormError {
	field?: keyof PortfolioFormData;
	message: string;
	code?: string;
}

// Validation helper functions
export const portfolioValidationHelpers = {
	/**
	 * Validates portfolio name uniqueness (client-side check)
	 */
	validateNameUniqueness: (
		name: string,
		existingNames: string[],
		currentName?: string,
	): boolean => {
		const trimmedName = name.trim().toLowerCase();
		const currentTrimmedName = currentName?.trim().toLowerCase();

		// If editing and name hasn't changed, it's valid
		if (currentTrimmedName && trimmedName === currentTrimmedName) {
			return true;
		}

		// Check if name exists in the list
		return !existingNames.some(
			(existing) => existing.trim().toLowerCase() === trimmedName,
		);
	},

	/**
	 * Sanitizes portfolio name input
	 */
	sanitizeName: (name: string): string => {
		return name
			.trim()
			.replace(/\s+/g, " ") // Replace multiple spaces with single space
			.replace(/[^\w\s\-_.]/g, ""); // Remove invalid characters
	},

	/**
	 * Sanitizes description input
	 */
	sanitizeDescription: (description: string): string => {
		return description.trim().replace(/\s+/g, " "); // Replace multiple spaces with single space
	},

	/**
	 * Generates portfolio name suggestions
	 */
	generateNameSuggestions: (
		baseName: string,
		existingNames: string[],
	): string[] => {
		const suggestions: string[] = [];
		const sanitizedBase = portfolioValidationHelpers.sanitizeName(baseName);

		if (!sanitizedBase) return suggestions;

		// Try base name first
		if (
			portfolioValidationHelpers.validateNameUniqueness(
				sanitizedBase,
				existingNames,
			)
		) {
			suggestions.push(sanitizedBase);
		}

		// Generate numbered variations
		for (let i = 2; i <= 10; i++) {
			const suggestion = `${sanitizedBase} ${i}`;
			if (
				portfolioValidationHelpers.validateNameUniqueness(
					suggestion,
					existingNames,
				)
			) {
				suggestions.push(suggestion);
			}
			if (suggestions.length >= 5) break;
		}

		// Generate dated variations
		const today = new Date();
		const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
		const dateVariation = `${sanitizedBase} ${dateStr}`;
		if (
			portfolioValidationHelpers.validateNameUniqueness(
				dateVariation,
				existingNames,
			)
		) {
			suggestions.push(dateVariation);
		}

		return suggestions.slice(0, 5); // Return max 5 suggestions
	},
};

// Form field configurations
export const portfolioFormConfig = {
	name: {
		placeholder:
			'Enter portfolio name (e.g., "Tech Stocks", "Retirement Fund")',
		maxLength: 100,
		autoComplete: "off",
		autoFocus: true,
	},
	description: {
		placeholder: "Describe your portfolio strategy, goals, or notes...",
		maxLength: 500,
		rows: 3,
		autoComplete: "off",
	},
} as const;

// Error messages for common validation scenarios
export const portfolioErrorMessages = {
	nameRequired: "Portfolio name is required",
	nameTooShort: "Portfolio name must be at least 3 characters",
	nameTooLong: "Portfolio name must be less than 100 characters",
	nameInvalidChars: "Portfolio name contains invalid characters",
	nameExists: "A portfolio with this name already exists",
	descriptionTooLong: "Description must be less than 500 characters",
	networkError:
		"Network error occurred. Please check your connection and try again.",
	serverError: "Server error occurred. Please try again later.",
	unauthorized: "You are not authorized to perform this action",
	notFound: "Portfolio not found",
	validationFailed: "Please fix the errors below and try again",
} as const;

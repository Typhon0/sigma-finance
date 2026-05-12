import { describe, expect, it } from "vitest";

// Mock data for testing
const mockPortfolios = [
	{
		id: "1",
		name: "Tech Portfolio",
		description: "Technology stocks",
		createdAt: "2023-01-01",
	},
	{
		id: "2",
		name: "Growth Portfolio",
		description: "High growth investments",
		createdAt: "2023-02-01",
	},
	{
		id: "3",
		name: "Value Portfolio",
		description: "Value investing strategy",
		createdAt: "2023-03-01",
	},
	{
		id: "4",
		name: "Dividend Portfolio",
		description: "Dividend-focused stocks",
		createdAt: "2023-04-01",
	},
];

// Test utility functions that don't require React hooks
describe("Search and Filter Utilities", () => {
	it("should filter items by search term", () => {
		const searchTerm = "tech";
		const searchFields = ["name", "description"];

		const filtered = mockPortfolios.filter((item) =>
			searchFields.some((field) => {
				const value = item[field as keyof typeof item];
				if (typeof value === "string") {
					return value.toLowerCase().includes(searchTerm.toLowerCase());
				}
				return false;
			}),
		);

		expect(filtered).toHaveLength(1);
		expect(filtered[0].name).toBe("Tech Portfolio");
	});

	it("should sort items by field", () => {
		const sorted = [...mockPortfolios].sort((a, b) => {
			const aValue = a.name;
			const bValue = b.name;
			return aValue.localeCompare(bValue);
		});

		expect(sorted[0].name).toBe("Dividend Portfolio");
		expect(sorted[3].name).toBe("Value Portfolio");
	});

	it("should sort items in descending order", () => {
		const sorted = [...mockPortfolios].sort((a, b) => {
			const aValue = a.name;
			const bValue = b.name;
			return bValue.localeCompare(aValue);
		});

		expect(sorted[0].name).toBe("Value Portfolio");
		expect(sorted[3].name).toBe("Dividend Portfolio");
	});

	it("should filter by multiple criteria", () => {
		const filters = { name: "Tech Portfolio" };

		const filtered = mockPortfolios.filter((item) => {
			return Object.entries(filters).every(([key, value]) => {
				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				const itemValue = (item as any)[key];
				return itemValue === value;
			});
		});

		expect(filtered).toHaveLength(1);
		expect(filtered[0].name).toBe("Tech Portfolio");
	});

	it("should handle case-insensitive search", () => {
		const searchTerm = "TECH";
		const searchFields = ["name", "description"];

		const filtered = mockPortfolios.filter((item) =>
			searchFields.some((field) => {
				const value = item[field as keyof typeof item];
				if (typeof value === "string") {
					return value.toLowerCase().includes(searchTerm.toLowerCase());
				}
				return false;
			}),
		);

		expect(filtered).toHaveLength(1);
		expect(filtered[0].name).toBe("Tech Portfolio");
	});

	it("should return empty array for no matches", () => {
		const searchTerm = "nonexistent";
		const searchFields = ["name", "description"];

		const filtered = mockPortfolios.filter((item) =>
			searchFields.some((field) => {
				const value = item[field as keyof typeof item];
				if (typeof value === "string") {
					return value.toLowerCase().includes(searchTerm.toLowerCase());
				}
				return false;
			}),
		);

		expect(filtered).toHaveLength(0);
	});
});

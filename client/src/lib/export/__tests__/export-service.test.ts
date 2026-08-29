import { beforeEach, describe, expect, it } from "vitest";
import { ExportService } from "../export-service";

// Mock URL.createObjectURL and related APIs
global.URL = {
	createObjectURL: () => "mock-url",
	revokeObjectURL: () => {},
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
} as any;

// Mock document methods
global.document = {
	createElement: () => ({
		href: "",
		download: "",
		click: () => {},
	}),
	body: {
		appendChild: () => {},
		removeChild: () => {},
	},
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
} as any;

describe("ExportService", () => {
	beforeEach(() => {
		// Reset any mocks if needed
	});

	describe("exportPortfolioData", () => {
		it("should export portfolio data as CSV", async () => {
			const result = await ExportService.exportPortfolioData("portfolio-1", "csv");

			expect(result.success).toBe(true);
			expect(result.filename).toContain("portfolio_data");
			expect(result.filename).toContain(".csv");
		});

		it("should export portfolio data as PDF", async () => {
			const result = await ExportService.exportPortfolioData("portfolio-1", "pdf");

			expect(result.success).toBe(true);
			expect(result.filename).toContain("portfolio_data");
			expect(result.filename).toContain(".pdf");
		});

		it("should export portfolio data as JSON", async () => {
			const result = await ExportService.exportPortfolioData("portfolio-1", "json");

			expect(result.success).toBe(true);
			expect(result.filename).toContain("portfolio_data");
			expect(result.filename).toContain(".json");
		});

		it("should handle unsupported format", async () => {
			// biome-ignore lint/suspicious/noExplicitAny: unavoidable
			const result = await ExportService.exportPortfolioData("portfolio-1", "xml" as any);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Unsupported format");
		});
	});

	describe("createDataBackup", () => {
		it("should create data backup as JSON", async () => {
			const result = await ExportService.createDataBackup("user-1");

			expect(result.success).toBe(true);
			expect(result.filename).toContain("data_backup");
			expect(result.filename).toContain(".json");
		});
	});
});

import { describe, expect, it } from "vitest";
import { EditPortfolioDialog, EditPortfolioButton } from "../edit-portfolio-dialog";

describe("EditPortfolioDialog", () => {
	it("exports the EditPortfolioDialog component", () => {
		expect(EditPortfolioDialog).toBeDefined();
		expect(typeof EditPortfolioDialog).toBe("function");
	});

	it("exports the EditPortfolioButton component", () => {
		expect(EditPortfolioButton).toBeDefined();
		expect(typeof EditPortfolioButton).toBe("function");
	});

	it("has the correct component name", () => {
		expect(EditPortfolioDialog.name).toBe("EditPortfolioDialog");
		expect(EditPortfolioButton.name).toBe("EditPortfolioButton");
	});
});
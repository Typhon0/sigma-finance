import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The export picker offered six types. Three of them could never produce a
 * file:
 *
 * - `performance-analytics` fell through the handler's `default:` branch and
 *   threw "Unsupported export type".
 * - `tax-report` and `audit-trail` reached the service, which returned
 *   hardcoded objects for them.
 *
 * The service now refuses all three with a real reason, so the failure moved
 * from "throws an exception" to "shows a message" - but a user could still
 * pick one, fill in the form, press Export and discover it that way. The
 * picker should say what exists.
 *
 * These assertions read the source rather than rendering the dialog: the
 * defect is a list of entries and a `disabled` expression, and a render test
 * would only assert that Radix renders what it was given.
 */

const DIALOG = resolve(__dirname, "../export-dialog.tsx");

function source(): string {
	// Comments quote the old behaviour verbatim to explain its removal, so
	// they are stripped before any assertion.
	return readFileSync(DIALOG, "utf-8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "");
}

describe("export type picker", () => {
	it("marks every type with no data source as unavailable", () => {
		const text = source();
		for (const value of ["performance-analytics", "tax-report", "audit-trail"]) {
			const entry = text.slice(text.indexOf(`value: "${value}"`));
			const block = entry.slice(0, entry.indexOf("}"));
			expect(block, `${value} has no unavailable reason`).toMatch(/unavailable: "[^"]+"/);
		}
	});

	it("disables the unavailable types in the picker", () => {
		expect(source()).toContain("type.unavailable !== null ||");
	});

	it("leaves the types that do work enabled", () => {
		const text = source();
		for (const value of ["portfolio-data", "transaction-history", "data-backup"]) {
			const entry = text.slice(text.indexOf(`value: "${value}"`));
			const block = entry.slice(0, entry.indexOf("}"));
			expect(block, `${value} should be available`).toContain("unavailable: null");
		}
	});

	it("states the reason in the dialog rather than behind a thrown error", () => {
		expect(source()).toContain("selectedTypeConfig?.unavailable");
	});
});

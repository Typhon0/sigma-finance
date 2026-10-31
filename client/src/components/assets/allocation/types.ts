/**
 * Domain-agnostic allocation model.
 *
 * Stock, crypto, real-estate (or any future) pages group their holdings
 * differently, but they all render the same thing: a ranked list of
 * value-weighted slices. These types keep that shared shape in one place so
 * each page only owns its grouping logic, never the chart rendering.
 */

export interface AllocationSlice {
	name: string;
	value: number;
	/** Percentage of the total, apportioned so all slices sum to exactly 100. */
	percent: number;
	color: string;
	/** How many holdings were rolled into this slice (shown nowhere, kept for a11y/future use). */
	count?: number;
	isOthers?: boolean;
}

export interface AllocationModeOption {
	/** Stable id used in filters, e.g. "asset" | "sector" | "account". */
	id: string;
	/** Dropdown label, e.g. "By Asset". */
	label: string;
	/** Plural unit for the donut centre + badge, e.g. "Assets". */
	groupUnit: string;
}

export interface AllocationFilter {
	mode: string;
	value: string;
	label?: string;
}

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Custom hook for debounced search functionality
 * Optimizes search performance by delaying API calls until user stops typing
 */
export function useDebouncedSearch<T>(items: T[], searchFields: (keyof T)[], delay = 300) {
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
	const [isSearching, setIsSearching] = useState(false);

	// Debounce the search term
	useEffect(() => {
		setIsSearching(true);
		const timer = setTimeout(() => {
			setDebouncedSearchTerm(searchTerm);
			setIsSearching(false);
		}, delay);

		return () => {
			clearTimeout(timer);
		};
	}, [searchTerm, delay]);

	// Filter items based on debounced search term
	const filteredItems = useMemo(() => {
		if (!debouncedSearchTerm.trim()) {
			return items;
		}

		const searchLower = debouncedSearchTerm.toLowerCase();
		return items.filter((item) =>
			searchFields.some((field) => {
				const value = item[field];
				if (typeof value === "string") {
					return value.toLowerCase().includes(searchLower);
				}
				if (typeof value === "number") {
					return value.toString().includes(searchLower);
				}
				return false;
			}),
		);
	}, [items, searchFields, debouncedSearchTerm]);

	const clearSearch = useCallback(() => {
		setSearchTerm("");
		setDebouncedSearchTerm("");
	}, []);

	return {
		searchTerm,
		setSearchTerm,
		debouncedSearchTerm,
		filteredItems,
		isSearching,
		clearSearch,
		hasResults: filteredItems.length > 0,
		resultCount: filteredItems.length,
	};
}

/**
 * Hook for debounced value changes (generic utility)
 */
export function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}

/**
 * Hook for debounced callback execution
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
	callback: T,
	delay: number,
): T {
	const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

	const debouncedCallback = useCallback(
		(...args: Parameters<T>) => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}

			const timer = setTimeout(() => {
				callback(...args);
			}, delay);

			setDebounceTimer(timer);
		},
		[callback, delay, debounceTimer],
	) as T;

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
		};
	}, [debounceTimer]);

	return debouncedCallback;
}

/**
 * Advanced search hook with filtering and sorting capabilities
 */
export interface SearchFilters {
	[key: string]: any;
}

export interface SortConfig<T> {
	field: keyof T;
	direction: "asc" | "desc";
}

export function useAdvancedSearch<T>(
	items: T[],
	searchFields: (keyof T)[],
	options: {
		debounceDelay?: number;
		caseSensitive?: boolean;
		exactMatch?: boolean;
	} = {},
) {
	const { debounceDelay = 300, caseSensitive = false, exactMatch = false } = options;

	const [searchTerm, setSearchTerm] = useState("");
	const [filters, setFilters] = useState<SearchFilters>({});
	const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(null);

	const debouncedSearchTerm = useDebounce(searchTerm, debounceDelay);

	const processedItems = useMemo(() => {
		let result = [...items];

		// Apply search filter
		if (debouncedSearchTerm.trim()) {
			const searchValue = caseSensitive ? debouncedSearchTerm : debouncedSearchTerm.toLowerCase();

			result = result.filter((item) =>
				searchFields.some((field) => {
					const value = item[field];
					if (typeof value === "string") {
						const fieldValue = caseSensitive ? value : value.toLowerCase();
						return exactMatch ? fieldValue === searchValue : fieldValue.includes(searchValue);
					}
					if (typeof value === "number") {
						return value.toString().includes(searchValue);
					}
					return false;
				}),
			);
		}

		// Apply additional filters
		Object.entries(filters).forEach(([key, filterValue]) => {
			if (filterValue !== undefined && filterValue !== null && filterValue !== "") {
				result = result.filter((item) => {
					const itemValue = (item as any)[key];
					if (Array.isArray(filterValue)) {
						return filterValue.includes(itemValue);
					}
					return itemValue === filterValue;
				});
			}
		});

		// Apply sorting
		if (sortConfig) {
			result.sort((a, b) => {
				const aValue = a[sortConfig.field];
				const bValue = b[sortConfig.field];

				if (aValue === bValue) return 0;

				let comparison = 0;
				if (typeof aValue === "string" && typeof bValue === "string") {
					comparison = aValue.localeCompare(bValue);
				} else if (typeof aValue === "number" && typeof bValue === "number") {
					comparison = aValue - bValue;
				} else if (aValue instanceof Date && bValue instanceof Date) {
					comparison = aValue.getTime() - bValue.getTime();
				} else {
					comparison = String(aValue).localeCompare(String(bValue));
				}

				return sortConfig.direction === "desc" ? -comparison : comparison;
			});
		}

		return result;
	}, [items, debouncedSearchTerm, filters, sortConfig, searchFields, caseSensitive, exactMatch]);

	const updateFilter = useCallback((key: string, value: any) => {
		setFilters((prev) => ({
			...prev,
			[key]: value,
		}));
	}, []);

	const removeFilter = useCallback((key: string) => {
		setFilters((prev) => {
			const newFilters = { ...prev };
			delete newFilters[key];
			return newFilters;
		});
	}, []);

	const clearAllFilters = useCallback(() => {
		setFilters({});
		setSearchTerm("");
		setSortConfig(null);
	}, []);

	const toggleSort = useCallback((field: keyof T) => {
		setSortConfig((prev) => {
			if (!prev || prev.field !== field) {
				return { field, direction: "asc" };
			}
			if (prev.direction === "asc") {
				return { field, direction: "desc" };
			}
			return null; // Remove sorting
		});
	}, []);

	return {
		// Search state
		searchTerm,
		setSearchTerm,
		debouncedSearchTerm,

		// Filter state
		filters,
		updateFilter,
		removeFilter,
		clearAllFilters,

		// Sort state
		sortConfig,
		setSortConfig,
		toggleSort,

		// Results
		filteredItems: processedItems,
		resultCount: processedItems.length,
		hasResults: processedItems.length > 0,
		isSearching: searchTerm !== debouncedSearchTerm,

		// Utility
		hasActiveFilters:
			Object.keys(filters).length > 0 || searchTerm.trim() !== "" || sortConfig !== null,
	};
}

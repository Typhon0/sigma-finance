import { useCallback, useEffect, useRef, useState } from "react";

interface KeyboardNavigationOptions {
	// Elements to include in navigation
	selector?: string;
	// Skip elements that are disabled or hidden
	skipDisabled?: boolean;
	// Wrap around when reaching the end
	wrap?: boolean;
	// Custom key handlers
	customKeys?: Record<string, (event: KeyboardEvent) => void>;
	// Focus trap (prevent focus from leaving container)
	trapFocus?: boolean;
}

/**
 * Hook for managing keyboard navigation within a container
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
	const {
		selector = "[tabindex], button, input, select, textarea, a[href]",
		skipDisabled = true,
		wrap = true,
		customKeys = {},
		trapFocus = false,
	} = options;

	const containerRef = useRef<HTMLElement>(null);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const [focusableElements, setFocusableElements] = useState<HTMLElement[]>([]);

	// Update focusable elements when container changes
	const updateFocusableElements = useCallback(() => {
		if (!containerRef.current) return;

		const elements = Array.from(
			containerRef.current.querySelectorAll(selector),
		) as HTMLElement[];

		const filteredElements = elements.filter((element) => {
			if (skipDisabled) {
				return (
					!element.hasAttribute("disabled") &&
					!element.getAttribute("aria-disabled") &&
					element.offsetParent !== null
				); // Not hidden
			}
			return true;
		});

		setFocusableElements(filteredElements);
	}, [selector, skipDisabled]);

	// Focus element at specific index
	const focusElementAt = useCallback(
		(index: number) => {
			if (index >= 0 && index < focusableElements.length) {
				focusableElements[index]?.focus();
				setCurrentIndex(index);
			}
		},
		[focusableElements],
	);

	// Move focus to next element
	const focusNext = useCallback(() => {
		const nextIndex = currentIndex + 1;
		if (nextIndex < focusableElements.length) {
			focusElementAt(nextIndex);
		} else if (wrap) {
			focusElementAt(0);
		}
	}, [currentIndex, focusableElements.length, focusElementAt, wrap]);

	// Move focus to previous element
	const focusPrevious = useCallback(() => {
		const prevIndex = currentIndex - 1;
		if (prevIndex >= 0) {
			focusElementAt(prevIndex);
		} else if (wrap) {
			focusElementAt(focusableElements.length - 1);
		}
	}, [currentIndex, focusableElements.length, focusElementAt, wrap]);

	// Focus first element
	const focusFirst = useCallback(() => {
		focusElementAt(0);
	}, [focusElementAt]);

	// Focus last element
	const focusLast = useCallback(() => {
		focusElementAt(focusableElements.length - 1);
	}, [focusElementAt, focusableElements.length]);

	// Handle keyboard events
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			// Handle custom keys first
			if (customKeys[event.key]) {
				customKeys[event.key](event);
				return;
			}

			switch (event.key) {
				case "ArrowDown":
				case "ArrowRight":
					event.preventDefault();
					focusNext();
					break;

				case "ArrowUp":
				case "ArrowLeft":
					event.preventDefault();
					focusPrevious();
					break;

				case "Home":
					event.preventDefault();
					focusFirst();
					break;

				case "End":
					event.preventDefault();
					focusLast();
					break;

				case "Tab":
					if (trapFocus) {
						event.preventDefault();
						if (event.shiftKey) {
							focusPrevious();
						} else {
							focusNext();
						}
					}
					break;
			}
		},
		[customKeys, focusNext, focusPrevious, focusFirst, focusLast, trapFocus],
	);

	// Set up event listeners
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		updateFocusableElements();
		container.addEventListener("keydown", handleKeyDown);

		// Update focusable elements when DOM changes
		const observer = new MutationObserver(updateFocusableElements);
		observer.observe(container, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["disabled", "aria-disabled", "tabindex"],
		});

		return () => {
			container.removeEventListener("keydown", handleKeyDown);
			observer.disconnect();
		};
	}, [handleKeyDown, updateFocusableElements]);

	return {
		containerRef,
		currentIndex,
		focusableElements,
		focusNext,
		focusPrevious,
		focusFirst,
		focusLast,
		focusElementAt,
		updateFocusableElements,
	};
}

/**
 * Hook for managing roving tabindex pattern
 */
export function useRovingTabindex(initialIndex = 0) {
	const [activeIndex, setActiveIndex] = useState(initialIndex);
	const itemRefs = useRef<(HTMLElement | null)[]>([]);

	const registerItem = useCallback(
		(index: number) => {
			return (element: HTMLElement | null) => {
				itemRefs.current[index] = element;

				if (element) {
					// Set initial tabindex
					element.tabIndex = index === activeIndex ? 0 : -1;
				}
			};
		},
		[activeIndex],
	);

	const setActiveItem = useCallback((index: number) => {
		// Update tabindex for all items
		itemRefs.current.forEach((item, i) => {
			if (item) {
				item.tabIndex = i === index ? 0 : -1;
			}
		});

		setActiveIndex(index);

		// Focus the active item
		itemRefs.current[index]?.focus();
	}, []);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent, currentIndex: number) => {
			const itemCount = itemRefs.current.length;

			switch (event.key) {
				case "ArrowRight":
				case "ArrowDown":
					event.preventDefault();
					setActiveItem((currentIndex + 1) % itemCount);
					break;

				case "ArrowLeft":
				case "ArrowUp":
					event.preventDefault();
					setActiveItem((currentIndex - 1 + itemCount) % itemCount);
					break;

				case "Home":
					event.preventDefault();
					setActiveItem(0);
					break;

				case "End":
					event.preventDefault();
					setActiveItem(itemCount - 1);
					break;
			}
		},
		[setActiveItem],
	);

	return {
		activeIndex,
		registerItem,
		setActiveItem,
		handleKeyDown,
	};
}

/**
 * Hook for managing focus trap
 */
export function useFocusTrap(isActive = true) {
	const containerRef = useRef<HTMLElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!isActive || !containerRef.current) return;

		const container = containerRef.current;

		// Store the previously focused element
		previousFocusRef.current = document.activeElement as HTMLElement;

		// Get all focusable elements within the container
		const focusableElements = container.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		) as NodeListOf<HTMLElement>;

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		// Focus the first element
		firstElement?.focus();

		const handleTabKey = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;

			if (event.shiftKey) {
				// Shift + Tab
				if (document.activeElement === firstElement) {
					event.preventDefault();
					lastElement?.focus();
				}
			} else {
				// Tab
				if (document.activeElement === lastElement) {
					event.preventDefault();
					firstElement?.focus();
				}
			}
		};

		const handleEscapeKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				// Return focus to previously focused element
				previousFocusRef.current?.focus();
			}
		};

		document.addEventListener("keydown", handleTabKey);
		document.addEventListener("keydown", handleEscapeKey);

		return () => {
			document.removeEventListener("keydown", handleTabKey);
			document.removeEventListener("keydown", handleEscapeKey);

			// Restore focus when trap is deactivated
			if (previousFocusRef.current) {
				previousFocusRef.current.focus();
			}
		};
	}, [isActive]);

	return containerRef;
}

/**
 * Hook for skip links functionality
 */
export function useSkipLinks() {
	const skipLinksRef = useRef<HTMLElement>(null);
	const [skipTargets, setSkipTargets] = useState<
		Array<{
			id: string;
			label: string;
			element: HTMLElement;
		}>
	>([]);

	const registerSkipTarget = useCallback(
		(id: string, label: string, element: HTMLElement) => {
			setSkipTargets((prev) => {
				const existing = prev.find((target) => target.id === id);
				if (existing) {
					return prev.map((target) =>
						target.id === id ? { id, label, element } : target,
					);
				}
				return [...prev, { id, label, element }];
			});
		},
		[],
	);

	const unregisterSkipTarget = useCallback((id: string) => {
		setSkipTargets((prev) => prev.filter((target) => target.id !== id));
	}, []);

	const skipTo = useCallback(
		(targetId: string) => {
			const target = skipTargets.find((t) => t.id === targetId);
			if (target) {
				target.element.focus();
				target.element.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		},
		[skipTargets],
	);

	return {
		skipLinksRef,
		skipTargets,
		registerSkipTarget,
		unregisterSkipTarget,
		skipTo,
	};
}

export default useKeyboardNavigation;

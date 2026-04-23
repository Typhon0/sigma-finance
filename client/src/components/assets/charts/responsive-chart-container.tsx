/**
 * Responsive chart container for mobile and dashboard optimization
 * Handles responsive sizing, touch interactions, and mobile-specific optimizations
 */

import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CHART_BREAKPOINTS, getResponsiveChartSize } from "@/lib/charts/config";
import { cn } from "@/lib/utils";

/**
 * Responsive container props
 */
export interface ResponsiveChartContainerProps {
	children: React.ReactNode;
	aspectRatio?: number;
	minHeight?: number;
	maxHeight?: number;
	className?: string;
	enableFullscreen?: boolean;
	enableRotation?: boolean;
	onResize?: (dimensions: { width: number; height: number }) => void;
}

/**
 * Touch gesture interface
 */
interface TouchGesture {
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	deltaX: number;
	deltaY: number;
	scale: number;
	rotation: number;
}

/**
 * Responsive chart container component
 */
export function ResponsiveChartContainer({
	children,
	aspectRatio = 16 / 9,
	minHeight = 200,
	maxHeight = 600,
	className,
	enableFullscreen = true,
	enableRotation = false,
	onResize,
}: ResponsiveChartContainerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isLandscape, setIsLandscape] = useState(false);
	const [touchGesture, setTouchGesture] = useState<TouchGesture | null>(null);

	// Handle container resize
	const handleResize = useCallback(() => {
		if (!containerRef.current) return;

		const containerWidth = containerRef.current.clientWidth;
		const newDimensions = getResponsiveChartSize(containerWidth, aspectRatio);

		// Apply min/max height constraints
		newDimensions.height = Math.max(minHeight, Math.min(maxHeight, newDimensions.height));

		setDimensions(newDimensions);
		onResize?.(newDimensions);
	}, [aspectRatio, minHeight, maxHeight, onResize]);

	// Set up resize observer
	useEffect(() => {
		if (!containerRef.current) return;

		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(containerRef.current);

		// Initial resize
		handleResize();

		return () => {
			resizeObserver.disconnect();
		};
	}, [handleResize]);

	// Handle orientation change
	useEffect(() => {
		const handleOrientationChange = () => {
			// Delay to allow for orientation change to complete
			setTimeout(() => {
				handleResize();
				setIsLandscape(window.innerWidth > window.innerHeight);
			}, 100);
		};

		window.addEventListener("orientationchange", handleOrientationChange);
		window.addEventListener("resize", handleOrientationChange);

		// Initial check
		setIsLandscape(window.innerWidth > window.innerHeight);

		return () => {
			window.removeEventListener("orientationchange", handleOrientationChange);
			window.removeEventListener("resize", handleOrientationChange);
		};
	}, [handleResize]);

	// Touch gesture handlers
	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		if (e.touches.length === 1) {
			const touch = e.touches[0];
			setTouchGesture({
				startX: touch.clientX,
				startY: touch.clientY,
				currentX: touch.clientX,
				currentY: touch.clientY,
				deltaX: 0,
				deltaY: 0,
				scale: 1,
				rotation: 0,
			});
		}
	}, []);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (!touchGesture || e.touches.length !== 1) return;

			const touch = e.touches[0];
			setTouchGesture((prev) =>
				prev
					? {
							...prev,
							currentX: touch.clientX,
							currentY: touch.clientY,
							deltaX: touch.clientX - prev.startX,
							deltaY: touch.clientY - prev.startY,
						}
					: null,
			);
		},
		[touchGesture],
	);

	const handleTouchEnd = useCallback(() => {
		setTouchGesture(null);
	}, []);

	// Fullscreen handlers
	const handleToggleFullscreen = useCallback(() => {
		if (!containerRef.current) return;

		if (!isFullscreen) {
			if (containerRef.current.requestFullscreen) {
				containerRef.current.requestFullscreen();
			}
		} else {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			}
		}
	}, [isFullscreen]);

	// Listen for fullscreen changes
	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	// Handle rotation
	const handleRotate = useCallback(() => {
		setIsLandscape((prev) => !prev);
		// Trigger resize after rotation
		setTimeout(handleResize, 100);
	}, [handleResize]);

	// Get responsive classes
	const getResponsiveClasses = () => {
		const classes: string[] = [];

		if (dimensions.width < CHART_BREAKPOINTS.sm) {
			classes.push("chart-xs");
		} else if (dimensions.width < CHART_BREAKPOINTS.md) {
			classes.push("chart-sm");
		} else if (dimensions.width < CHART_BREAKPOINTS.lg) {
			classes.push("chart-md");
		} else {
			classes.push("chart-lg");
		}

		if (isLandscape) {
			classes.push("chart-landscape");
		} else {
			classes.push("chart-portrait");
		}

		if (isFullscreen) {
			classes.push("chart-fullscreen");
		}

		return classes.join(" ");
	};

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative w-full",
				"touch-manipulation", // Optimize for touch
				getResponsiveClasses(),
				className,
			)}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			style={{
				width: "100%",
				height: dimensions.height,
				transform: isLandscape && enableRotation ? "rotate(90deg)" : undefined,
				transformOrigin: "center",
			}}
		>
			{/* Chart Controls */}
			<div className="absolute top-2 right-2 z-10 flex gap-1">
				{enableRotation && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm"
						onClick={handleRotate}
					>
						<RotateCcw className="h-3 w-3" />
					</Button>
				)}

				{enableFullscreen && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm"
						onClick={handleToggleFullscreen}
					>
						{isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
					</Button>
				)}
			</div>

			{/* Chart Content */}
			<div
				className="w-full h-full"
				style={{
					width: dimensions.width,
					height: dimensions.height,
				}}
			>
				{children}
			</div>

			{/* Touch Gesture Indicator */}
			{touchGesture && (
				<div
					className="absolute pointer-events-none bg-blue-500/20 border-2 border-blue-500 rounded"
					style={{
						left: Math.min(touchGesture.startX, touchGesture.currentX),
						top: Math.min(touchGesture.startY, touchGesture.currentY),
						width: Math.abs(touchGesture.deltaX),
						height: Math.abs(touchGesture.deltaY),
					}}
				/>
			)}
		</div>
	);
}

/**
 * Mobile-optimized chart wrapper
 */
export function MobileChartContainer({
	children,
	className,
	...props
}: ResponsiveChartContainerProps) {
	return (
		<ResponsiveChartContainer
			{...props}
			className={cn(
				// Mobile-specific optimizations
				"select-none", // Prevent text selection
				"overscroll-none", // Prevent overscroll
				"touch-pan-x touch-pan-y", // Enable panning
				className,
			)}
			aspectRatio={4 / 3} // Better for mobile
			minHeight={150}
			maxHeight={400}
		>
			{children}
		</ResponsiveChartContainer>
	);
}

/**
 * Dashboard inline chart container
 */
export function DashboardChartContainer({
	children,
	className,
	...props
}: ResponsiveChartContainerProps) {
	return (
		<ResponsiveChartContainer
			{...props}
			className={cn("rounded-lg border bg-card", className)}
			aspectRatio={16 / 9}
			minHeight={200}
			maxHeight={300}
			enableFullscreen={false}
		>
			{children}
		</ResponsiveChartContainer>
	);
}

/**
 * Hook for responsive chart dimensions
 */
export function useResponsiveChartDimensions(
	containerRef: React.RefObject<HTMLElement>,
	aspectRatio: number = 16 / 9,
) {
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	useEffect(() => {
		if (!containerRef.current) return;

		const updateDimensions = () => {
			if (!containerRef.current) return;

			const containerWidth = containerRef.current.clientWidth;
			const newDimensions = getResponsiveChartSize(containerWidth, aspectRatio);
			setDimensions(newDimensions);
		};

		const resizeObserver = new ResizeObserver(updateDimensions);
		resizeObserver.observe(containerRef.current);

		// Initial update
		updateDimensions();

		return () => {
			resizeObserver.disconnect();
		};
	}, [aspectRatio, containerRef.current.clientWidth, containerRef.current]);

	return dimensions;
}

/**
 * CSS classes for responsive chart styling
 */
export const RESPONSIVE_CHART_STYLES = `
  .chart-xs {
    --chart-font-size: 10px;
    --chart-padding: 8px;
    --chart-border-radius: 4px;
  }
  
  .chart-sm {
    --chart-font-size: 11px;
    --chart-padding: 12px;
    --chart-border-radius: 6px;
  }
  
  .chart-md {
    --chart-font-size: 12px;
    --chart-padding: 16px;
    --chart-border-radius: 8px;
  }
  
  .chart-lg {
    --chart-font-size: 14px;
    --chart-padding: 20px;
    --chart-border-radius: 10px;
  }
  
  .chart-landscape {
    --chart-aspect-ratio: 16/9;
  }
  
  .chart-portrait {
    --chart-aspect-ratio: 4/3;
  }
  
  .chart-fullscreen {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 9999 !important;
    background: var(--background) !important;
  }
`;

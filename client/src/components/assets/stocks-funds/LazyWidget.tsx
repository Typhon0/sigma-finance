import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ui/error-boundary";

export function WidgetErrorFallback({ height, onRetry }: { height: number; onRetry: () => void }) {
	return (
		<div
			className="flex flex-col items-center justify-center bg-muted/10 rounded-lg border border-border/30 p-4 text-center"
			style={{ minHeight: height }}
		>
			<AlertTriangle className="h-6 w-6 text-warning mb-2" />
			<p className="text-xs font-medium text-foreground">Widget temporarily unavailable</p>
			<p className="text-micro text-muted-foreground mt-0.5 mb-3">
				Failed to load TradingView component
			</p>
			<Button variant="outline" size="sm" onClick={onRetry} className="h-7 text-xs">
				Retry
			</Button>
		</div>
	);
}

/** Wraps a lazy TradingView widget with intersection observer to defer loading. */
export function LazyWidget({ children, height = 400 }: { children: ReactNode; height?: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (typeof IntersectionObserver === "undefined") {
			setVisible(true);
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "200px" }, // preload 200px before visible
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={ref} style={{ minHeight: height }}>
			{visible ? (
				<ErrorBoundary
					fallback={({ resetErrorBoundary }) => (
						<WidgetErrorFallback height={height} onRetry={resetErrorBoundary} />
					)}
				>
					<Suspense
						fallback={
							<div
								className="flex items-center justify-center bg-muted/20 rounded-lg border border-border/30"
								style={{ height }}
							>
								<div className="flex flex-col items-center gap-3">
									<div className="h-6 w-6 animate-spin rounded-full border-2 border-gain border-t-transparent" />
									<p className="text-xs text-muted-foreground">Loading widget…</p>
								</div>
							</div>
						}
					>
						{children}
					</Suspense>
				</ErrorBoundary>
			) : (
				<div
					className="flex items-center justify-center bg-muted/10 rounded-lg border border-border/20"
					style={{ height }}
				/>
			)}
		</div>
	);
}

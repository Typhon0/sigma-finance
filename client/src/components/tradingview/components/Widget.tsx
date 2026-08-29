import type React from "react";
import { useEffect, useRef, useState } from "react";
import Copyright, { type CopyrightProps } from "./Copyright";

interface WidgetProps {
	scriptHTML: unknown;
	scriptSRC: string;
	containerId?: string;
	type?: "Widget" | "MediumWidget";
	copyrightProps: CopyrightProps;
	/** If true, defer loading until the widget scrolls into (or near) the viewport. Defaults to true. */
	lazy?: boolean;
	/** IntersectionObserver rootMargin for preloading. Defaults to "200px" (load 200px before visible). */
	lazyMargin?: string;
}

declare const TradingView: any;

/**
 * Tracks which TradingView script URLs have been loaded or are loading.
 * Prevents duplicate <script> tags when multiple widgets use the same JS bundle
 * (e.g., all non-chart widgets use embed-widget-*.js from s3.tradingview.com).
 */
const scriptLoadState = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
	const existing = scriptLoadState.get(src);
	if (existing) return existing;

	const promise = new Promise<void>((resolve, reject) => {
		// Check if already in DOM (e.g., from a previous mount cycle)
		const existingScript = document.querySelector(`script[src="${src}"]`);
		if (existingScript) {
			resolve();
			return;
		}

		const script = document.createElement("script");
		script.src = src;
		script.async = true;
		script.type = "text/javascript";
		script.onload = () => resolve();
		script.onerror = () => reject(new Error(`Failed to load TradingView script: ${src}`));
		document.head.appendChild(script);
	});

	scriptLoadState.set(src, promise);
	return promise;
}

const Widget: React.FC<WidgetProps> = ({
	scriptHTML,
	scriptSRC,
	containerId,
	type,
	copyrightProps,
	lazy = true,
	lazyMargin = "200px",
}) => {
	const ref = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(!lazy);

	// IntersectionObserver for lazy loading
	useEffect(() => {
		if (!lazy || isVisible) return;

		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{ rootMargin: lazyMargin },
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [lazy, isVisible, lazyMargin]);

	// Widget initialization — only runs after visible
	useEffect(() => {
		if (!isVisible) return;

		let refValue: HTMLDivElement;
		let cancelled = false;

		const initWidget = async () => {
			if (!ref.current || cancelled) return;

			if (type === "Widget" || type === "MediumWidget") {
				// For Widget/MediumWidget types, we need the TradingView global.
				// Load the script into <head> once, then instantiate.
				try {
					await loadScript(scriptSRC);
				} catch {
					return;
				}
				if (cancelled || !ref.current) return;

				if (typeof TradingView !== "undefined") {
					if (type === "Widget") {
						new TradingView.widget(scriptHTML);
					} else {
						new TradingView.MediumWidget(scriptHTML);
					}
				}
			} else {
				// For embed widgets, the script must be a child of the container
				// with its config as innerHTML (TradingView reads it from DOM).
				const script = document.createElement("script");
				script.src = scriptSRC;
				script.async = true;
				script.type = "text/javascript";
				script.innerHTML = JSON.stringify(scriptHTML);
				ref.current.appendChild(script);
			}

			refValue = ref.current;
		};

		// Stagger initialization slightly to avoid all widgets firing at once
		const raf = requestAnimationFrame(() => {
			initWidget();
		});

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			if (refValue) {
				while (refValue.firstChild) {
					refValue.removeChild(refValue.firstChild);
				}
			}
		};
	}, [isVisible, scriptHTML, type, scriptSRC]);

	const containerKey = containerId || "tradingview_" + scriptHTML;

	// Placeholder shown while waiting for intersection
	if (!isVisible) {
		return (
			<div ref={sentinelRef} style={{ minHeight: 100 }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						height: 100,
						opacity: 0.4,
						fontSize: 13,
						fontFamily: "Trebuchet MS, Arial, sans-serif",
						color: "#9db2bd",
					}}
				>
					Loading widget…
				</div>
			</div>
		);
	}

	return (
		<div style={{ display: "contents" }}>
			{type === "Widget" || type === "MediumWidget" ? (
				<div id={containerId} key={containerKey}>
					<div ref={ref} style={{ display: "contents" }} />
				</div>
			) : (
				<div ref={ref} style={{ display: "contents" }} key={containerKey} />
			)}
			<Copyright
				href={copyrightProps.href}
				spanText={copyrightProps.spanText}
				text={copyrightProps.text}
				copyrightStyles={copyrightProps.copyrightStyles}
			/>
		</div>
	);
};

export default Widget;

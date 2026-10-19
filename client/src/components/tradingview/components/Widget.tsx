import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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

	// Stable identity for the TradingView config.
	//
	// Every wrapper component builds `scriptHTML` as an inline object literal, so
	// its reference changes on every render. Depending on it directly re-ran the
	// init effect below on every render, and the cleanup wipes the container's
	// children - so each parent re-render destroyed the live widget and booted a
	// replacement (leaking TradingView's own internal state each time).
	//
	// TradingView configs are plain JSON (the embed path below already relies on
	// that with JSON.stringify), so the serialized form is a safe identity: an
	// unchanged config no longer churns the widget, while a real config change
	// still triggers a clean re-initialization.
	const scriptHTMLKey = useMemo(() => JSON.stringify(scriptHTML), [scriptHTML]);

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
	//
	// The dependency list uses `scriptHTMLKey` in place of `scriptHTML` on
	// purpose: the effect must re-run when the *configuration* changes, not when
	// the wrapper component hands us a fresh object literal with identical
	// contents. Keying on the object identity tore down and rebuilt the live
	// widget on every parent render.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
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
			if (containerId) {
				const container = document.getElementById(containerId);
				if (container) {
					while (container.firstChild) {
						container.removeChild(container.firstChild);
					}
				}
			}
			if (refValue) {
				while (refValue.firstChild) {
					refValue.removeChild(refValue.firstChild);
				}
			}
		};
	}, [isVisible, scriptHTMLKey, type, scriptSRC, containerId]);

	const containerKey = containerId || scriptHTMLKey;

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

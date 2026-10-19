import "@testing-library/jest-dom";
import { render, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Studies } from "../tradingview";
import AdvancedRealTimeChart from "../tradingview/components/AdvancedRealTimeChart";
import SymbolOverview from "../tradingview/components/SymbolOverview";

/**
 * F-13: the TradingView container id used to be a *default parameter*
 * (`container_id = \`tradingview_${createId(5)}\``), which re-evaluates on every
 * render. `Widget` keys both its effect dependencies and the React `key` of its
 * container div on that id, so any re-render of the wrapped component destroyed
 * the live widget and booted a new one against a fresh DOM node.
 *
 * The companion fix in `Widget.tsx` keys the init effect on the serialized
 * script config: `scriptHTML` is an inline object literal, so its reference
 * changes on every render even when the configuration is byte-identical.
 *
 * Note the trigger: the wrappers are `memo`ized, so a parent re-render that
 * passes identical primitive props is skipped entirely and the bug does not
 * fire. These tests therefore re-render with a *new array identity* holding the
 * same contents, which is what real callers do.
 */

const SCRIPT_SRC = "https://s3.tradingview.com/tv.js";
const widgetSpy = vi.fn();

/**
 * `Widget` defers loading behind an IntersectionObserver that jsdom does not
 * implement. This stub reports the sentinel as intersecting on `observe`, so
 * the widget takes its visible branch and renders its real container div.
 */
class ImmediateIntersectionObserver {
	constructor(private readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void) {}
	observe() {
		this.callback([{ isIntersecting: true }]);
	}
	unobserve() {}
	disconnect() {}
	// biome-ignore lint/suspicious/noExplicitAny: test stub
	takeRecords(): any[] {
		return [];
	}
}

beforeAll(() => {
	// `loadScript` short-circuits when the tag is already in the document, which
	// is the only way to make the async load resolve under jsdom.
	const tag = document.createElement("script");
	tag.src = SCRIPT_SRC;
	document.head.appendChild(tag);
});

beforeEach(() => {
	widgetSpy.mockClear();
	// biome-ignore lint/suspicious/noExplicitAny: test stub for a third-party global
	(globalThis as any).IntersectionObserver = ImmediateIntersectionObserver;
	// biome-ignore lint/suspicious/noExplicitAny: test stub for a third-party global
	(globalThis as any).TradingView = { widget: widgetSpy, MediumWidget: widgetSpy };
});

/** A fresh array with identical contents - new identity, same config. */
function newStudies(): Studies[] {
	return [];
}

describe("TradingView widget identity (F-13)", () => {
	it("keeps the same container id across re-renders", async () => {
		const Host = ({ tick }: { tick: number }) => (
			<div>
				<AdvancedRealTimeChart symbol="NASDAQ:AAPL" studies={newStudies()} />
				<span>{tick}</span>
			</div>
		);

		const view = render(<Host tick={0} />);
		const firstId = view.container.querySelector("div[id^='tradingview_']")?.id;
		expect(firstId).toBeTruthy();

		view.rerender(<Host tick={1} />);
		view.rerender(<Host tick={2} />);

		const nodes = view.container.querySelectorAll("div[id^='tradingview_']");
		expect(nodes).toHaveLength(1);
		expect(nodes[0].id).toBe(firstId);
	});

	it("does not re-instantiate the widget when the config is unchanged", async () => {
		const Host = ({ tick }: { tick: number }) => (
			<div>
				<AdvancedRealTimeChart symbol="NASDAQ:AAPL" studies={newStudies()} />
				<span>{tick}</span>
			</div>
		);

		const view = render(<Host tick={0} />);
		await waitFor(() => expect(widgetSpy).toHaveBeenCalledTimes(1));

		view.rerender(<Host tick={1} />);
		view.rerender(<Host tick={2} />);

		// The bug destroyed and rebuilt the live widget on each of these renders.
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(widgetSpy).toHaveBeenCalledTimes(1);
	});

	it("still re-initializes when the configuration actually changes", async () => {
		const Host = ({ symbol }: { symbol: string }) => (
			<div>
				<AdvancedRealTimeChart symbol={symbol} studies={newStudies()} />
			</div>
		);

		const view = render(<Host symbol="NASDAQ:AAPL" />);
		await waitFor(() => expect(widgetSpy).toHaveBeenCalledTimes(1));

		view.rerender(<Host symbol="NASDAQ:MSFT" />);
		await waitFor(() => expect(widgetSpy).toHaveBeenCalledTimes(2));
	});

	it("honours an explicit container_id and keeps it stable", () => {
		const Host = ({ tick }: { tick: number }) => (
			<div>
				<AdvancedRealTimeChart
					symbol="NASDAQ:AAPL"
					container_id="tv_fixed_id"
					studies={newStudies()}
				/>
				<span>{tick}</span>
			</div>
		);

		const view = render(<Host tick={0} />);
		expect(view.container.querySelector("#tv_fixed_id")).toBeTruthy();

		view.rerender(<Host tick={1} />);
		view.rerender(<Host tick={2} />);
		expect(view.container.querySelectorAll("#tv_fixed_id")).toHaveLength(1);
	});

	it("keeps SymbolOverview container ids stable too", () => {
		const Host = ({ tick }: { tick: number }) => (
			<div>
				<SymbolOverview
					symbols={[["NASDAQ", "AAPL"]]}
					dateFormat={"DD MMM 'YY"}
					colorTheme="light"
					studies={newStudies()}
				/>
				<span>{tick}</span>
			</div>
		);

		const view = render(<Host tick={0} />);
		const firstId = view.container.querySelector("div[id^='tradingview_']")?.id;
		expect(firstId).toBeTruthy();

		view.rerender(<Host tick={1} />);
		expect(view.container.querySelectorAll("div[id^='tradingview_']")).toHaveLength(1);
		expect(view.container.querySelector("div[id^='tradingview_']")?.id).toBe(firstId);
	});
});

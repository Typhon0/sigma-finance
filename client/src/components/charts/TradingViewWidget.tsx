import { memo, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@/components/theme-provider";

interface TradingViewWidgetProps {
	symbol?: string;
	theme?: "light" | "dark";
	height?: number | string;
}

function TradingViewWidget({ symbol, theme: customTheme, height = 400 }: TradingViewWidgetProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const { resolvedTheme } = useTheme();
	const theme = customTheme || resolvedTheme;

	const symbolsList = useMemo(() => {
		if (symbol) {
			const cleanSymbolName = symbol.includes(":") ? symbol.split(":")[1] : symbol;
			const cleanSymbolQuery = symbol.includes("|") ? symbol : `${symbol}|1D`;
			return [[cleanSymbolName, cleanSymbolQuery]];
		}
		return [
			["Apple", "NASDAQ:AAPL|1D"],
			["Google", "NASDAQ:GOOGL|1D"],
			["Microsoft", "NASDAQ:MSFT|1D"],
		];
	}, [symbol]);

	useEffect(() => {
		if (!containerRef.current) return;

		// Clear container to prevent duplicate widgets on mount/Strict Mode
		containerRef.current.innerHTML = "";

		// Create widget element
		const widgetDiv = document.createElement("div");
		widgetDiv.className = "tradingview-widget-container__widget";
		containerRef.current.appendChild(widgetDiv);

		const script = document.createElement("script");
		script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
		script.type = "text/javascript";
		script.async = true;

		const config = {
			lineWidth: 2,
			lineType: 0,
			chartType: "candlesticks",
			fontColor: "rgb(106, 109, 120)",
			gridLineColor: theme === "dark" ? "rgba(242, 242, 242, 0.06)" : "rgba(0, 0, 0, 0.06)",
			volumeUpColor: "rgba(34, 171, 148, 0.5)",
			volumeDownColor: "rgba(247, 82, 95, 0.5)",
			backgroundColor: theme === "dark" ? "#09090b" : "#ffffff",
			widgetFontColor: theme === "dark" ? "#DBDBDB" : "#1A1A1A",
			upColor: "#22ab94",
			downColor: "#f7525f",
			borderUpColor: "#22ab94",
			borderDownColor: "#f7525f",
			wickUpColor: "#22ab94",
			wickDownColor: "#f7525f",
			colorTheme: theme,
			isTransparent: true,
			locale: "en",
			chartOnly: false,
			scalePosition: "right",
			scaleMode: "Normal",
			fontFamily: "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
			valuesTracking: "1",
			changeMode: "price-and-percent",
			symbols: symbolsList,
			dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
			fontSize: "10",
			headerFontSize: "medium",
			autosize: true,
			width: "100%",
			height: "100%",
			noTimeScale: false,
			hideDateRanges: false,
			hideMarketStatus: false,
			hideSymbolLogo: false,
		};

		script.innerHTML = JSON.stringify(config);
		containerRef.current.appendChild(script);

		// Create copyright element
		const copyrightDiv = document.createElement("div");
		copyrightDiv.className =
			"tradingview-widget-copyright text-xs text-muted-foreground mt-2 text-center";

		if (symbol) {
			const cleanSymbolName = symbol.includes(":") ? symbol.split(":")[1] : symbol;
			const cleanSymbolQuery = symbol.includes("|") ? symbol : `${symbol}|1D`;
			const tvSymbolPath = cleanSymbolQuery.split("|")[0].replace(":", "-");

			const link = document.createElement("a");
			link.href = `https://www.tradingview.com/symbols/${tvSymbolPath}/`;
			link.rel = "noopener nofollow";
			link.target = "_blank";
			link.className = "text-primary hover:underline";

			const span = document.createElement("span");
			span.innerText = cleanSymbolName;
			link.appendChild(span);

			copyrightDiv.appendChild(link);
			const labelNode = document.createTextNode(" stock price by TradingView");
			copyrightDiv.appendChild(labelNode);
		} else {
			const aaplLink = document.createElement("a");
			aaplLink.href = "https://www.tradingview.com/symbols/NASDAQ-AAPL/";
			aaplLink.rel = "noopener nofollow";
			aaplLink.target = "_blank";
			aaplLink.className = "text-primary hover:underline";
			aaplLink.innerText = "Apple";

			const googlLink = document.createElement("a");
			googlLink.href = "https://www.tradingview.com/symbols/NASDAQ-GOOGL/";
			googlLink.rel = "noopener nofollow";
			googlLink.target = "_blank";
			googlLink.className = "text-primary hover:underline";
			googlLink.innerText = "Google";

			const msftLink = document.createElement("a");
			msftLink.href = "https://www.tradingview.com/symbols/NASDAQ-MSFT/";
			msftLink.rel = "noopener nofollow";
			msftLink.target = "_blank";
			msftLink.className = "text-primary hover:underline";
			msftLink.innerText = "Microsoft stock price";

			copyrightDiv.appendChild(aaplLink);
			copyrightDiv.appendChild(document.createTextNode(", "));
			copyrightDiv.appendChild(googlLink);
			copyrightDiv.appendChild(document.createTextNode(", and "));
			copyrightDiv.appendChild(msftLink);
			copyrightDiv.appendChild(document.createTextNode(" by TradingView"));
		}

		containerRef.current.appendChild(copyrightDiv);

		return () => {
			if (containerRef.current) {
				containerRef.current.innerHTML = "";
			}
		};
	}, [symbolsList, theme, symbol]);

	const heightStyle = typeof height === "number" ? `${height}px` : height;

	return (
		<div
			className="tradingview-widget-container w-full"
			ref={containerRef}
			style={{ height: heightStyle }}
		/>
	);
}

export default memo(TradingViewWidget);

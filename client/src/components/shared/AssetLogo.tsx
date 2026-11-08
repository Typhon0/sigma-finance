import type React from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import bundledLogos from "./bundled-logos.json";

export const TERMINAL_PALETTE = [
	"#38BDF8", // sky
	"#34D399", // emerald
	"#FBBF24", // amber
	"#A78BFA", // purple
	"#F472B6", // pink
	"#60A5FA", // blue
	"#2DD4BF", // teal
	"#FB923C", // orange
	"#818CF8", // indigo
	"#E879F9", // fuchsia
];

export const CRYPTO_BRAND_COLORS: Record<string, string> = {
	BTC: "#F7931A",
	ETH: "#627EEA",
	BNB: "#F3BA2F",
	SOL: "#14F195",
	XRP: "#23292F",
	ADA: "#0033AD",
	DOGE: "#C2A633",
	DOT: "#E6007A",
	MATIC: "#8247E5",
	LINK: "#2A5ADA",
	AVAX: "#E84142",
	UNI: "#FF007A",
	USDT: "#26A17B",
	USDC: "#2775CA",
	SUI: "#4CA2FF",
	AAVE: "#B6509E",
	FLR: "#EA3A54",
	XLM: "#14B6EB",
	FIL: "#0090FF",
	NEAR: "#000000",
	APT: "#24292E",
	ARB: "#28A0F0",
	OP: "#FF0420",
	TIA: "#7B2BF9",
	SEI: "#A81E29",
	TAO: "#1F2327",
	JUP: "#28D394",
	WIF: "#B78A58",
	BONK: "#F2802B",
	PEPE: "#41993C",
	RNDR: "#E53935",
};

export const KRAKEN_CRYPTO_ALIASES: Record<string, string> = {
	XDG: "DOGE",
	XXBT: "BTC",
	XBT: "BTC",
	XETH: "ETH",
	XXLM: "XLM",
	XXRP: "XRP",
	XLTC: "LTC",
	XETC: "ETC",
	XMLN: "MLN",
	XREP: "REP",
	XZEC: "ZEC",
	ZUSD: "USD",
	ZEUR: "EUR",
	ZGBP: "GBP",
	ZCAD: "CAD",
	ZJPY: "JPY",
};

export const FIAT_CURRENCY_COLORS: Record<string, string> = {
	EUR: "#003399",
	USD: "#0A5C36",
	GBP: "#C8102E",
	CHF: "#D52B1E",
	JPY: "#BC002D",
	CAD: "#FF0000",
	AUD: "#00843D",
	DKK: "#C60C30",
	SEK: "#006AA7",
	NOK: "#BA0C2F",
	CASH: "#2563EB",
};

export const FIAT_CURRENCY_SYMBOLS: Record<string, string> = {
	EUR: "€",
	USD: "$",
	GBP: "£",
	CHF: "₣",
	JPY: "¥",
	CAD: "$",
	AUD: "$",
	DKK: "kr",
	SEK: "kr",
	NOK: "kr",
};

export type AssetLogoSize = "xs" | "sm" | "md" | "lg";
export type AssetType = "crypto" | "stock" | "fund" | "cash";

const SIZE_CLASSES: Record<AssetLogoSize, { container: string; text: string }> = {
	xs: { container: "h-5 w-5", text: "text-[10px]" },
	sm: { container: "h-6 w-6", text: "text-[10.5px]" },
	md: { container: "h-8 w-8", text: "text-xs" },
	lg: { container: "h-10 w-10", text: "text-sm" },
};

/**
 * Robust normalization for asset symbols across Kraken, DEXes, and stock exchanges.
 * Aggressively strips derivative/wrapper/bridge labels so users see the familiar native brand.
 */
export function cleanAssetSymbol(
	rawSymbol: string,
	rawName?: string,
	assetType: AssetType = "stock",
): string {
	let sym = (rawSymbol || "").trim().toUpperCase();
	if (!sym && rawName) {
		sym = rawName.trim().toUpperCase();
	}
	if (!sym) return "";

	// 0. Handle synthetic and standard cash/currency symbols (EUR_CASH_uuid -> EUR, CASH_USD -> USD, CASH -> CASH)
	const cashMatch = sym.match(/^([A-Z]{3,4})_CASH(?:_[A-F0-9-]+)?$/i);
	if (cashMatch) {
		return cashMatch[1].toUpperCase();
	}
	if (sym.startsWith("CASH_") || sym === "CASH") {
		const suffixMatch = sym.match(/^CASH_([A-Z]{3,4})/i);
		return suffixMatch ? suffixMatch[1].toUpperCase() : "CASH";
	}

	// 1. Kraken alias mapping (e.g. XDG -> DOGE, XXLM -> XLM)
	if (assetType === "crypto" && KRAKEN_CRYPTO_ALIASES[sym]) {
		return KRAKEN_CRYPTO_ALIASES[sym];
	}

	// 2. Strip trading pair suffixes for crypto (e.g. BTC/USD, BTC-USD)
	let clean = sym;
	if (assetType === "crypto") {
		clean = sym.split(/[-/]/)[0].trim();
	} else if (clean.includes("/")) {
		// Only strip exchange currency pair if separated by slash (e.g. AAPL/USD), never dash (NOVO-B.CO, BRK-B)
		clean = clean.split("/")[0].trim();
	}

	if (assetType === "crypto") {
		const lowerName = (rawName || "").toLowerCase();
		const lowerSym = sym.toLowerCase();

		// Check name or symbol for wrapped/portal tokens
		if (
			lowerName.includes("usd coin") ||
			lowerName.includes("usd-coin") ||
			lowerSym.includes("usdc")
		) {
			return "USDC";
		}
		if (lowerName.includes("tether") || lowerSym.includes("usdt")) {
			return "USDT";
		}
		if (lowerName.includes("sol (portal)") || lowerSym.includes("sol (portal)")) {
			return "SOL";
		}
		if (lowerName.includes("aave token (portal)") || lowerName.includes("aave token")) {
			return "AAVE";
		}
		if (lowerName.includes("dogecoin") || lowerSym.includes("doge")) {
			return "DOGE";
		}
		if (lowerName.includes("stellar") || lowerSym.includes("xlm")) {
			return "XLM";
		}
		if (lowerName.includes("filecoin") || lowerSym.includes("fil")) {
			return "FIL";
		}
		if (lowerName.includes("flare") || lowerSym.includes("flr")) {
			return "FLR";
		}

		// Strip wrapped prefix: WETH -> ETH, WBTC -> BTC, WSOL -> SOL
		if (/^W(ETH|BTC|SOL|AVAX|MATIC|BNB|ADA|DOT|NEAR|FTM)$/i.test(clean)) {
			clean = clean.slice(1);
		}

		// Strip bridge tags: (portal), portal, wormhole, bridged, peg
		clean = clean.replace(/[\s_(-]*(PORTAL|WORMHOLE|BRIDGED|PEG)[)\s_-]*/gi, "").trim();
	}

	return clean;
}

export function getDeterministicColor(symbol: string, assetType: AssetType = "stock"): string {
	const clean = cleanAssetSymbol(symbol, undefined, assetType);
	if (!clean) return "#64748B";
	if (assetType === "crypto" && CRYPTO_BRAND_COLORS[clean]) {
		return CRYPTO_BRAND_COLORS[clean];
	}
	if (FIAT_CURRENCY_COLORS[clean]) {
		return FIAT_CURRENCY_COLORS[clean];
	}
	let hash = 0;
	for (let i = 0; i < clean.length; i++) {
		hash = (hash << 5) - hash + clean.charCodeAt(i);
		hash |= 0;
	}
	const index = Math.abs(hash) % TERMINAL_PALETTE.length;
	return TERMINAL_PALETTE[index];
}

export function getMonogramText(symbol: string, maxChars = 1): string {
	const clean = cleanAssetSymbol(symbol);
	if (!clean) return "?";
	if (FIAT_CURRENCY_SYMBOLS[clean]) {
		return FIAT_CURRENCY_SYMBOLS[clean];
	}
	return clean.slice(0, maxChars);
}

export interface AssetMonogramProps {
	symbol: string;
	assetType?: AssetType;
	size?: AssetLogoSize;
	className?: string;
	maxChars?: number;
}

export const AssetMonogram = memo(function AssetMonogram({
	symbol,
	assetType = "stock",
	size = "sm",
	className,
	maxChars = 1,
}: AssetMonogramProps) {
	const color = useMemo(() => getDeterministicColor(symbol, assetType), [symbol, assetType]);
	const text = useMemo(() => getMonogramText(symbol, maxChars), [symbol, maxChars]);
	const sizeCfg = SIZE_CLASSES[size] || SIZE_CLASSES.sm;

	return (
		<div
			data-testid="asset-monogram"
			className={cn(
				"flex items-center justify-center rounded-full font-bold shrink-0 select-none border border-border/40",
				sizeCfg.container,
				sizeCfg.text,
				className,
			)}
			style={{
				backgroundColor: `${color}1F`,
				color,
			}}
			aria-hidden="true"
		>
			{text}
		</div>
	);
});

export interface AssetLogoProps {
	symbol: string;
	name?: string;
	assetType?: AssetType;
	size?: AssetLogoSize;
	className?: string;
}

export const AssetLogo = memo(function AssetLogo({
	symbol,
	name,
	assetType = "stock",
	size = "sm",
	className,
}: AssetLogoProps) {
	const cleanSymbol = useMemo(() => {
		return cleanAssetSymbol(symbol, name, assetType);
	}, [symbol, name, assetType]);

	const isCrypto = assetType === "crypto";
	const bundledMap = isCrypto
		? (bundledLogos.crypto as Record<string, string>)
		: (bundledLogos.stocks as Record<string, string>);

	const bundledFileName = useMemo(() => {
		const raw = (symbol || "").toUpperCase().trim();
		const clean = (cleanSymbol || "").toUpperCase().trim();
		return bundledMap[clean] || bundledMap[raw] || null;
	}, [cleanSymbol, symbol, bundledMap]);

	const [stage, setStage] = useState<"bundled" | "proxy" | "fallback">(() =>
		bundledFileName ? "bundled" : "proxy",
	);
	const [imageLoaded, setImageLoaded] = useState(false);

	// Reset state when symbol or assetType changes
	useEffect(() => {
		setStage(bundledFileName ? "bundled" : "proxy");
		setImageLoaded(false);
	}, [cleanSymbol, assetType, bundledFileName]);

	const currentSrc = useMemo(() => {
		if (!cleanSymbol || stage === "fallback") return null;
		if (stage === "bundled" && bundledFileName) {
			const folder = isCrypto ? "crypto" : "stocks";
			return `/logos/${folder}/${bundledFileName}`;
		}
		// Proxy stage
		const typeParam = isCrypto ? "crypto" : "stocks";
		return `/api/v1/logos/${typeParam}/${encodeURIComponent(cleanSymbol)}`;
	}, [cleanSymbol, stage, isCrypto, bundledFileName]);

	const handleError = () => {
		if (stage === "bundled") {
			// Try backend proxy before falling back to monogram
			setStage("proxy");
			setImageLoaded(false);
		} else {
			setStage("fallback");
			setImageLoaded(false);
		}
	};

	const handleLoad = () => {
		setImageLoaded(true);
	};

	const sizeCfg = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
	const accessibleLabel = name
		? `${name} (${cleanSymbol || symbol}) logo`
		: `${cleanSymbol || symbol} logo`;

	return (
		<div
			className={cn(
				"relative rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-muted/20 border border-border/40 select-none",
				sizeCfg.container,
				className,
			)}
			title={accessibleLabel}
			aria-label={accessibleLabel}
		>
			{/* Deterministic monogram shown immediately while loading or as final fallback */}
			{(!imageLoaded || stage === "fallback" || !currentSrc) && (
				<AssetMonogram
					symbol={cleanSymbol || symbol}
					assetType={assetType}
					size={size}
					className="w-full h-full border-0"
				/>
			)}

			{/* Logo image rendered on top when available */}
			{currentSrc && stage !== "fallback" && (
				<img
					key={currentSrc}
					src={currentSrc}
					alt={accessibleLabel}
					loading="lazy"
					decoding="async"
					onError={handleError}
					onLoad={handleLoad}
					className={cn(
						"absolute inset-0 w-full h-full object-contain rounded-full transition-opacity duration-150 p-0.5",
						imageLoaded ? "opacity-100" : "opacity-0 pointer-events-none",
					)}
				/>
			)}
		</div>
	);
});

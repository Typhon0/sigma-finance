import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	AssetLogo,
	AssetMonogram,
	cleanAssetSymbol,
	CRYPTO_BRAND_COLORS,
	getDeterministicColor,
	getMonogramText,
} from "../AssetLogo";

describe("AssetLogo Symbol Cleaning & Normalization", () => {
	it("maps Kraken crypto aliases to standard tickers", () => {
		expect(cleanAssetSymbol("XDG", undefined, "crypto")).toBe("DOGE");
		expect(cleanAssetSymbol("XXBT", undefined, "crypto")).toBe("BTC");
		expect(cleanAssetSymbol("XXLM", undefined, "crypto")).toBe("XLM");
		expect(cleanAssetSymbol("XXRP", undefined, "crypto")).toBe("XRP");
	});

	it("normalizes wrapped and portal tokens to native brand", () => {
		expect(cleanAssetSymbol("SOL", "sol (portal)", "crypto")).toBe("SOL");
		expect(cleanAssetSymbol("USDC", "kcc-peg usd coin", "crypto")).toBe("USDC");
		expect(cleanAssetSymbol("AAVE", "aave token (portal)", "crypto")).toBe("AAVE");
		expect(cleanAssetSymbol("WETH", undefined, "crypto")).toBe("ETH");
		expect(cleanAssetSymbol("WBTC", undefined, "crypto")).toBe("BTC");
	});

	it("returns 1st character by default in monogram", () => {
		expect(getMonogramText("BTC")).toBe("B");
		expect(getMonogramText("AAPL")).toBe("A");
		expect(getMonogramText("")).toBe("?");
	});

	it("uses official brand color for top cryptos", () => {
		expect(getDeterministicColor("BTC", "crypto")).toBe(CRYPTO_BRAND_COLORS.BTC);
		expect(getDeterministicColor("ETH", "crypto")).toBe(CRYPTO_BRAND_COLORS.ETH);
		expect(getDeterministicColor("SOL", "crypto")).toBe(CRYPTO_BRAND_COLORS.SOL);
		expect(getDeterministicColor("SUI", "crypto")).toBe(CRYPTO_BRAND_COLORS.SUI);
	});
});

describe("AssetLogo Component", () => {
	it("renders bundled SVG for top cryptos like BTC", () => {
		render(<AssetLogo symbol="BTC" name="Bitcoin" assetType="crypto" size="sm" />);
		const img = screen.getByRole("img");
		expect(img).toHaveAttribute("src", "/logos/crypto/BTC.svg");
		expect(img).toHaveAttribute("alt", "Bitcoin (BTC) logo");
	});

	it("renders bundled PNG for altcoins like SUI and FLR", () => {
		render(<AssetLogo symbol="SUI" name="sui" assetType="crypto" size="sm" />);
		const img = screen.getByRole("img");
		expect(img).toHaveAttribute("src", "/logos/crypto/SUI.png");
	});

	it("normalizes wrapped tokens and renders native bundled logo", () => {
		render(<AssetLogo symbol="SOL" name="sol (portal)" assetType="crypto" size="sm" />);
		const img = screen.getByRole("img");
		expect(img).toHaveAttribute("src", "/logos/crypto/SOL.svg");
	});

	it("normalizes kcc-peg usd coin to USDC logo", () => {
		render(<AssetLogo symbol="USDC" name="kcc-peg usd coin" assetType="crypto" size="sm" />);
		const img = screen.getByRole("img");
		expect(img).toHaveAttribute("src", "/logos/crypto/USDC.svg");
	});

	it("normalizes XDG to DOGE bundled logo", () => {
		render(<AssetLogo symbol="XDG" name="dogecoin" assetType="crypto" size="sm" />);
		const img = screen.getByRole("img");
		expect(img).toHaveAttribute("src", "/logos/crypto/DOGE.svg");
	});

	it("renders backend proxy URL for truly non-bundled assets", () => {
		render(<AssetLogo symbol="UNKNOWNCOIN999" name="Unknown" assetType="crypto" size="sm" />);
		const img = screen.getByRole("img");
		expect(img).toHaveAttribute("src", "/api/v1/logos/crypto/UNKNOWNCOIN999");
	});

	it("falls back to proxy if bundled image fails, then to monogram if proxy fails", () => {
		render(<AssetLogo symbol="BTC" name="Bitcoin" assetType="crypto" size="sm" />);
		let img = screen.getByRole("img");
		expect(img).toHaveAttribute("src", "/logos/crypto/BTC.svg");

		// Simulate bundled SVG failing (e.g. 404)
		fireEvent.error(img);

		// Should switch to proxy URL
		img = screen.getByRole("img");
		expect(img).toHaveAttribute("src", "/api/v1/logos/crypto/BTC");

		// Simulate proxy failing
		fireEvent.error(img);

		// Img is removed and monogram remains
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		const monogram = screen.getByTestId("asset-monogram");
		expect(monogram).toHaveTextContent("B");
	});

	it("shows monogram placeholder while image is loading, then reveals image on load", () => {
		render(<AssetLogo symbol="SOL" assetType="crypto" size="sm" />);
		const img = screen.getByRole("img");
		expect(img).toHaveClass("opacity-0");
		expect(screen.getByTestId("asset-monogram")).toBeInTheDocument();

		fireEvent.load(img);
		expect(img).toHaveClass("opacity-100");
	});

	it("applies correct size classes", () => {
		const { container } = render(<AssetLogo symbol="BTC" size="lg" />);
		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper).toHaveClass("h-10");
		expect(wrapper).toHaveClass("w-10");
	});
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WCAG AA guard for the semantic financial colour tokens.
 *
 * The Stocks & Funds module used stock Tailwind shades directly for every P&L
 * figure. None of them clear 4.5:1 against --card in both themes:
 *   emerald-400  1.92:1 on white      emerald-500  2.54:1 on white
 *   rose-600     3.71:1 on dark card  amber-400   1.67:1 on white
 *
 * themes.css now defines --gain/--loss/--warning/--info tuned per theme. This
 * test fails if a token is edited to a value that regresses, or if a new
 * financial token is added without a contrast budget.
 */

const THEMES_CSS = resolve(__dirname, "../themes.css");
const MIN_AA = 4.5;

/** Tokens that render as text and must clear WCAG AA against the card surface. */
const TEXT_TOKENS = [
	"gain",
	"gain-muted",
	"loss",
	"loss-muted",
	"warning",
	"warning-muted",
	"info",
	"info-muted",
] as const;

type Rgb = [number, number, number];

function oklchToSrgb(L: number, C: number, Hdeg: number): Rgb {
	const h = (Hdeg * Math.PI) / 180;
	const a = C * Math.cos(h);
	const b = C * Math.sin(h);

	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;

	const l = l_ ** 3;
	const m = m_ ** 3;
	const s = s_ ** 3;

	const linear = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];

	return linear.map((v) => {
		const clamped = Math.min(1, Math.max(0, v));
		const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
		return Math.round(Math.min(1, Math.max(0, srgb)) * 255);
	}) as Rgb;
}

function relativeLuminance([r, g, b]: Rgb): number {
	const [lr, lg, lb] = [r, g, b].map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(a: Rgb, b: Rgb): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Extract the declaration body of a top-level `:root { }` or `.dark { }` block. */
function themeBlocks(css: string): Array<{ theme: string; body: string }> {
	const blocks: Array<{ theme: string; body: string }> = [];
	const re = /(^|\n)(:root|\.dark)\s*\{([^}]*)\}/g;
	let match = re.exec(css);
	while (match !== null) {
		blocks.push({ theme: match[2], body: match[3] });
		match = re.exec(css);
	}
	return blocks;
}

function readToken(body: string, token: string): string | undefined {
	const escaped = token.replace(/-/g, "\\-");
	return body.match(new RegExp(`--${escaped}:\\s*([^;]+);`))?.[1]?.trim();
}

function parseColor(value: string): Rgb {
	const oklch = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
	if (oklch) {
		return oklchToSrgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
	}
	const hex = value.match(/#([0-9a-f]{6})/i);
	if (hex) {
		const n = Number.parseInt(hex[1], 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	throw new Error(`Unsupported colour syntax: ${value}`);
}

const css = readFileSync(THEMES_CSS, "utf8");
const blocks = themeBlocks(css);

describe("semantic financial colour tokens", () => {
	it("finds both the :root and .dark theme blocks", () => {
		expect(blocks.map((b) => b.theme)).toEqual([":root", ".dark"]);
	});

	describe.each(blocks.map((b) => [b.theme, b.body] as const))("%s theme", (theme, body) => {
		const cardValue = readToken(body, "card");
		if (!cardValue) throw new Error(`No --card token in the ${theme} block`);

		it.each(TEXT_TOKENS)("--%s clears WCAG AA against --card", (token) => {
			const value = readToken(body, token);
			expect(value, `--${token} is missing from the ${theme} block`).toBeDefined();
			const ratio = contrastRatio(parseColor(value as string), parseColor(cardValue));
			expect(
				ratio,
				`--${token} (${value}) is ${ratio.toFixed(2)}:1 against --card (${cardValue}) in the ${theme} theme; AA text needs ${MIN_AA}:1`,
			).toBeGreaterThanOrEqual(MIN_AA);
		});
	});
});

/**
 * Maps exchange names and MIC codes from our instrument data to TradingView's
 * exchange identifiers. This is necessary because TradingView uses its own
 * exchange naming (e.g., "NASDAQ" not "XNAS", "EURONEXT" not "XPAR").
 *
 * Source: TradingView's supported exchanges — these are the identifiers that
 * appear in their EXCHANGE:SYMBOL format.
 */
const exchangeMapping: Record<string, string> = {
	// US Exchanges
	nasdaq: "NASDAQ",
	xnas: "NASDAQ",
	nyse: "NYSE",
	xnys: "NYSE",
	"nyse arca": "AMEX",
	arca: "AMEX",
	amex: "AMEX",
	bats: "BATS",
	otc: "OTC",

	// UK / Europe
	"london stock exchange": "LSE",
	lse: "LSE",
	xlon: "LSE",
	euronext: "EURONEXT",
	xpar: "EURONEXT", // Paris
	xams: "EURONEXT", // Amsterdam
	xbru: "EURONEXT", // Brussels
	xlis: "EURONEXT", // Lisbon
	"frankfurt stock exchange": "FWB",
	frankfurt: "FWB",
	xfra: "FWB",
	xetra: "XETRA",
	xetr: "XETRA",
	ibis: "XETRA",
	"six swiss exchange": "SIX",
	six: "SIX",
	xswx: "SIX",
	"bolsas y mercados espanoles": "BME",
	bme: "BME",
	xmad: "BME",
	"borsa italiana": "MIL",
	xmil: "MIL",
	"warsaw stock exchange": "GPW",
	gpw: "GPW",
	xwar: "GPW",

	// Americas (non-US)
	"toronto stock exchange": "TSX",
	tsx: "TSX",
	xtse: "TSX",
	"tsx venture": "TSXV",
	tsxv: "TSXV",
	b3: "B3",
	bvmf: "B3",
	"bm&fbovespa": "B3",

	// Asia Pacific
	"tokyo stock exchange": "TSE",
	tse: "TSE",
	xtks: "TSE",
	"hong kong stock exchange": "HKEX",
	hkex: "HKEX",
	xhkg: "HKEX",
	"shanghai stock exchange": "SSE",
	sse: "SSE",
	xshg: "SSE",
	"shenzhen stock exchange": "SZSE",
	szse: "SZSE",
	xshe: "SZSE",
	"national stock exchange of india": "NSE",
	nse: "NSE",
	xnse: "NSE",
	"bombay stock exchange": "BSE",
	bse: "BSE",
	xbom: "BSE",
	"australian securities exchange": "ASX",
	asx: "ASX",
	xasx: "ASX",
	"singapore exchange": "SGX",
	sgx: "SGX",
	xses: "SGX",
	"korea exchange": "KRX",
	krx: "KRX",
	xkrx: "KRX",

	// Middle East / Africa
	"johannesburg stock exchange": "JSE",
	jse: "JSE",
	xjse: "JSE",
	"moscow exchange": "MOEX",
	moex: "MOEX",
	xmce: "MOEX",

	// Crypto Exchanges
	binance: "BINANCE",
	coinbase: "COINBASE",
	gdax: "COINBASE",
	kraken: "KRAKEN",
	bitfinex: "BITFINEX",
	bittrex: "BITTREX",
	poloniex: "POLONIEX",
	huobi: "HUOBI",
	htx: "HUOBI",
	okx: "OKX",
	okex: "OKX",
	kucoin: "KUCOIN",
	bybit: "BYBIT",
	gate: "GATEIO",
	gateio: "GATEIO",
};

/** Exchanges on TradingView that use USD quote pairs instead of USDT */
const USD_QUOTE_EXCHANGES = new Set(["COINBASE", "KRAKEN", "BITFINEX"]);

export interface ResolveTradingViewSymbolOptions {
	symbol: string;
	assetType: string;
	exchange?: string | null;
	exchangeCode?: string | null;
	baseCurrency?: string | null;
	quoteCurrency?: string | null;
}

/**
 * Resolves an instrument from our data model to a TradingView-compatible
 * EXCHANGE:SYMBOL string.
 *
 * Resolution strategy:
 * 1. If symbol already contains ":", assume it's pre-formatted — use as-is
 *    (after stripping any asset-type suffix like ":STOCK", ":CRYPTO").
 * 2. Resolve the TradingView exchange from exchangeCode or exchange fields.
 * 3. For crypto: build the pair ticker from baseCurrency/quoteCurrency when
 *    available, or infer a quote currency from the exchange.
 * 4. For non-crypto: use EXCHANGE:TICKER if exchange is known.
 * 5. Fallback: return bare ticker — TradingView widgets will attempt their
 *    own best-effort resolution.
 */
export function resolveTradingViewSymbol(opts: ResolveTradingViewSymbolOptions): string {
	const { symbol, assetType, exchange, exchangeCode, baseCurrency, quoteCurrency } = opts;

	// Strip asset-type suffixes that our system appends (e.g., "AAPL:STOCK")
	const parts = symbol.split(":");
	const assetTypeSuffixes = new Set([
		"STOCK",
		"ETF",
		"FUND",
		"INDEX",
		"CURRENCY",
		"CRYPTO",
		"MONEY_MARKET",
	]);

	if (parts.length > 1 && assetTypeSuffixes.has(parts[parts.length - 1].toUpperCase())) {
		parts.pop();
	}
	const cleanSymbol = parts.join(":");

	// Already in EXCHANGE:SYMBOL format — return as-is
	if (cleanSymbol.includes(":")) {
		return cleanSymbol;
	}

	const resolvedExchange = resolveExchange(exchangeCode, exchange);
	const ticker = cleanSymbol.trim().toUpperCase();

	if (assetType === "CRYPTO") {
		return resolveCryptoSymbol(ticker, resolvedExchange, baseCurrency, quoteCurrency);
	}

	// Non-crypto: prefix with exchange if known
	if (resolvedExchange) {
		return `${resolvedExchange}:${ticker}`;
	}

	// No exchange info available — return bare ticker.
	// TradingView widgets will attempt best-effort resolution.
	return ticker;
}

/**
 * Normalizes an exchange name or MIC code to a TradingView exchange identifier.
 */
function resolveExchange(
	exchangeCode?: string | null,
	exchangeName?: string | null,
): string | null {
	if (exchangeCode) {
		const mapped = exchangeMapping[exchangeCode.trim().toLowerCase()];
		if (mapped) return mapped;
	}
	if (exchangeName) {
		const mapped = exchangeMapping[exchangeName.trim().toLowerCase()];
		if (mapped) return mapped;
	}
	return null;
}

/**
 * Builds a TradingView crypto symbol.
 *
 * TradingView crypto format is EXCHANGE:BASEQUOTE (e.g., BINANCE:BTCUSDT).
 * - If both baseCurrency and quoteCurrency are provided, use them directly.
 * - Otherwise, parse the raw symbol and infer the quote currency from the
 *   exchange (USD for Coinbase/Kraken/Bitfinex, USDT for others).
 */
function resolveCryptoSymbol(
	rawTicker: string,
	resolvedExchange: string | null,
	baseCurrency?: string | null,
	quoteCurrency?: string | null,
): string {
	const tvExchange = resolvedExchange ?? "BINANCE";

	const cleanBase = baseCurrency?.trim().toUpperCase() ?? "";
	const cleanQuote = quoteCurrency?.trim().toUpperCase() ?? "";

	// Best case: we have explicit base/quote from our instrument data
	if (cleanBase && cleanQuote) {
		return `${tvExchange}:${cleanBase}${cleanQuote}`;
	}

	// Normalize the raw ticker: strip separators like BTC/USDT, BTC-USD, BTC_USDT
	let ticker = rawTicker.replace(/[/_-]/g, "").toUpperCase();

	// If the ticker already looks like a pair (ends with a known quote), use it
	const hasQuoteSuffix =
		ticker.endsWith("USDT") ||
		ticker.endsWith("USD") ||
		ticker.endsWith("EUR") ||
		ticker.endsWith("BTC") ||
		ticker.endsWith("ETH") ||
		ticker.endsWith("BUSD") ||
		ticker.endsWith("USDC");

	if (!hasQuoteSuffix) {
		// Append the default quote currency based on the exchange
		const defaultQuote = USD_QUOTE_EXCHANGES.has(tvExchange) ? "USD" : "USDT";
		ticker = `${ticker}${defaultQuote}`;
	}

	return `${tvExchange}:${ticker}`;
}

import { Clock, Globe, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type MarketCategory = "stock" | "crypto";

export type MarketRegion =
	| "Americas"
	| "Europe"
	| "Asia-Pacific"
	| "Middle East & Africa"
	| "Global";

export type MarketSession = "pre-market" | "regular" | "lunch" | "after-hours" | "closed";

export interface MarketTradingSession {
	name: string;
	session: MarketSession;
	startMinute: number; // minutes from 00:00 local time
	endMinute: number;
}

export interface GlobalMarketDef {
	id: string;
	name: string;
	shortName: string;
	flag: string;
	region: MarketRegion;
	marketCategory: MarketCategory;
	country: string;
	city: string;
	timeZone: string;
	currency: string;
	tradingDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
	sessions: MarketTradingSession[];
	regularHoursText: string;
	utcHoursText: string;
	symbolSuffixes: string[];
	exchangeKeywords: string[];
}

export interface HoldingLocationInfo {
	symbol: string;
	currency?: string;
	exchange?: string;
}

export interface MarketStatusBadgeProps {
	holdings?: HoldingLocationInfo[];
	/** Page / context asset type filter. Defaults to "stock" for Stocks & Funds page. */
	assetType?: "stock" | "crypto";
}

export interface CalculatedMarketStatus {
	market: GlobalMarketDef;
	session: MarketSession;
	label: string;
	detail: string;
	color: string;
	dotColor: string;
	countdownText: string;
	localTimeText: string;
	isTradingDay: boolean;
	holdingCount: number;
}

// ---------------------------------------------------------------------------
// Global Markets Registry (Classified by Market Category)
// ---------------------------------------------------------------------------
export const GLOBAL_MARKETS: GlobalMarketDef[] = [
	// ==========================================
	// 1. Americas Equity & Fund Exchanges
	// ==========================================
	{
		id: "us_nyse_nasdaq",
		name: "NYSE & NASDAQ",
		shortName: "Wall Street",
		flag: "🇺🇸",
		region: "Americas",
		marketCategory: "stock",
		country: "United States",
		city: "New York",
		timeZone: "America/New_York",
		currency: "USD",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [
			{ name: "Pre-Market", session: "pre-market", startMinute: 240, endMinute: 570 },
			{ name: "Regular Session", session: "regular", startMinute: 570, endMinute: 960 },
			{ name: "After-Hours", session: "after-hours", startMinute: 960, endMinute: 1200 },
		],
		regularHoursText: "09:30 – 16:00 ET",
		utcHoursText: "14:30 – 21:00 UTC",
		symbolSuffixes: [".US"],
		exchangeKeywords: ["NYSE", "NASDAQ", "BATS", "ARCA", "AMEX", "US"],
	},
	{
		id: "ca_tsx",
		name: "Toronto Stock Exchange (TSX)",
		shortName: "TSX",
		flag: "🇨🇦",
		region: "Americas",
		marketCategory: "stock",
		country: "Canada",
		city: "Toronto",
		timeZone: "America/Toronto",
		currency: "CAD",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 570, endMinute: 960 }],
		regularHoursText: "09:30 – 16:00 ET",
		utcHoursText: "14:30 – 21:00 UTC",
		symbolSuffixes: [".TO", ".V", ".TSX", ".TSXV"],
		exchangeKeywords: ["TSX", "TSXV", "TORONTO", "VENTURE"],
	},
	{
		id: "br_b3",
		name: "B3 (Brasil Bolsa Balcão)",
		shortName: "B3 São Paulo",
		flag: "🇧🇷",
		region: "Americas",
		marketCategory: "stock",
		country: "Brazil",
		city: "São Paulo",
		timeZone: "America/Sao_Paulo",
		currency: "BRL",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 600, endMinute: 1020 }],
		regularHoursText: "10:00 – 17:00 BRT",
		utcHoursText: "13:00 – 20:00 UTC",
		symbolSuffixes: [".SA"],
		exchangeKeywords: ["B3", "BOVESPA", "SAO PAULO", "BVMF"],
	},
	{
		id: "mx_bmv",
		name: "Bolsa Mexicana de Valores (BMV)",
		shortName: "BMV Mexico",
		flag: "🇲🇽",
		region: "Americas",
		marketCategory: "stock",
		country: "Mexico",
		city: "Mexico City",
		timeZone: "America/Mexico_City",
		currency: "MXN",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 510, endMinute: 900 }],
		regularHoursText: "08:30 – 15:00 CST",
		utcHoursText: "14:30 – 21:00 UTC",
		symbolSuffixes: [".MX"],
		exchangeKeywords: ["BMV", "MEXICO", "BOLSA MEXICANA"],
	},

	// ==========================================
	// 2. European Equity & Fund Exchanges
	// ==========================================
	{
		id: "fr_euronext_paris",
		name: "Euronext Paris",
		shortName: "Paris",
		flag: "🇫🇷",
		region: "Europe",
		marketCategory: "stock",
		country: "France",
		city: "Paris",
		timeZone: "Europe/Paris",
		currency: "EUR",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [
			{ name: "Pre-Opening", session: "pre-market", startMinute: 435, endMinute: 540 },
			{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1050 },
		],
		regularHoursText: "09:00 – 17:30 CET",
		utcHoursText: "08:00 – 16:30 UTC",
		symbolSuffixes: [".PA", ".FP", ".FR"],
		exchangeKeywords: ["PARIS", "EURONEXT", "EPA", "CAC"],
	},
	{
		id: "gb_lse",
		name: "London Stock Exchange (LSE)",
		shortName: "London LSE",
		flag: "🇬🇧",
		region: "Europe",
		marketCategory: "stock",
		country: "United Kingdom",
		city: "London",
		timeZone: "Europe/London",
		currency: "GBP",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 480, endMinute: 990 }],
		regularHoursText: "08:00 – 16:30 GMT",
		utcHoursText: "08:00 – 16:30 UTC",
		symbolSuffixes: [".L", ".LON"],
		exchangeKeywords: ["LSE", "LONDON", "FTSE"],
	},
	{
		id: "de_xetra",
		name: "Deutsche Börse XETRA / Frankfurt",
		shortName: "Frankfurt XETRA",
		flag: "🇩🇪",
		region: "Europe",
		marketCategory: "stock",
		country: "Germany",
		city: "Frankfurt",
		timeZone: "Europe/Berlin",
		currency: "EUR",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1050 }],
		regularHoursText: "09:00 – 17:30 CET",
		utcHoursText: "08:00 – 16:30 UTC",
		symbolSuffixes: [".DE", ".F"],
		exchangeKeywords: ["XETRA", "FRANKFURT", "DAX", "DEUTSCHE BORSE"],
	},
	{
		id: "nl_euronext_ams",
		name: "Euronext Amsterdam",
		shortName: "Amsterdam",
		flag: "🇳🇱",
		region: "Europe",
		marketCategory: "stock",
		country: "Netherlands",
		city: "Amsterdam",
		timeZone: "Europe/Amsterdam",
		currency: "EUR",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1050 }],
		regularHoursText: "09:00 – 17:30 CET",
		utcHoursText: "08:00 – 16:30 UTC",
		symbolSuffixes: [".AS"],
		exchangeKeywords: ["AMSTERDAM", "AEX"],
	},
	{
		id: "be_euronext_bru",
		name: "Euronext Brussels",
		shortName: "Brussels",
		flag: "🇧🇪",
		region: "Europe",
		marketCategory: "stock",
		country: "Belgium",
		city: "Brussels",
		timeZone: "Europe/Brussels",
		currency: "EUR",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1050 }],
		regularHoursText: "09:00 – 17:30 CET",
		utcHoursText: "08:00 – 16:30 UTC",
		symbolSuffixes: [".BR"],
		exchangeKeywords: ["BRUSSELS", "BEL20"],
	},
	{
		id: "ch_six",
		name: "SIX Swiss Exchange",
		shortName: "SIX Zurich",
		flag: "🇨🇭",
		region: "Europe",
		marketCategory: "stock",
		country: "Switzerland",
		city: "Zurich",
		timeZone: "Europe/Zurich",
		currency: "CHF",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1050 }],
		regularHoursText: "09:00 – 17:30 CET",
		utcHoursText: "08:00 – 16:30 UTC",
		symbolSuffixes: [".SW", ".VX"],
		exchangeKeywords: ["SIX", "SWISS", "ZURICH", "SMI"],
	},
	{
		id: "it_borsa",
		name: "Borsa Italiana (Milan)",
		shortName: "Milan",
		flag: "🇮🇹",
		region: "Europe",
		marketCategory: "stock",
		country: "Italy",
		city: "Milan",
		timeZone: "Europe/Rome",
		currency: "EUR",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1050 }],
		regularHoursText: "09:00 – 17:30 CET",
		utcHoursText: "08:00 – 16:30 UTC",
		symbolSuffixes: [".MI"],
		exchangeKeywords: ["BORSA ITALIANA", "MILAN", "FTSE MIB"],
	},
	{
		id: "es_bme",
		name: "Bolsa de Madrid (BME)",
		shortName: "Madrid",
		flag: "🇪🇸",
		region: "Europe",
		marketCategory: "stock",
		country: "Spain",
		city: "Madrid",
		timeZone: "Europe/Madrid",
		currency: "EUR",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1050 }],
		regularHoursText: "09:00 – 17:30 CET",
		utcHoursText: "08:00 – 16:30 UTC",
		symbolSuffixes: [".MC"],
		exchangeKeywords: ["BME", "MADRID", "IBEX"],
	},
	{
		id: "se_omx",
		name: "Nasdaq Stockholm (OMX)",
		shortName: "Stockholm",
		flag: "🇸🇪",
		region: "Europe",
		marketCategory: "stock",
		country: "Sweden",
		city: "Stockholm",
		timeZone: "Europe/Stockholm",
		currency: "SEK",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1050 }],
		regularHoursText: "09:00 – 17:30 CET",
		utcHoursText: "08:00 – 16:30 UTC",
		symbolSuffixes: [".ST"],
		exchangeKeywords: ["STOCKHOLM", "OMX", "SWEDEN"],
	},

	// ==========================================
	// 3. Asia-Pacific Equity & Fund Exchanges
	// ==========================================
	{
		id: "jp_tse",
		name: "Tokyo Stock Exchange (TSE)",
		shortName: "Tokyo TSE",
		flag: "🇯🇵",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "Japan",
		city: "Tokyo",
		timeZone: "Asia/Tokyo",
		currency: "JPY",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [
			{ name: "Morning Session", session: "regular", startMinute: 540, endMinute: 690 },
			{ name: "Lunch Halt", session: "lunch", startMinute: 690, endMinute: 750 },
			{ name: "Afternoon Session", session: "regular", startMinute: 750, endMinute: 930 },
		],
		regularHoursText: "09:00 – 15:30 JST (Lunch 11:30 – 12:30)",
		utcHoursText: "00:00 – 06:30 UTC",
		symbolSuffixes: [".T", ".JP"],
		exchangeKeywords: ["TSE", "TOKYO", "JPX", "NIKKEI"],
	},
	{
		id: "hk_hkex",
		name: "Hong Kong Exchanges (HKEX)",
		shortName: "Hong Kong",
		flag: "🇭🇰",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "Hong Kong",
		city: "Hong Kong",
		timeZone: "Asia/Hong_Kong",
		currency: "HKD",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [
			{ name: "Morning Session", session: "regular", startMinute: 570, endMinute: 720 },
			{ name: "Lunch Break", session: "lunch", startMinute: 720, endMinute: 780 },
			{ name: "Afternoon Session", session: "regular", startMinute: 780, endMinute: 960 },
		],
		regularHoursText: "09:30 – 16:00 HKT (Lunch 12:00 – 13:00)",
		utcHoursText: "01:30 – 08:00 UTC",
		symbolSuffixes: [".HK"],
		exchangeKeywords: ["HKEX", "HONG KONG", "HANG SENG"],
	},
	{
		id: "cn_sse",
		name: "Shanghai Stock Exchange (SSE)",
		shortName: "Shanghai",
		flag: "🇨🇳",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "China",
		city: "Shanghai",
		timeZone: "Asia/Shanghai",
		currency: "CNY",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [
			{ name: "Morning Session", session: "regular", startMinute: 570, endMinute: 690 },
			{ name: "Lunch Break", session: "lunch", startMinute: 690, endMinute: 780 },
			{ name: "Afternoon Session", session: "regular", startMinute: 780, endMinute: 900 },
		],
		regularHoursText: "09:30 – 15:00 CST (Lunch 11:30 – 13:00)",
		utcHoursText: "01:30 – 07:00 UTC",
		symbolSuffixes: [".SS"],
		exchangeKeywords: ["SSE", "SHANGHAI", "CSI 300"],
	},
	{
		id: "cn_szse",
		name: "Shenzhen Stock Exchange (SZSE)",
		shortName: "Shenzhen",
		flag: "🇨🇳",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "China",
		city: "Shenzhen",
		timeZone: "Asia/Shanghai",
		currency: "CNY",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [
			{ name: "Morning Session", session: "regular", startMinute: 570, endMinute: 690 },
			{ name: "Lunch Break", session: "lunch", startMinute: 690, endMinute: 780 },
			{ name: "Afternoon Session", session: "regular", startMinute: 780, endMinute: 900 },
		],
		regularHoursText: "09:30 – 15:00 CST (Lunch 11:30 – 13:00)",
		utcHoursText: "01:30 – 07:00 UTC",
		symbolSuffixes: [".SZ"],
		exchangeKeywords: ["SZSE", "SHENZHEN", "CHINEXT"],
	},
	{
		id: "in_nse",
		name: "National Stock Exchange of India (NSE)",
		shortName: "NSE India",
		flag: "🇮🇳",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "India",
		city: "Mumbai",
		timeZone: "Asia/Kolkata",
		currency: "INR",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 555, endMinute: 930 }],
		regularHoursText: "09:15 – 15:30 IST",
		utcHoursText: "03:45 – 10:00 UTC",
		symbolSuffixes: [".NS", ".NSE"],
		exchangeKeywords: ["NSE", "NIFTY", "INDIA"],
	},
	{
		id: "in_bse",
		name: "Bombay Stock Exchange (BSE)",
		shortName: "BSE Mumbai",
		flag: "🇮🇳",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "India",
		city: "Mumbai",
		timeZone: "Asia/Kolkata",
		currency: "INR",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 555, endMinute: 930 }],
		regularHoursText: "09:15 – 15:30 IST",
		utcHoursText: "03:45 – 10:00 UTC",
		symbolSuffixes: [".BO", ".BSE"],
		exchangeKeywords: ["BSE", "SENSEX"],
	},
	{
		id: "sg_sgx",
		name: "Singapore Exchange (SGX)",
		shortName: "SGX",
		flag: "🇸🇬",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "Singapore",
		city: "Singapore",
		timeZone: "Asia/Singapore",
		currency: "SGD",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1020 }],
		regularHoursText: "09:00 – 17:00 SGT",
		utcHoursText: "01:00 – 09:00 UTC",
		symbolSuffixes: [".SI"],
		exchangeKeywords: ["SGX", "SINGAPORE", "STI"],
	},
	{
		id: "kr_krx",
		name: "Korea Exchange (KRX)",
		shortName: "KRX Seoul",
		flag: "🇰🇷",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "South Korea",
		city: "Seoul",
		timeZone: "Asia/Seoul",
		currency: "KRW",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 930 }],
		regularHoursText: "09:00 – 15:30 KST",
		utcHoursText: "00:00 – 06:30 UTC",
		symbolSuffixes: [".KS", ".KQ"],
		exchangeKeywords: ["KRX", "KOSPI", "KOSDAQ", "KOREA"],
	},
	{
		id: "tw_twse",
		name: "Taiwan Stock Exchange (TWSE)",
		shortName: "Taiwan",
		flag: "🇹🇼",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "Taiwan",
		city: "Taipei",
		timeZone: "Asia/Taipei",
		currency: "TWD",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 810 }],
		regularHoursText: "09:00 – 13:30 NST",
		utcHoursText: "01:00 – 05:30 UTC",
		symbolSuffixes: [".TW"],
		exchangeKeywords: ["TWSE", "TAIWAN"],
	},
	{
		id: "au_asx",
		name: "Australian Securities Exchange (ASX)",
		shortName: "Sydney ASX",
		flag: "🇦🇺",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "Australia",
		city: "Sydney",
		timeZone: "Australia/Sydney",
		currency: "AUD",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 600, endMinute: 960 }],
		regularHoursText: "10:00 – 16:00 AEST",
		utcHoursText: "00:00 – 06:00 UTC",
		symbolSuffixes: [".AX"],
		exchangeKeywords: ["ASX", "AUSTRALIA", "SYDNEY", "ALL ORDS"],
	},
	{
		id: "nz_nzx",
		name: "New Zealand Exchange (NZX)",
		shortName: "NZX",
		flag: "🇳🇿",
		region: "Asia-Pacific",
		marketCategory: "stock",
		country: "New Zealand",
		city: "Auckland",
		timeZone: "Pacific/Auckland",
		currency: "NZD",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 600, endMinute: 1005 }],
		regularHoursText: "10:00 – 16:45 NZST",
		utcHoursText: "22:00 – 04:45 UTC",
		symbolSuffixes: [".NZ"],
		exchangeKeywords: ["NZX", "NEW ZEALAND"],
	},

	// ==========================================
	// 4. Middle East & Africa Equity Exchanges
	// ==========================================
	{
		id: "sa_tadawul",
		name: "Saudi Exchange (Tadawul)",
		shortName: "Tadawul",
		flag: "🇸🇦",
		region: "Middle East & Africa",
		marketCategory: "stock",
		country: "Saudi Arabia",
		city: "Riyadh",
		timeZone: "Asia/Riyadh",
		currency: "SAR",
		tradingDays: [0, 1, 2, 3, 4], // Sunday through Thursday
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 600, endMinute: 900 }],
		regularHoursText: "10:00 – 15:00 AST (Sun–Thu)",
		utcHoursText: "07:00 – 12:00 UTC",
		symbolSuffixes: [".SR", ".SAU"],
		exchangeKeywords: ["TADAWUL", "SAUDI", "TASI"],
	},
	{
		id: "ae_dfm_adx",
		name: "Abu Dhabi (ADX) & Dubai (DFM)",
		shortName: "UAE Markets",
		flag: "🇦🇪",
		region: "Middle East & Africa",
		marketCategory: "stock",
		country: "United Arab Emirates",
		city: "Dubai / Abu Dhabi",
		timeZone: "Asia/Dubai",
		currency: "AED",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 600, endMinute: 900 }],
		regularHoursText: "10:00 – 15:00 GST",
		utcHoursText: "06:00 – 11:00 UTC",
		symbolSuffixes: [".AE", ".DU"],
		exchangeKeywords: ["ADX", "DFM", "DUBAI", "ABU DHABI"],
	},
	{
		id: "za_jse",
		name: "Johannesburg Stock Exchange (JSE)",
		shortName: "Johannesburg",
		flag: "🇿🇦",
		region: "Middle East & Africa",
		marketCategory: "stock",
		country: "South Africa",
		city: "Johannesburg",
		timeZone: "Africa/Johannesburg",
		currency: "ZAR",
		tradingDays: [1, 2, 3, 4, 5],
		sessions: [{ name: "Regular Session", session: "regular", startMinute: 540, endMinute: 1020 }],
		regularHoursText: "09:00 – 17:00 SAST",
		utcHoursText: "07:00 – 15:00 UTC",
		symbolSuffixes: [".JO"],
		exchangeKeywords: ["JSE", "JOHANNESBURG", "SOUTH AFRICA"],
	},

	// ==========================================
	// 5. Crypto Markets (Strictly for Crypto page)
	// ==========================================
	{
		id: "crypto_247",
		name: "Global Cryptocurrency Markets",
		shortName: "Crypto 24/7",
		flag: "🌐",
		region: "Global",
		marketCategory: "crypto",
		country: "Worldwide",
		city: "Decentralized",
		timeZone: "UTC",
		currency: "USD / USDT",
		tradingDays: [0, 1, 2, 3, 4, 5, 6], // 24/7/365
		sessions: [{ name: "Continuous Trading", session: "regular", startMinute: 0, endMinute: 1440 }],
		regularHoursText: "24/7 / 365 Continuous",
		utcHoursText: "Always Active",
		symbolSuffixes: ["-USD", "-USDT", "BTC", "ETH", "SOL"],
		exchangeKeywords: ["BINANCE", "COINBASE", "KRAKEN", "CRYPTO"],
	},
];

// Helper to calculate minutes & time components safely in any timezone
function getMarketLocalTime(timeZone: string, now: Date) {
	try {
		const formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hour12: false,
			weekday: "short",
			hour: "numeric",
			minute: "numeric",
			timeZoneName: "short",
		});
		const parts = formatter.formatToParts(now);
		const partMap: Record<string, string> = {};
		for (const p of parts) {
			partMap[p.type] = p.value;
		}

		const weekday = partMap.weekday || "Mon";
		const dayMap: Record<string, number> = {
			Sun: 0,
			Mon: 1,
			Tue: 2,
			Wed: 3,
			Thu: 4,
			Fri: 5,
			Sat: 6,
		};
		const dayOfWeek = dayMap[weekday] ?? 1;
		const hour = Number.parseInt(partMap.hour || "0", 10);
		const minute = Number.parseInt(partMap.minute || "0", 10);
		const currentMinutes = hour * 60 + minute;
		const tzName = partMap.timeZoneName || "";
		const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${tzName}`;

		return { dayOfWeek, weekday, hour, minute, currentMinutes, timeString };
	} catch {
		// Fallback to UTC
		const dayOfWeek = now.getUTCDay();
		const hour = now.getUTCHours();
		const minute = now.getUTCMinutes();
		const currentMinutes = hour * 60 + minute;
		const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} UTC`;
		return { dayOfWeek, weekday: "UTC", hour, minute, currentMinutes, timeString };
	}
}

// Compute market status for a given exchange definition
export function calculateMarketStatus(
	market: GlobalMarketDef,
	now: Date,
	holdingCount = 0,
): CalculatedMarketStatus {
	// Crypto special case: 24/7 always open
	if (market.marketCategory === "crypto") {
		return {
			market,
			session: "regular",
			label: "24/7 Open",
			detail: "Continuous Trading",
			color: "text-gain border-gain/30 bg-gain/10",
			dotColor: "bg-gain animate-pulse",
			countdownText: "Always Active",
			localTimeText: "24/7 Global",
			isTradingDay: true,
			holdingCount,
		};
	}

	const { dayOfWeek, currentMinutes, timeString } = getMarketLocalTime(market.timeZone, now);
	const isTradingDay = market.tradingDays.includes(dayOfWeek);

	// If weekend / non-trading day
	if (!isTradingDay) {
		const nextDayName = market.tradingDays.includes(0) ? "Sunday" : "Monday";
		const firstSession = market.sessions[0];
		const openHour = Math.floor((firstSession?.startMinute || 540) / 60);
		const openMin = (firstSession?.startMinute || 540) % 60;
		const openStr = `${openHour.toString().padStart(2, "0")}:${openMin.toString().padStart(2, "0")}`;

		return {
			market,
			session: "closed",
			label: "Closed",
			detail: "Non-Trading Day",
			color: "text-muted-foreground border-border/40 bg-muted/20",
			dotColor: "bg-muted-foreground/50",
			countdownText: `Opens ${nextDayName} ${openStr}`,
			localTimeText: timeString,
			isTradingDay: false,
			holdingCount,
		};
	}

	// It's a trading day: check active session
	for (const s of market.sessions) {
		if (currentMinutes >= s.startMinute && currentMinutes < s.endMinute) {
			const remainingMins = s.endMinute - currentMinutes;
			const remHours = Math.floor(remainingMins / 60);
			const remMins = remainingMins % 60;
			const countdown = remHours > 0 ? `${remHours}h ${remMins}m` : `${remMins}m`;

			if (s.session === "regular") {
				return {
					market,
					session: "regular",
					label: "Open",
					detail: s.name,
					color: "text-gain border-gain/30 bg-gain/10",
					dotColor: "bg-gain animate-pulse",
					countdownText: `Closes in ${countdown}`,
					localTimeText: timeString,
					isTradingDay: true,
					holdingCount,
				};
			}

			if (s.session === "lunch") {
				return {
					market,
					session: "lunch",
					label: "Lunch Halt",
					detail: "Midday Session Halt",
					color: "text-warning border-warning/30 bg-warning/10",
					dotColor: "bg-warning",
					countdownText: `Resumes in ${countdown}`,
					localTimeText: timeString,
					isTradingDay: true,
					holdingCount,
				};
			}

			if (s.session === "pre-market") {
				return {
					market,
					session: "pre-market",
					label: "Pre-Market",
					detail: s.name,
					color: "text-warning border-warning/30 bg-warning/10",
					dotColor: "bg-warning",
					countdownText: `Opens in ${countdown}`,
					localTimeText: timeString,
					isTradingDay: true,
					holdingCount,
				};
			}

			if (s.session === "after-hours") {
				return {
					market,
					session: "after-hours",
					label: "After-Hours",
					detail: s.name,
					color: "text-info border-info/30 bg-info/10",
					dotColor: "bg-info",
					countdownText: `Ends in ${countdown}`,
					localTimeText: timeString,
					isTradingDay: true,
					holdingCount,
				};
			}
		}
	}

	// Not in any active session: determine if before opening or after close
	const firstSession = market.sessions[0];

	if (firstSession && currentMinutes < firstSession.startMinute) {
		const remainingMins = firstSession.startMinute - currentMinutes;
		const remHours = Math.floor(remainingMins / 60);
		const remMins = remainingMins % 60;
		const countdown = remHours > 0 ? `${remHours}h ${remMins}m` : `${remMins}m`;

		return {
			market,
			session: "closed",
			label: "Closed",
			detail: `Pre-Opening at ${Math.floor(firstSession.startMinute / 60)
				.toString()
				.padStart(2, "0")}:${(firstSession.startMinute % 60).toString().padStart(2, "0")}`,
			color: "text-muted-foreground border-border/40 bg-muted/20",
			dotColor: "bg-muted-foreground/60",
			countdownText: `Opens in ${countdown}`,
			localTimeText: timeString,
			isTradingDay: true,
			holdingCount,
		};
	}

	// After last session
	const nextDayName =
		dayOfWeek === 5 && !market.tradingDays.includes(6)
			? market.tradingDays.includes(0)
				? "Sunday"
				: "Monday"
			: "tomorrow";

	return {
		market,
		session: "closed",
		label: "Closed",
		detail: "Day Session Completed",
		color: "text-muted-foreground border-border/40 bg-muted/20",
		dotColor: "bg-muted-foreground/60",
		countdownText: `Opens ${nextDayName}`,
		localTimeText: timeString,
		isTradingDay: true,
		holdingCount,
	};
}

// Matches a holding item to its home market
function resolveHoldingToMarket(
	holding: HoldingLocationInfo,
	markets: GlobalMarketDef[],
): GlobalMarketDef {
	const sym = (holding.symbol || "").trim().toUpperCase();
	const cur = (holding.currency || "").trim().toUpperCase();
	const ex = (holding.exchange || "").trim().toUpperCase();

	// 1. Exact or suffix match
	for (const m of markets) {
		for (const s of m.symbolSuffixes) {
			if (s && sym.endsWith(s)) return m;
		}
	}

	// 2. Exchange keyword match
	for (const m of markets) {
		for (const kw of m.exchangeKeywords) {
			if (kw && ex.includes(kw)) return m;
		}
	}

	// 3. Currency heuristic
	if (cur === "CAD") return markets.find((m) => m.id === "ca_tsx") || markets[0];
	if (cur === "GBP" || cur === "GBX") return markets.find((m) => m.id === "gb_lse") || markets[0];
	if (cur === "JPY") return markets.find((m) => m.id === "jp_tse") || markets[0];
	if (cur === "CHF") return markets.find((m) => m.id === "ch_six") || markets[0];
	if (cur === "HKD") return markets.find((m) => m.id === "hk_hkex") || markets[0];
	if (cur === "CNY") return markets.find((m) => m.id === "cn_sse") || markets[0];
	if (cur === "INR") return markets.find((m) => m.id === "in_nse") || markets[0];
	if (cur === "AUD") return markets.find((m) => m.id === "au_asx") || markets[0];
	if (cur === "SGD") return markets.find((m) => m.id === "sg_sgx") || markets[0];
	if (cur === "KRW") return markets.find((m) => m.id === "kr_krx") || markets[0];
	if (cur === "BRL") return markets.find((m) => m.id === "br_b3") || markets[0];
	if (cur === "SAR") return markets.find((m) => m.id === "sa_tadawul") || markets[0];
	if (cur === "AED") return markets.find((m) => m.id === "ae_dfm_adx") || markets[0];
	if (cur === "ZAR") return markets.find((m) => m.id === "za_jse") || markets[0];
	if (cur === "SEK") return markets.find((m) => m.id === "se_omx") || markets[0];
	if (cur === "EUR") return markets.find((m) => m.id === "fr_euronext_paris") || markets[0];

	// Default fallback to first market in allowed scope (typically US)
	return markets.find((m) => m.id === "us_nyse_nasdaq") || markets[0];
}

/**
 * Flag emojis are visual-only decoration: strip the regional-indicator pairs
 * from the accessible name so screen readers announce "Nasdaq Open" instead of
 * "flag: United States Nasdaq Open". The glyphs stay in the visible layout.
 */
function stripFlagEmoji(s: string): string {
	return s
		.replace(/[\u{1F1E6}-\u{1F1FF}]{2}\u{FE0F}?/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function MarketStatusBadge({ holdings, assetType }: MarketStatusBadgeProps) {
	const [now, setNow] = useState(() => new Date());
	const [searchQuery, setSearchQuery] = useState("");
	const [regionFilter, setRegionFilter] = useState<string>("all");

	// Update every 30 seconds
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 30000);
		return () => clearInterval(timer);
	}, []);

	// Context/Page-aware resolution:
	// If assetType is provided, respect it.
	// Otherwise inspect pathname: if on a crypto route, show crypto; on stocks page, strictly show stocks!
	const resolvedCategory: MarketCategory = useMemo(() => {
		if (assetType) return assetType;
		if (typeof window !== "undefined") {
			const path = window.location?.pathname || "";
			if (path.includes("crypto")) return "crypto";
		}
		return "stock";
	}, [assetType]);

	// Filter available markets strictly according to page context (Stocks only on stock page)
	const scopedMarkets = useMemo(() => {
		return GLOBAL_MARKETS.filter((m) => m.marketCategory === resolvedCategory);
	}, [resolvedCategory]);

	// Count holdings per market
	const holdingCountsByMarket = useMemo(() => {
		const counts: Record<string, number> = {};
		if (!holdings || holdings.length === 0) return counts;

		for (const h of holdings) {
			const m = resolveHoldingToMarket(h, scopedMarkets);
			if (m) {
				counts[m.id] = (counts[m.id] || 0) + 1;
			}
		}
		return counts;
	}, [holdings, scopedMarkets]);

	// Compute status for all scoped markets
	const allMarketStatuses = useMemo(() => {
		return scopedMarkets.map((m) => {
			const count = holdingCountsByMarket[m.id] || 0;
			return calculateMarketStatus(m, now, count);
		});
	}, [scopedMarkets, now, holdingCountsByMarket]);

	// Portfolio-held markets
	const userHeldStatuses = useMemo(() => {
		return allMarketStatuses.filter((s) => s.holdingCount > 0);
	}, [allMarketStatuses]);

	// Global statistics
	const stats = useMemo(() => {
		let openCount = 0;
		let extendedCount = 0;
		let closedCount = 0;

		for (const s of allMarketStatuses) {
			if (s.session === "regular") openCount++;
			else if (s.session === "pre-market" || s.session === "after-hours" || s.session === "lunch") {
				extendedCount++;
			} else {
				closedCount++;
			}
		}
		return { openCount, extendedCount, closedCount, total: allMarketStatuses.length };
	}, [allMarketStatuses]);

	// Determine active primary badge
	const activeStatus = useMemo(() => {
		// Priority 1: User's owned markets that are currently regular open
		const openHeld = userHeldStatuses.filter((s) => s.session === "regular");
		if (openHeld.length === 1) {
			const single = openHeld[0];
			return {
				color: single.color,
				dotColor: single.dotColor,
				label: `${single.market.flag} ${single.market.shortName} Open`,
				countdownText: single.countdownText,
			};
		}
		if (openHeld.length === 2) {
			const [a, b] = openHeld;
			return {
				color: "text-gain border-gain/30 bg-gain/10",
				dotColor: "bg-gain animate-pulse",
				label: `${a.market.flag} ${b.market.flag} ${a.market.shortName} & ${b.market.shortName} Open`,
				countdownText: a.countdownText,
			};
		}
		if (openHeld.length > 2) {
			const flags = openHeld
				.slice(0, 3)
				.map((s) => s.market.flag)
				.join(" ");
			return {
				color: "text-gain border-gain/30 bg-gain/10",
				dotColor: "bg-gain animate-pulse",
				label: `${flags} ${openHeld.length} Portfolio Markets Open`,
				countdownText: openHeld[0].countdownText,
			};
		}

		// Priority 2: User's owned markets in extended hours (pre-market, lunch, after-hours)
		const extendedHeld = userHeldStatuses.filter(
			(s) => s.session === "pre-market" || s.session === "lunch" || s.session === "after-hours",
		);
		if (extendedHeld.length > 0) {
			const first = extendedHeld[0];
			return {
				color: first.color,
				dotColor: first.dotColor,
				label: `${first.market.flag} ${first.market.shortName} ${first.label}`,
				countdownText: first.countdownText,
			};
		}

		// Priority 3: If user has no specific holdings open, check global major markets
		const allOpen = allMarketStatuses.filter((s) => s.session === "regular");
		const usMarket = allMarketStatuses.find((s) => s.market.id === "us_nyse_nasdaq");
		const parisMarket = allMarketStatuses.find((s) => s.market.id === "fr_euronext_paris");
		const tokyoMarket = allMarketStatuses.find((s) => s.market.id === "jp_tse");

		if (usMarket && usMarket.session === "regular") {
			return {
				color: usMarket.color,
				dotColor: usMarket.dotColor,
				label: "🇺🇸 Wall Street Open",
				countdownText: usMarket.countdownText,
			};
		}
		if (parisMarket && parisMarket.session === "regular") {
			return {
				color: parisMarket.color,
				dotColor: parisMarket.dotColor,
				label: "🇫🇷 Euronext Paris Open",
				countdownText: parisMarket.countdownText,
			};
		}
		if (tokyoMarket && tokyoMarket.session === "regular") {
			return {
				color: tokyoMarket.color,
				dotColor: tokyoMarket.dotColor,
				label: "🇯🇵 Tokyo TSE Open",
				countdownText: tokyoMarket.countdownText,
			};
		}

		if (allOpen.length > 0) {
			const first = allOpen[0];
			return {
				color: "text-gain border-gain/30 bg-gain/10",
				dotColor: "bg-gain animate-pulse",
				label: `${first.market.flag} ${first.market.shortName} Open (${allOpen.length} Worldwide)`,
				countdownText: first.countdownText,
			};
		}

		// Pre-market for US or Paris
		if (usMarket && usMarket.session === "pre-market") {
			return {
				color: usMarket.color,
				dotColor: usMarket.dotColor,
				label: "🇺🇸 US Pre-Market",
				countdownText: usMarket.countdownText,
			};
		}
		if (parisMarket && parisMarket.session === "pre-market") {
			return {
				color: parisMarket.color,
				dotColor: parisMarket.dotColor,
				label: "🇫🇷 Paris Pre-Opening",
				countdownText: parisMarket.countdownText,
			};
		}

		// Closed
		return {
			color: "text-muted-foreground border-border/40 bg-muted/20",
			dotColor: "bg-muted-foreground/60",
			label: resolvedCategory === "stock" ? "🌙 Stock Markets Closed" : "🌙 Markets Closed",
			countdownText: usMarket ? usMarket.countdownText : "Opens next trading day",
		};
	}, [userHeldStatuses, allMarketStatuses, resolvedCategory]);

	// Filtered markets for popup list
	const filteredStatuses = useMemo(() => {
		let list = allMarketStatuses;

		if (regionFilter === "portfolio") {
			list = list.filter((s) => s.holdingCount > 0);
		} else if (regionFilter !== "all") {
			list = list.filter((s) => s.market.region.toLowerCase() === regionFilter.toLowerCase());
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(s) =>
					s.market.name.toLowerCase().includes(q) ||
					s.market.shortName.toLowerCase().includes(q) ||
					s.market.country.toLowerCase().includes(q) ||
					s.market.city.toLowerCase().includes(q) ||
					s.market.currency.toLowerCase().includes(q) ||
					s.market.symbolSuffixes.some((suf) => suf.toLowerCase().includes(q)) ||
					s.market.exchangeKeywords.some((kw) => kw.toLowerCase().includes(q)),
			);
		}

		// Sort: portfolio holdings first, then open sessions first, then alphabet
		return list.sort((a, b) => {
			if (a.holdingCount > 0 && b.holdingCount === 0) return -1;
			if (b.holdingCount > 0 && a.holdingCount === 0) return 1;
			const sessionScore = (sess: MarketSession) => {
				if (sess === "regular") return 3;
				if (sess === "pre-market" || sess === "after-hours" || sess === "lunch") return 2;
				return 1;
			};
			const scoreDiff = sessionScore(b.session) - sessionScore(a.session);
			if (scoreDiff !== 0) return scoreDiff;
			return a.market.name.localeCompare(b.market.name);
		});
	}, [allMarketStatuses, regionFilter, searchQuery]);

	const isStockPage = resolvedCategory === "stock";

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-micro font-medium border cursor-pointer transition-all hover:brightness-110 select-none shadow-xs whitespace-nowrap shrink-0",
						activeStatus.color,
					)}
					title={
						isStockPage
							? "Click to view world stock exchanges & local trading hours"
							: "Click to view crypto markets status"
					}
					aria-label={[stripFlagEmoji(activeStatus.label), activeStatus.countdownText]
						.filter(Boolean)
						.join(" — ")}
				>
					<span className={cn("h-1.5 w-1.5 rounded-full", activeStatus.dotColor)} />
					<span className="font-semibold">{activeStatus.label}</span>
					<span className="hidden sm:inline-block text-micro font-mono">
						• {activeStatus.countdownText}
					</span>
				</button>
			</PopoverTrigger>

			<PopoverContent
				align="end"
				className="w-96 sm:w-[440px] p-4 bg-popover/95 backdrop-blur-md border-border/50 max-w-[95vw]"
			>
				<div className="space-y-3">
					{/* Header */}
					<div className="flex items-center justify-between border-b border-border/30 pb-2.5">
						<div className="flex items-center gap-2">
							<div className="p-1 rounded-md bg-primary/10 text-primary">
								<Globe className="h-4 w-4" />
							</div>
							<div>
								<h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
									{isStockPage ? "Worldwide Stock Exchanges" : "Global Crypto Markets"}
								</h2>
								<p className="text-micro text-muted-foreground">
									{isStockPage
										? `Live sessions across ${scopedMarkets.length} world equity & fund exchanges`
										: "Continuous 24/7 liquidity hubs and exchanges"}
								</p>
							</div>
						</div>

						{/* Quick summary stats */}
						<div className="flex items-center gap-1.5 text-micro font-mono">
							{/* Signal color only when there is a signal: a gain-green
							    "0 Open" chip during a full market closure reads as if
							    markets were tradable. Zero falls back to neutral chrome. */}
							{stats.openCount > 0 ? (
								<span className="px-1.5 py-0.5 rounded bg-gain/10 text-gain border border-gain/30">
									{stats.openCount} Open
								</span>
							) : (
								<span className="px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/40">
									0 Open
								</span>
							)}
							<span className="px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/40">
								{stats.closedCount} Closed
							</span>
						</div>
					</div>

					{/* Search & Filter Bar */}
					<div className="space-y-2">
						<div className="relative">
							<Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder={
									isStockPage
										? "Search stock exchange, country, city, currency…"
										: "Search cryptocurrency exchange, currency…"
								}
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-7 text-xs pl-8 pr-2 bg-background/50 border-border/40"
							/>
						</div>

						{/* Region Pills */}
						<div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-micro">
							<button
								type="button"
								onClick={() => setRegionFilter("all")}
								className={cn(
									"px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer border",
									regionFilter === "all"
										? "bg-primary text-primary-foreground border-primary"
										: "bg-muted/30 text-muted-foreground border-border/40 hover:text-foreground",
								)}
							>
								All ({scopedMarkets.length})
							</button>

							{userHeldStatuses.length > 0 && (
								<button
									type="button"
									onClick={() => setRegionFilter("portfolio")}
									className={cn(
										"px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer border font-semibold",
										regionFilter === "portfolio"
											? "bg-primary text-primary-foreground border-primary"
											: "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20",
									)}
								>
									💼 My Portfolio ({userHeldStatuses.length})
								</button>
							)}

							{isStockPage && (
								<>
									<button
										type="button"
										onClick={() => setRegionFilter("americas")}
										className={cn(
											"px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer border",
											regionFilter === "americas"
												? "bg-primary text-primary-foreground border-primary"
												: "bg-muted/30 text-muted-foreground border-border/40 hover:text-foreground",
										)}
									>
										Americas
									</button>

									<button
										type="button"
										onClick={() => setRegionFilter("europe")}
										className={cn(
											"px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer border",
											regionFilter === "europe"
												? "bg-primary text-primary-foreground border-primary"
												: "bg-muted/30 text-muted-foreground border-border/40 hover:text-foreground",
										)}
									>
										Europe
									</button>

									<button
										type="button"
										onClick={() => setRegionFilter("asia-pacific")}
										className={cn(
											"px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer border",
											regionFilter === "asia-pacific"
												? "bg-primary text-primary-foreground border-primary"
												: "bg-muted/30 text-muted-foreground border-border/40 hover:text-foreground",
										)}
									>
										Asia-Pacific
									</button>

									<button
										type="button"
										onClick={() => setRegionFilter("middle east & africa")}
										className={cn(
											"px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer border",
											regionFilter === "middle east & africa"
												? "bg-primary text-primary-foreground border-primary"
												: "bg-muted/30 text-muted-foreground border-border/40 hover:text-foreground",
										)}
									>
										Middle East & Africa
									</button>
								</>
							)}
						</div>
					</div>

					{/* Markets List */}
					<ScrollArea className="h-72 pr-2">
						<div className="space-y-2">
							{filteredStatuses.length === 0 ? (
								<div className="py-8 text-center text-xs text-muted-foreground">
									No exchanges found matching &ldquo;{searchQuery}&rdquo;.
								</div>
							) : (
								filteredStatuses.map((s) => {
									const isHeld = s.holdingCount > 0;
									return (
										<div
											key={s.market.id}
											className={cn(
												"p-2.5 rounded-lg border transition-all space-y-1.5",
												isHeld
													? "border-primary/40 bg-primary/5 hover:border-primary/60"
													: "border-border/30 bg-card/40 hover:border-border/60",
											)}
										>
											<div className="flex items-start justify-between gap-2">
												<div className="flex items-center gap-2 min-w-0">
													<span aria-hidden className="text-base shrink-0 select-none">
														{s.market.flag}
													</span>
													<div className="min-w-0">
														<div className="flex items-center gap-1.5 flex-wrap">
															<span className="text-xs font-semibold text-foreground truncate">
																{s.market.name}
															</span>
															{isHeld && (
																<Badge
																	variant="secondary"
																	className="text-micro h-3.5 px-1 bg-primary/20 text-primary border-primary/30"
																>
																	{s.holdingCount} {s.holdingCount === 1 ? "holding" : "holdings"}
																</Badge>
															)}
														</div>
														<div className="text-micro text-muted-foreground flex items-center gap-1.5 flex-wrap">
															<span>
																{s.market.city}, {s.market.country}
															</span>
															<span>•</span>
															<span className="font-mono">{s.market.currency}</span>
															<span>•</span>
															<span className="font-mono">{s.localTimeText}</span>
														</div>
													</div>
												</div>

												{/* Status Badge */}
												<Badge
													variant="outline"
													className={cn(
														"text-micro h-5 font-semibold shrink-0 select-none",
														s.color,
													)}
												>
													<span className={cn("h-1.5 w-1.5 rounded-full mr-1", s.dotColor)} />
													{s.label}
												</Badge>
											</div>

											{/* Secondary status info */}
											<div className="flex items-center justify-between text-micro text-muted-foreground pt-0.5 border-t border-border/20">
												<div className="font-mono text-muted-foreground">
													{s.market.regularHoursText} ({s.market.utcHoursText})
												</div>
												<div className="font-mono font-medium text-foreground/80">
													{s.countdownText}
												</div>
											</div>
										</div>
									);
								})
							)}
						</div>
					</ScrollArea>

					{/* Footer Note */}
					<div className="flex items-center gap-2 pt-1 border-t border-border/25 text-micro text-muted-foreground">
						<Clock className="h-3 w-3 shrink-0 text-primary" />
						<span>
							{isStockPage
								? "Clocks track official exchange trading sessions with automated DST & local holidays."
								: "Cryptocurrency markets operate 24 hours a day, 365 days a year globally."}
						</span>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

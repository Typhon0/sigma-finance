import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import {
	Building2,
	Coins,
	Database,
	ExternalLink,
	Loader2,
	Search,
	ShieldAlert,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import type {
	PersistDiscoveredInstrumentMutation,
	PersistDiscoveredInstrumentMutationVariables,
	SearchInstrumentsOnlineQuery,
	SearchInstrumentsOnlineQueryVariables,
	SearchInstrumentsQuery,
	SearchInstrumentsQueryVariables,
} from "@/gql/graphql";
import { InstrumentAssetType } from "@/gql/graphql";
import { PERSIST_DISCOVERED_INSTRUMENT } from "@/graphql/mutations/instruments";
import { SEARCH_INSTRUMENTS, SEARCH_INSTRUMENTS_ONLINE } from "@/graphql/queries/instruments";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

const CURRENCY_CONFIG: Record<string, { symbol: string }> = {
	USD: { symbol: "$" },
	EUR: { symbol: "€" },
	GBP: { symbol: "£" },
};

function getCurrencySymbol(currency: string | null | undefined): string {
	if (!currency) return "";
	return CURRENCY_CONFIG[currency]?.symbol ?? currency;
}

function getCountryFlag(country: string | null | undefined): string {
	if (!country) return "";
	const normalized = country.trim().toUpperCase();
	const flagMap: Record<string, string> = {
		US: "🇺🇸",
		USA: "🇺🇸",
		"UNITED STATES": "🇺🇸",
		"UNITED STATES OF AMERICA": "🇺🇸",
		GB: "🇬🇧",
		GBR: "🇬🇧",
		"UNITED KINGDOM": "🇬🇧",
		UK: "🇬🇧",
		AR: "🇦🇷",
		ARG: "🇦🇷",
		ARGENTINA: "🇦🇷",
		IT: "🇮🇹",
		ITA: "🇮🇹",
		ITALY: "🇮🇹",
		DE: "🇩🇪",
		DEU: "🇩🇪",
		GERMANY: "🇩🇪",
		FR: "🇫🇷",
		FRA: "🇫🇷",
		FRANCE: "🇫🇷",
		CA: "🇨🇦",
		CAN: "🇨🇦",
		CANADA: "🇨🇦",
		AU: "🇦🇺",
		AUS: "🇦🇺",
		AUSTRALIA: "🇦🇺",
		JP: "🇯🇵",
		JPN: "🇯🇵",
		JAPAN: "🇯🇵",
		CH: "🇨🇭",
		CHE: "🇨🇭",
		SWITZERLAND: "🇨🇭",
		CN: "🇨🇳",
		CHN: "🇨🇳",
		CHINA: "🇨🇳",
		HK: "🇭🇰",
		HKG: "🇭🇰",
		"HONG KONG": "🇭🇰",
		BR: "🇧🇷",
		BRA: "🇧🇷",
		BRAZIL: "🇧🇷",
		ES: "🇪🇸",
		ESP: "🇪🇸",
		SPAIN: "🇪🇸",
		NL: "🇳🇱",
		NLD: "🇳🇱",
		NETHERLANDS: "🇳🇱",
		HOLLAND: "🇳🇱",
		SE: "🇸🇪",
		SWE: "🇸🇪",
		SWEDEN: "🇸🇪",
		IN: "🇮🇳",
		IND: "🇮🇳",
		INDIA: "🇮🇳",
		KR: "🇰🇷",
		KOR: "🇰🇷",
		"SOUTH KOREA": "🇰🇷",
		IE: "🇮🇪",
		IRL: "🇮🇪",
		IRELAND: "🇮🇪",
	};

	if (flagMap[normalized]) {
		return flagMap[normalized];
	}

	if (normalized.length <= 3) {
		return normalized;
	}

	return "🌐";
}

function renderAssetTypeIcon(assetType: InstrumentAssetType) {
	switch (assetType) {
		case InstrumentAssetType.Crypto:
			return (
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground border border-border/60 flex-shrink-0">
					<Coins className="h-4 w-4" />
				</div>
			);
		case InstrumentAssetType.Fund:
			return (
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground border border-border/60 flex-shrink-0">
					<Building2 className="h-4 w-4" />
				</div>
			);
		default:
			return (
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground border border-border/60 flex-shrink-0">
					<TrendingUp className="h-4 w-4" />
				</div>
			);
	}
}

export interface TradeableInstrumentSelection {
	id: string;
	symbol: string;
	name: string;
	exchange: string;
	exchangeCode?: string | null;
	country?: string | null;
	currency?: string | null;
	sector?: string | null;
	assetType: InstrumentAssetType;
	providerSource: string;
	providerExternalId?: string | null;
	isin?: string | null;
	figi?: string | null;
	cusip?: string | null;
	source: "local" | "online" | "manual";
}

export interface TradeableInstrumentSearchProps {
	assetTypes: readonly InstrumentAssetType[];
	value: TradeableInstrumentSelection | null;
	onChange: (selection: TradeableInstrumentSelection | null) => void;
	placeholder?: string;
	allowOnlineSearch?: boolean;
}

type LocalSearchResult = SearchInstrumentsQuery["searchInstruments"]["localResults"][number];
type OnlineSearchResult =
	SearchInstrumentsOnlineQuery["searchInstrumentsOnline"]["onlineResults"][number];

function mapLocalResult(result: LocalSearchResult): TradeableInstrumentSelection {
	return {
		id: result.instrument.id,
		symbol: result.instrument.symbol,
		name: result.instrument.name,
		exchange: result.instrument.exchange,
		exchangeCode: result.instrument.exchangeCode,
		country: result.instrument.country,
		currency: result.instrument.currency,
		sector: result.instrument.sector,
		assetType: result.instrument.assetType,
		providerSource: result.instrument.providerSource,
		providerExternalId: result.instrument.providerExternalId,
		source: "local",
	};
}

function mapPersistedResult(
	instrument: PersistDiscoveredInstrumentMutation["persistDiscoveredInstrument"],
	source: "online" | "manual",
): TradeableInstrumentSelection {
	return {
		id: instrument.id,
		symbol: instrument.symbol,
		name: instrument.name,
		exchange: instrument.exchange,
		exchangeCode: instrument.exchangeCode,
		country: instrument.country,
		currency: instrument.currency,
		sector: instrument.sector,
		assetType: instrument.assetType,
		providerSource: instrument.providerSource,
		providerExternalId: instrument.providerExternalId,
		isin: instrument.isin,
		figi: instrument.figi,
		cusip: instrument.cusip,
		source,
	};
}

function mapOnlineResult(
	result: OnlineSearchResult,
): PersistDiscoveredInstrumentMutationVariables["input"]["instrument"] {
	return {
		symbol: result.symbol,
		name: result.name,
		exchange: result.exchange,
		exchangeCode: result.exchangeCode,
		country: result.country,
		currency: result.currency,
		assetType: result.assetType,
		providerSource: result.providerSource,
		providerExternalId: result.providerExternalId,
		isin: result.isin,
		figi: result.figi,
		cusip: result.cusip,
	};
}

function buildManualInstrument(
	query: string,
	assetTypes: readonly InstrumentAssetType[],
): PersistDiscoveredInstrumentMutationVariables["input"]["instrument"] {
	const trimmed = query.trim();
	const assetType = assetTypes[0] ?? InstrumentAssetType.Stock;
	return {
		symbol: trimmed.toUpperCase(),
		name: trimmed,
		exchange: "Manual",
		exchangeCode: "manual",
		country: undefined,
		currency: undefined,
		assetType,
		providerSource: "manual",
		providerExternalId: undefined,
		isin: undefined,
		figi: undefined,
		cusip: undefined,
	};
}

interface NavigatableItem {
	type: "local" | "online" | "search-online" | "add-manual" | "clear";
	id: string;
	data?: LocalSearchResult | OnlineSearchResult;
}

export function TradeableInstrumentSearch({
	assetTypes,
	value,
	onChange,
	placeholder = "Search symbol or company name...",
	allowOnlineSearch = true,
}: TradeableInstrumentSearchProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [isSearchingOnline, setIsSearchingOnline] = useState(false);
	const [focusedIndex, setFocusedIndex] = useState<number>(-1);
	const [activeTab, setActiveTab] = useState<"all" | InstrumentAssetType>("all");

	const debouncedSearchTerm = useDebounce(searchTerm.trim(), 350);
	const searchVariables = useMemo<SearchInstrumentsQueryVariables | undefined>(() => {
		if (debouncedSearchTerm.length < 2) {
			return undefined;
		}
		return {
			input: {
				query: debouncedSearchTerm,
				assetTypes: [...assetTypes],
				limit: 8,
				offset: 0,
			},
		};
	}, [assetTypes, debouncedSearchTerm]);

	const { data: localData, loading: isSearchingLocal } = useQuery<
		SearchInstrumentsQuery,
		SearchInstrumentsQueryVariables
	>(SEARCH_INSTRUMENTS, {
		variables: searchVariables,
		skip: searchVariables === undefined,
		fetchPolicy: "cache-and-network",
	});
	const [fetchOnline, { data: onlineData }] = useLazyQuery<
		SearchInstrumentsOnlineQuery,
		SearchInstrumentsOnlineQueryVariables
	>(SEARCH_INSTRUMENTS_ONLINE, {
		fetchPolicy: "network-only",
	});
	const [persistDiscoveredInstrument] = useMutation<
		PersistDiscoveredInstrumentMutation,
		PersistDiscoveredInstrumentMutationVariables
	>(PERSIST_DISCOVERED_INSTRUMENT);

	const localResults = localData?.searchInstruments.localResults ?? [];
	const onlineResults = onlineData?.searchInstrumentsOnline.onlineResults ?? [];
	const canSearchOnline = true;

	const filteredLocalResults = useMemo(() => {
		if (activeTab === "all") return localResults;
		return localResults.filter((r) => r.instrument.assetType === activeTab);
	}, [localResults, activeTab]);

	const filteredOnlineResults = useMemo(() => {
		if (activeTab === "all") return onlineResults;
		return onlineResults.filter((r) => r.assetType === activeTab);
	}, [onlineResults, activeTab]);

	const navigatableItems = useMemo<readonly NavigatableItem[]>(() => {
		const items: NavigatableItem[] = [];

		for (const result of filteredLocalResults) {
			items.push({
				type: "local",
				id: `local:${result.instrument.id}`,
				data: result,
			});
		}

		if (allowOnlineSearch && debouncedSearchTerm.length >= 2 && canSearchOnline) {
			items.push({
				type: "search-online",
				id: "action:search-online",
			});
		}

		if (debouncedSearchTerm.length >= 2) {
			items.push({
				type: "add-manual",
				id: "action:add-manual",
			});
		}

		for (const result of filteredOnlineResults) {
			const key = `${result.providerSource}:${result.providerExternalId ?? result.symbol}`;
			items.push({
				type: "online",
				id: `online:${key}`,
				data: result,
			});
		}

		if (value) {
			items.push({
				type: "clear",
				id: "action:clear",
			});
		}

		return items;
	}, [
		filteredLocalResults,
		filteredOnlineResults,
		allowOnlineSearch,
		debouncedSearchTerm,
		canSearchOnline,
		value,
	]);

	// Pre-compute id→index map for O(1) lookups instead of O(n) findIndex in render loops
	const navigatableIndexMap = useMemo(() => {
		const map = new Map<string, number>();
		for (let i = 0; i < navigatableItems.length; i++) {
			map.set(navigatableItems[i].id, i);
		}
		return map;
	}, [navigatableItems]);

	const focusedItem = useMemo(() => {
		return focusedIndex >= 0 && focusedIndex < navigatableItems.length
			? navigatableItems[focusedIndex]
			: null;
	}, [focusedIndex, navigatableItems]);

	const previewInstrument = useMemo(() => {
		if (!focusedItem) return null;
		if (focusedItem.type === "local") {
			const res = focusedItem.data as LocalSearchResult;
			return {
				symbol: res.instrument.symbol,
				name: res.instrument.name,
				exchange: res.instrument.exchange,
				exchangeCode: res.instrument.exchangeCode,
				currency: res.instrument.currency,
				assetType: res.instrument.assetType,
				sector: res.instrument.sector,
				country: res.instrument.country,
				providerSource: "local",
				isin: res.instrument.isin,
				figi: res.instrument.figi,
				cusip: res.instrument.cusip,
				industry: res.instrument.industry,
				website: res.instrument.website,
				family: res.instrument.family,
				category: res.instrument.category,
				city: res.instrument.city,
				state: res.instrument.state,
			};
		}
		if (focusedItem.type === "online") {
			const res = focusedItem.data as OnlineSearchResult;
			return {
				symbol: res.symbol,
				name: res.name,
				exchange: res.exchange,
				exchangeCode: res.exchangeCode,
				currency: res.currency,
				assetType: res.assetType,
				sector: undefined,
				country: res.country,
				providerSource: res.providerSource,
				isin: res.isin,
				figi: res.figi,
				cusip: res.cusip,
				industry: undefined,
				website: undefined,
				family: undefined,
				category: undefined,
				city: undefined,
				state: undefined,
			};
		}
		return null;
	}, [focusedItem]);

	const handleSelectLocal = (result: LocalSearchResult) => {
		onChange(mapLocalResult(result));
		setSearchTerm("");
	};

	const handleSelectOnline = async (result: OnlineSearchResult) => {
		const response = await persistDiscoveredInstrument({
			variables: {
				input: {
					instrument: mapOnlineResult(result),
				},
			},
		});
		const persisted = response.data?.persistDiscoveredInstrument;
		if (!persisted) {
			return;
		}
		onChange(mapPersistedResult(persisted, "online"));
		setSearchTerm("");
	};

	const handleAddManual = async () => {
		const trimmed = debouncedSearchTerm;
		if (trimmed.length < 2) {
			return;
		}
		const response = await persistDiscoveredInstrument({
			variables: {
				input: {
					instrument: buildManualInstrument(trimmed, assetTypes),
				},
			},
		});
		const persisted = response.data?.persistDiscoveredInstrument;
		if (!persisted) {
			return;
		}
		onChange(mapPersistedResult(persisted, "manual"));
		setSearchTerm("");
	};

	const searchOnline = async () => {
		if (!allowOnlineSearch || debouncedSearchTerm.length < 2) {
			return;
		}
		setIsSearchingOnline(true);
		try {
			await fetchOnline({
				variables: {
					input: {
						query: debouncedSearchTerm,
						assetTypes: [...assetTypes],
						limit: 8,
						offset: 0,
					},
				},
			});
		} finally {
			setIsSearchingOnline(false);
		}
	};

	const clearSelection = () => {
		onChange(null);
		setSearchTerm("");
	};

	const handleItemSelection = (item: NavigatableItem) => {
		switch (item.type) {
			case "local":
				if (item.data) handleSelectLocal(item.data as LocalSearchResult);
				break;
			case "online":
				if (item.data) void handleSelectOnline(item.data as OnlineSearchResult);
				break;
			case "search-online":
				void searchOnline();
				break;
			case "add-manual":
				void handleAddManual();
				break;
			case "clear":
				clearSelection();
				break;
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setFocusedIndex((prev) => (prev < navigatableItems.length - 1 ? prev + 1 : 0));
				break;
			case "ArrowUp":
				e.preventDefault();
				setFocusedIndex((prev) => (prev > 0 ? prev - 1 : navigatableItems.length - 1));
				break;
			case "Enter":
				e.preventDefault();
				if (focusedIndex >= 0 && focusedIndex < navigatableItems.length) {
					const item = navigatableItems[focusedIndex];
					handleItemSelection(item);
				}
				break;
			case "Escape":
				e.preventDefault();
				setSearchTerm("");
				break;
		}
	};

	return (
		<div className="space-y-4">
			<SearchInput
				placeholder={placeholder}
				value={searchTerm}
				onChange={(e) => {
					setSearchTerm(e.target.value);
					setFocusedIndex(-1);
				}}
				onKeyDown={handleKeyDown}
				onClear={() => {
					setSearchTerm("");
					onChange(null);
				}}
				className="h-11 rounded-xl focus-visible:ring-primary border-border/80"
			/>

			{searchTerm.trim().length >= 1 && (
				<div className="border border-border/60 bg-card rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border/40 max-h-[480px] animate-in fade-in slide-in-from-top-1.5 duration-75">
					{/* Left Pane: Search List */}
					<div className="flex-1 overflow-hidden flex flex-col min-w-0 max-h-[480px]">
						{/* TradingView-style Tabs Header */}
						<div className="flex items-center gap-1.5 p-2.5 bg-muted/20 border-b border-border/40 overflow-x-auto scrollbar-none select-none flex-shrink-0">
							<button
								type="button"
								onClick={() => {
									setActiveTab("all");
									setFocusedIndex(-1);
								}}
								className={cn(
									"px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-100 border border-transparent whitespace-nowrap",
									activeTab === "all"
										? "bg-primary/10 text-primary border-primary/20 shadow-sm"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/40",
								)}
							>
								All Instruments
							</button>
							{assetTypes.map((type) => (
								<button
									key={type}
									type="button"
									onClick={() => {
										setActiveTab(type);
										setFocusedIndex(-1);
									}}
									className={cn(
										"px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-100 border border-transparent whitespace-nowrap capitalize",
										activeTab === type
											? "bg-primary/10 text-primary border-primary/20 shadow-sm"
											: "text-muted-foreground hover:text-foreground hover:bg-accent/40",
									)}
								>
									{type.toLowerCase()}s
								</button>
							))}
						</div>

						<div className="flex-1 overflow-y-auto max-h-[380px] scrollbar-thin">
							{isSearchingLocal && (
								<div className="flex items-center gap-2 px-5 py-5 text-xs text-muted-foreground">
									<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
									<span>Searching local catalog...</span>
								</div>
							)}

							{debouncedSearchTerm.length < 2 && !isSearchingLocal && (
								<div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground space-y-2 select-none">
									<Search className="h-8 w-8 text-muted-foreground/30 stroke-[1.5]" />
									<span>Type at least 2 characters to search...</span>
								</div>
							)}

							{!isSearchingLocal &&
								filteredLocalResults.length === 0 &&
								debouncedSearchTerm.length >= 2 && (
									<div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground space-y-1 select-none">
										<ShieldAlert className="h-8 w-8 text-muted-foreground/30 stroke-[1.5]" />
										<span>No matches found for this filter.</span>
									</div>
								)}

							{filteredLocalResults.length > 0 && (
								<div className="space-y-0.5 p-2">
									<div className="px-3.5 py-2 text-micro font-bold tracking-wider text-muted-foreground uppercase select-none">
										Local Results
									</div>
									{filteredLocalResults.map((result) => {
										const index = navigatableIndexMap.get(`local:${result.instrument.id}`) ?? -1;
										const isFocused = focusedIndex === index;
										const queryUpper = searchTerm.trim().toUpperCase();
										const isExactMatch =
											result.instrument.symbol.toUpperCase() === queryUpper ||
											(result.instrument.isin &&
												result.instrument.isin.toUpperCase() === queryUpper);
										return (
											<div
												key={result.instrument.id}
												onClick={() => handleSelectLocal(result)}
												onMouseEnter={() => setFocusedIndex(index)}
												className={cn(
													"flex items-center justify-between gap-3 py-2 px-3 cursor-pointer border-l-2 border-transparent transition-all duration-150 rounded-lg hover:bg-accent/40 select-none",
													isFocused && "bg-accent/60 border-l-primary",
												)}
											>
												<div className="flex items-center gap-2.5 min-w-0 flex-1">
													{/* Left: Flag & Symbol */}
													<div className="flex items-center gap-2 w-32 flex-shrink-0">
														<span
															className="text-base leading-none select-none filter drop-shadow-sm flex-shrink-0"
															title={result.instrument.country ?? ""}
														>
															{getCountryFlag(result.instrument.country)}
														</span>
														<span className="font-extrabold text-sm tracking-tight font-mono text-foreground truncate">
															{result.instrument.symbol}
														</span>
														{isExactMatch && (
															<Badge className="bg-gain/10 text-gain border border-gain/20 text-micro font-extrabold h-4 px-1 py-0 rounded-xs select-none">
																Match
															</Badge>
														)}
													</div>

													{/* Middle: Company Name & ISIN */}
													<div className="flex flex-col min-w-0 flex-1">
														<span className="truncate text-xs font-semibold text-foreground/80 leading-snug">
															{result.instrument.name}
														</span>
														{result.instrument.isin && (
															<span className="text-micro text-muted-foreground font-mono leading-none mt-0.5">
																ISIN: {result.instrument.isin}
															</span>
														)}
													</div>
												</div>

												{/* Right: Exchange + Type + Action */}
												<div className="flex items-center gap-2 flex-shrink-0">
													{result.instrument.exchangeCode && (
														<span
															className="text-micro font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded uppercase truncate max-w-[60px]"
															title={result.instrument.exchange}
														>
															{result.instrument.exchangeCode}
														</span>
													)}
													<Badge
														variant="outline"
														className="text-micro h-4.5 px-1.5 py-0 border-border/60 text-muted-foreground bg-muted/40 font-bold rounded-sm uppercase tracking-wide"
													>
														{result.instrument.assetType.toLowerCase()}
													</Badge>
													<div className="flex items-center gap-1 rounded-md px-2 py-0.5 text-micro font-bold border bg-gain/5 text-gain border-gain/20 select-none w-[72px] flex-shrink-0 justify-center">
														<Database className="h-2.5 w-2.5" />
														<span>Installed</span>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}

							{filteredOnlineResults.length > 0 && (
								<div className="space-y-0.5 p-2 border-t border-border/40">
									<div className="px-3.5 py-2 text-micro font-bold tracking-wider text-muted-foreground uppercase select-none">
										Online Results
									</div>
									{filteredOnlineResults.map((result) => {
										const key = `${result.providerSource}:${result.providerExternalId ?? result.symbol}`;
										const index = navigatableIndexMap.get(`online:${key}`) ?? -1;
										const isFocused = focusedIndex === index;
										const queryUpper = searchTerm.trim().toUpperCase();
										const isExactMatch =
											result.symbol.toUpperCase() === queryUpper ||
											(result.isin && result.isin.toUpperCase() === queryUpper);
										return (
											<div
												key={key}
												onClick={() => void handleSelectOnline(result)}
												onMouseEnter={() => setFocusedIndex(index)}
												className={cn(
													"flex items-center justify-between gap-3 py-2 px-3 cursor-pointer border-l-2 border-transparent transition-all duration-150 rounded-lg hover:bg-accent/40 group/item select-none",
													isFocused && "bg-accent/60 border-l-primary",
												)}
											>
												<div className="flex items-center gap-2.5 min-w-0 flex-1">
													{/* Left: Flag & Symbol */}
													<div className="flex items-center gap-2 w-32 flex-shrink-0">
														<span
															className="text-base leading-none select-none filter drop-shadow-sm flex-shrink-0"
															title={result.country ?? ""}
														>
															{getCountryFlag(result.country)}
														</span>
														<span className="font-extrabold text-sm tracking-tight font-mono text-foreground truncate">
															{result.symbol}
														</span>
														{isExactMatch && (
															<Badge className="bg-gain/10 text-gain border border-gain/20 text-micro font-extrabold h-4 px-1 py-0 rounded-xs select-none">
																Match
															</Badge>
														)}
													</div>

													{/* Middle: Company Name & ISIN */}
													<div className="flex flex-col min-w-0 flex-1">
														<span className="truncate text-xs font-semibold text-foreground/80 leading-snug">
															{result.name}
														</span>
														{result.isin && (
															<span className="text-micro text-muted-foreground font-mono leading-none mt-0.5">
																ISIN: {result.isin}
															</span>
														)}
													</div>
												</div>

												{/* Right: Exchange + Type + Action */}
												<div className="flex items-center gap-2 flex-shrink-0">
													{result.exchange && (
														<span
															className="text-micro font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded uppercase truncate max-w-[60px]"
															title={result.exchange}
														>
															{result.exchangeCode ?? result.exchange}
														</span>
													)}
													<Badge
														variant="outline"
														className="text-micro h-4.5 px-1.5 py-0 border-border/60 text-muted-foreground bg-muted/40 font-bold rounded-sm uppercase tracking-wide"
													>
														{result.assetType.toLowerCase()}
													</Badge>
													<div className="flex h-5 items-center gap-1 rounded-md px-2 text-micro font-semibold border bg-muted/40 text-muted-foreground transition-colors group-hover/item:bg-primary/10 group-hover/item:text-primary group-hover/item:border-primary/20 select-none w-[72px] flex-shrink-0 justify-center">
														<Sparkles className="h-2.5 w-2.5" />
														<span>Import</span>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Action Footer */}
						{((allowOnlineSearch && debouncedSearchTerm.length >= 2 && canSearchOnline) ||
							debouncedSearchTerm.length >= 2 ||
							value) && (
							<div className="p-2 border-t border-border/40 bg-muted/20 space-y-1 select-none flex-shrink-0">
								{allowOnlineSearch &&
									debouncedSearchTerm.length >= 2 &&
									canSearchOnline &&
									(() => {
										const index = navigatableIndexMap.get("action:search-online") ?? -1;
										const isFocused = focusedIndex === index;
										return (
											<Button
												type="button"
												variant="ghost"
												className={cn(
													"w-full justify-start gap-2 h-8.5 px-3.5 text-micro font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-all",
													isFocused && "bg-accent/60 text-foreground",
												)}
												disabled={isSearchingOnline}
												onClick={() => void searchOnline()}
												onMouseEnter={() => setFocusedIndex(index)}
											>
												{isSearchingOnline ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<ExternalLink className="h-3.5 w-3.5 text-primary" />
												)}
												<span>Search online for "{debouncedSearchTerm}"</span>
											</Button>
										);
									})()}

								{debouncedSearchTerm.length >= 2 &&
									(() => {
										const index = navigatableIndexMap.get("action:add-manual") ?? -1;
										const isFocused = focusedIndex === index;
										return (
											<Button
												type="button"
												variant="ghost"
												className={cn(
													"w-full justify-start gap-2 h-8.5 px-3.5 text-micro font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-all",
													isFocused && "bg-accent/60 text-foreground",
												)}
												onClick={() => void handleAddManual()}
												onMouseEnter={() => setFocusedIndex(index)}
											>
												<ShieldAlert className="h-3.5 w-3.5 text-warning" />
												<span>Add "{debouncedSearchTerm}" manually (unverified)</span>
											</Button>
										);
									})()}

								{value &&
									(() => {
										const index = navigatableIndexMap.get("action:clear") ?? -1;
										const isFocused = focusedIndex === index;
										return (
											<Button
												type="button"
												variant="ghost"
												className={cn(
													"w-full justify-center h-8.5 px-3.5 text-micro font-medium text-destructive hover:bg-destructive/10 rounded-md transition-all",
													isFocused && "bg-destructive/15 text-destructive",
												)}
												onClick={clearSelection}
												onMouseEnter={() => setFocusedIndex(index)}
											>
												Clear Selection
											</Button>
										);
									})()}
							</div>
						)}
					</div>

					{/* Right Pane: Instrument Details Preview */}
					<div className="w-full md:w-[320px] lg:w-[340px] flex-shrink-0 bg-muted/10 p-5 overflow-y-auto max-h-[480px]">
						{previewInstrument ? (
							<div className="space-y-4 animate-in fade-in duration-75">
								{/* Header: Icon + Symbol + Source badge */}
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-3">
										{renderAssetTypeIcon(previewInstrument.assetType)}
										<div>
											<span className="font-extrabold text-base font-mono text-foreground leading-none tracking-tight block">
												{previewInstrument.symbol}
											</span>
											<span className="text-micro font-bold text-muted-foreground block mt-1.5 uppercase tracking-wider">
												{previewInstrument.assetType.toLowerCase()}
											</span>
										</div>
									</div>
									<Badge
										variant="secondary"
										className={cn(
											"text-micro font-bold px-2.5 py-0.5 rounded-full select-none border uppercase tracking-wider",
											previewInstrument.providerSource === "local" ||
												previewInstrument.providerSource === "manual"
												? "bg-gain/10 text-gain border-gain/25"
												: "bg-info/10 text-info border-info/25",
										)}
									>
										{previewInstrument.providerSource === "local"
											? "Local DB"
											: previewInstrument.providerSource}
									</Badge>
								</div>

								{/* Full name */}
								<div className="space-y-1">
									<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block">
										Company / Fund Name
									</span>
									<p className="text-xs font-bold text-foreground/90 leading-normal">
										{previewInstrument.name}
									</p>
								</div>

								{/* Rebranding Alert Notice */}
								{previewInstrument.isin === "FR0011871128" && (
									<div className="rounded-xl bg-warning/5 border border-warning/20 p-3 text-micro text-warning leading-normal flex items-start gap-2.5 animate-in fade-in duration-75">
										<Sparkles className="h-4 w-4 text-warning shrink-0 mt-0.5" />
										<span>
											<strong>Rebranding Notice:</strong> This fund was rebranded from Lyxor to{" "}
											<strong>Amundi</strong> following their corporate merger. The ISIN code is
											identical, guaranteeing full data sync.
										</span>
									</div>
								)}

								<div className="border-t border-border/40" />

								{/* Dynamic Asset Info */}
								<div className="space-y-4">
									<h4 className="text-micro font-bold text-muted-foreground uppercase tracking-wider select-none">
										{previewInstrument.assetType === InstrumentAssetType.Stock
											? "About Company"
											: "About Fund / ETF"}
									</h4>

									<div className="grid grid-cols-2 gap-y-4 gap-x-4 text-xs">
										{/* Common Fields */}
										{previewInstrument.exchange && (
											<div>
												<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
													Exchange
												</span>
												<span
													className="font-semibold text-foreground/90 truncate block"
													title={previewInstrument.exchange}
												>
													{previewInstrument.exchangeCode
														? `${previewInstrument.exchangeCode} — ${previewInstrument.exchange}`
														: previewInstrument.exchange}
												</span>
											</div>
										)}
										{previewInstrument.currency && (
											<div>
												<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
													Currency
												</span>
												<span className="font-semibold font-mono text-foreground/90 block">
													{previewInstrument.currency.toUpperCase()} (
													{getCurrencySymbol(previewInstrument.currency)})
												</span>
											</div>
										)}
										{previewInstrument.country && (
											<div>
												<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
													Country
												</span>
												<span className="font-semibold text-foreground/90 block">
													{getCountryFlag(previewInstrument.country)} {previewInstrument.country}
												</span>
											</div>
										)}

										{/* Stock Specific Fields */}
										{previewInstrument.assetType === InstrumentAssetType.Stock && (
											<>
												{previewInstrument.sector && (
													<div>
														<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
															Sector
														</span>
														<span
															className="font-semibold text-foreground/90 truncate block"
															title={previewInstrument.sector}
														>
															{previewInstrument.sector}
														</span>
													</div>
												)}
												{previewInstrument.industry && (
													<div>
														<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
															Industry
														</span>
														<span
															className="font-semibold text-foreground/90 truncate block"
															title={previewInstrument.industry}
														>
															{previewInstrument.industry}
														</span>
													</div>
												)}
												{[previewInstrument.city, previewInstrument.state]
													.filter(Boolean)
													.join(", ") && (
													<div>
														<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
															Headquarters
														</span>
														<span
															className="font-semibold text-foreground/90 truncate block"
															title={[previewInstrument.city, previewInstrument.state]
																.filter(Boolean)
																.join(", ")}
														>
															{[previewInstrument.city, previewInstrument.state]
																.filter(Boolean)
																.join(", ")}
														</span>
													</div>
												)}
												{previewInstrument.website && (
													<div>
														<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
															Website
														</span>
														<a
															href={
																previewInstrument.website.startsWith("http")
																	? previewInstrument.website
																	: `https://${previewInstrument.website}`
															}
															target="_blank"
															rel="noopener noreferrer"
															className="font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer truncate"
														>
															{previewInstrument.website.replace(/https?:\/\/(www\.)?/, "")}
															<ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
														</a>
													</div>
												)}
											</>
										)}

										{/* ETF / Fund Specific Fields */}
										{(previewInstrument.assetType === InstrumentAssetType.Etf ||
											previewInstrument.assetType === InstrumentAssetType.Fund) && (
											<>
												{previewInstrument.family && (
													<div>
														<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
															Issuer / Brand
														</span>
														<span
															className="font-semibold text-foreground/90 truncate block"
															title={previewInstrument.family}
														>
															{previewInstrument.family}
														</span>
													</div>
												)}
												{previewInstrument.category && (
													<div>
														<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
															Structure
														</span>
														<span
															className="font-semibold text-foreground/90 truncate block"
															title={previewInstrument.category}
														>
															{previewInstrument.category}
														</span>
													</div>
												)}
												{previewInstrument.sector && (
													<div>
														<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
															Index Tracked
														</span>
														<span
															className="font-semibold text-foreground/90 truncate block"
															title={previewInstrument.sector}
														>
															{previewInstrument.sector}
														</span>
													</div>
												)}
												{previewInstrument.website && (
													<div>
														<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
															Home page
														</span>
														<a
															href={
																previewInstrument.website.startsWith("http")
																	? previewInstrument.website
																	: `https://${previewInstrument.website}`
															}
															target="_blank"
															rel="noopener noreferrer"
															className="font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer truncate"
														>
															{previewInstrument.website.replace(/https?:\/\/(www\.)?/, "")}
															<ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
														</a>
													</div>
												)}
											</>
										)}
									</div>
								</div>

								{/* Identifier tags */}
								{(previewInstrument.isin || previewInstrument.figi || previewInstrument.cusip) && (
									<>
										<div className="border-t border-border/40" />
										<div className="space-y-2">
											<span className="text-micro font-bold text-muted-foreground uppercase tracking-wider block">
												Reference Identifiers
											</span>
											<div className="space-y-1.5">
												{previewInstrument.isin && (
													<div className="flex items-center justify-between text-micro">
														<span className="text-muted-foreground font-medium">ISIN</span>
														<code className="bg-muted/80 px-1.5 py-0.5 rounded font-mono text-micro text-foreground border border-border/30 select-all">
															{previewInstrument.isin}
														</code>
													</div>
												)}
												{previewInstrument.figi && (
													<div className="flex items-center justify-between text-micro">
														<span className="text-muted-foreground font-medium">FIGI</span>
														<code className="bg-muted/80 px-1.5 py-0.5 rounded font-mono text-micro text-foreground border border-border/30 select-all">
															{previewInstrument.figi}
														</code>
													</div>
												)}
												{previewInstrument.cusip && (
													<div className="flex items-center justify-between text-micro">
														<span className="text-muted-foreground font-medium">CUSIP</span>
														<code className="bg-muted/80 px-1.5 py-0.5 rounded font-mono text-micro text-foreground border border-border/30 select-all">
															{previewInstrument.cusip}
														</code>
													</div>
												)}
											</div>
										</div>
									</>
								)}
							</div>
						) : (
							<div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground select-none min-h-[300px]">
								<TrendingUp className="h-12 w-12 mb-3 stroke-[1.2] text-muted-foreground/20 animate-pulse" />
								<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
									Instrument Details
								</h4>
								<p className="text-micro font-normal leading-relaxed max-w-[180px]">
									Hover over a result or use Arrow keys to preview instrument details
								</p>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

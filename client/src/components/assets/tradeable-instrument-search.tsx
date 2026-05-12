import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { CornerDownRight, ExternalLink, Loader2, Search, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const CURRENCY_CONFIG: Record<string, { symbol: string }> = {
	USD: { symbol: "$" },
	EUR: { symbol: "€" },
	GBP: { symbol: "£" },
};

function getCurrencySymbol(currency: string | null | undefined): string {
	if (!currency) return "";
	return CURRENCY_CONFIG[currency]?.symbol ?? currency;
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

export function TradeableInstrumentSearch({
	assetTypes,
	value,
	onChange,
	placeholder = "Search symbol or company name...",
	allowOnlineSearch = true,
}: TradeableInstrumentSearchProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [isSearchingOnline, setIsSearchingOnline] = useState(false);

	const debouncedSearchTerm = useDebounce(searchTerm.trim(), 250);
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
	const queryMetadata = localData?.searchInstruments.queryMetadata;
	const canSearchOnline = Boolean(queryMetadata?.weakResults) || localResults.length === 0;

	const handleSelectLocal = (result: LocalSearchResult) => {
		onChange(mapLocalResult(result));
		setSearchTerm(result.instrument.symbol);
		setIsOpen(false);
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
		setSearchTerm(result.symbol);
		setIsOpen(false);
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
		setSearchTerm(trimmed);
		setIsOpen(false);
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

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<Badge variant="secondary" className="gap-1">
					<Search className="h-3 w-3" />
					Instrument Search
				</Badge>
				{value && (
					<Badge variant="outline" className="gap-1">
						{value.source}
					</Badge>
				)}
			</div>

			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverTrigger asChild>
					<SearchInput
						placeholder="Search instruments..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						onClear={() => setSearchTerm("")}
					/>
				</PopoverTrigger>
				<PopoverContent
					className="w-[min(100vw-2rem,36rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-0"
					align="start"
				>
					<Command shouldFilter={false}>
						<CommandInput
							placeholder={placeholder}
							value={searchTerm}
							onValueChange={setSearchTerm}
						/>
						<CommandList>
							{isSearchingLocal && (
								<div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" />
									Searching local catalog...
								</div>
							)}

							{!isSearchingLocal &&
								localResults.length === 0 &&
								debouncedSearchTerm.length >= 2 && (
									<CommandEmpty>No local matches found.</CommandEmpty>
								)}

							{localResults.length > 0 && (
								<CommandGroup heading="Local Results">
									{localResults.map((result) => (
										<CommandItem
											key={result.instrument.id}
											onSelect={() => handleSelectLocal(result)}
											className="flex items-center justify-between gap-3"
										>
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<span className="font-medium">{result.instrument.symbol}</span>
													<Badge variant="outline" className="text-[10px]">
														{result.instrument.assetType}
													</Badge>
													{result.instrument.currency && (
														<Badge variant="secondary" className="text-[10px] gap-1">
															{getCurrencySymbol(result.instrument.currency)}
															{result.instrument.currency}
														</Badge>
													)}
												</div>
												<div className="truncate text-xs text-muted-foreground">
													{result.instrument.name}
												</div>
											</div>
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<span>{result.score.toFixed(0)}</span>
												<CornerDownRight className="h-3 w-3" />
											</div>
										</CommandItem>
									))}
								</CommandGroup>
							)}

							{allowOnlineSearch && debouncedSearchTerm.length >= 2 && canSearchOnline && (
								<div className="border-t px-3 py-3">
									<Button
										type="button"
										variant="secondary"
										className="w-full justify-start gap-2"
										disabled={isSearchingOnline}
										onClick={() => void searchOnline()}
									>
										{isSearchingOnline ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<ExternalLink className="h-4 w-4" />
										)}
										Search online
									</Button>
								</div>
							)}

							{debouncedSearchTerm.length >= 2 && (
								<div className="border-t px-3 py-3">
									<Button
										type="button"
										variant="outline"
										className="w-full justify-start gap-2"
										onClick={() => void handleAddManual()}
									>
										<ShieldAlert className="h-4 w-4" />
										Add unverified manually
									</Button>
								</div>
							)}

							{onlineResults.length > 0 && (
								<CommandGroup heading="Online Results">
									{onlineResults.map((result) => (
										<CommandItem
											key={`${result.providerSource}:${result.providerExternalId ?? result.symbol}`}
											onSelect={() => {
												void handleSelectOnline(result);
											}}
											className="flex items-center justify-between gap-3"
										>
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<span className="font-medium">{result.symbol}</span>
													<Badge variant="outline" className="text-[10px]">
														{result.assetType}
													</Badge>
													{result.currency && (
														<Badge variant="secondary" className="text-[10px] gap-1">
															{getCurrencySymbol(result.currency)}
															{result.currency}
														</Badge>
													)}
													<Badge variant="secondary" className="text-[10px]">
														{result.providerSource}
													</Badge>
												</div>
												<div className="truncate text-xs text-muted-foreground">{result.name}</div>
											</div>
											<ShieldAlert className="h-4 w-4 text-muted-foreground" />
										</CommandItem>
									))}
								</CommandGroup>
							)}

							{value && (
								<div className="border-t px-3 py-3">
									<Button type="button" variant="ghost" className="w-full" onClick={clearSelection}>
										Clear selection
									</Button>
								</div>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}

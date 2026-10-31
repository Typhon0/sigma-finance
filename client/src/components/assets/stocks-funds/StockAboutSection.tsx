import { useQuery } from "@apollo/client";
import { Building2, Globe, MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEARCH_INSTRUMENTS } from "@/graphql/queries/instruments";

interface StockAboutSectionProps {
	symbol: string;
	displayName?: string;
}

export function StockAboutSection({ symbol, displayName }: StockAboutSectionProps) {
	const { data } = useQuery(SEARCH_INSTRUMENTS, {
		variables: { input: { query: symbol, limit: 1 } },
		skip: !symbol,
		fetchPolicy: "cache-first",
	});

	const instrument = data?.searchInstruments?.localResults?.[0]?.instrument;

	// Facts render only when the catalog actually carries them. An uncatalogued
	// instrument shows dashes and a completion hint — never a default
	// "Technology/NASDAQ/United States" fill-in.
	const sector = instrument?.sector ?? null;
	const country = instrument?.country ?? null;
	const exchange = instrument?.exchangeCode ?? instrument?.exchange ?? null;
	const assetType = instrument?.assetType ?? null;
	const city = instrument?.city ?? null;
	const website = instrument?.website;
	const summary = instrument?.summary;

	const anyFact = Boolean(sector || country || exchange || city || website || summary);

	return (
		<div className="space-y-6">
			<h2 className="sr-only">About</h2>
			{/* Catalogued facts strip — real fields only */}
			{assetType && (
				<div className="flex flex-wrap items-center gap-2">
					<Badge
						variant="secondary"
						className="h-7 px-3 py-1 text-xs font-medium rounded-full bg-muted/80 text-foreground hover:bg-muted"
					>
						{assetType}
					</Badge>
					{exchange && (
						<Badge
							variant="secondary"
							className="h-7 px-3 py-1 text-xs font-medium rounded-full bg-muted/80 text-muted-foreground font-mono"
						>
							{exchange}
						</Badge>
					)}
				</div>
			)}

			{/* Description Card */}
			<Card className="border-border/60 bg-card/60">
				<CardHeader className="border-b border-border/40 pb-4">
					<CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
						<Building2 className="h-4 w-4 text-muted-foreground" />
						Company Overview
					</CardTitle>
					<CardDescription className="text-xs text-muted-foreground">
						General information and business profile for {displayName || symbol}
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-5 space-y-4 text-sm text-foreground/90 leading-relaxed">
					{summary ? (
						<p className="whitespace-pre-line">{summary}</p>
					) : (
						<p className="text-muted-foreground">
							— No company description on record for {displayName || symbol}. Complete the
							instrument record in the finance database to have it surfaced here.
						</p>
					)}

					<div className="pt-4 border-t border-border/30 grid grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-3 gap-3 text-xs text-muted-foreground">
						<div className="flex items-center gap-2">
							<MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
							<span>
								Headquarters:{" "}
								<span className={city || country ? "text-foreground" : "text-muted-foreground"}>
									{city || country ? [city, country].filter(Boolean).join(", ") : "—"}
								</span>
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
							{website ? (
								<a
									href={website.startsWith("http") ? website : `https://${website}`}
									target="_blank"
									rel="noreferrer"
									className="text-primary hover:underline truncate"
								>
									{website.replace(/^https?:\/\//, "")}
								</a>
							) : (
								<span className="text-muted-foreground">Website: —</span>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Tag className="h-3.5 w-3.5 text-muted-foreground/70" />
							<span>
								Ticker symbol: <strong className="font-mono text-foreground">{symbol}</strong>
							</span>
						</div>
					</div>
					{!anyFact && (
						<p className="text-micro text-muted-foreground">
							This instrument is not in the catalog yet — sector, country and exchange stay blank
							until someone records them. No defaults are invented.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

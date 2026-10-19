import { useQuery } from "@apollo/client";
import { Building2, Globe, MapPin, Plus, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

	const sector = instrument?.sector || "Technology";
	const country = instrument?.country || "United States";
	const exchange = instrument?.exchangeCode || instrument?.exchange || "NASDAQ";
	const assetType = instrument?.assetType || "Stock";
	const website = instrument?.website;
	const summary =
		instrument?.summary ||
		`${displayName || symbol} is a publicly traded company listed on ${exchange}. It designs, develops, and delivers innovative solutions in the ${sector.toLowerCase()} sector.`;

	return (
		<div className="space-y-6">
			{/* Tag Badges Strip */}
			<div className="flex flex-wrap items-center gap-2">
				<Badge
					variant="secondary"
					className="h-7 px-3 py-1 text-xs font-medium rounded-full bg-muted/80 text-foreground hover:bg-muted"
				>
					Stock
				</Badge>
				<Badge
					variant="secondary"
					className="h-7 px-3 py-1 text-xs font-medium rounded-full bg-muted/80 text-foreground hover:bg-muted"
				>
					{String(assetType).toUpperCase() === "EQUITY" || String(assetType).toUpperCase() === "STOCK" ? "Stock" : String(assetType)}
				</Badge>
				<Badge
					variant="secondary"
					className="h-7 px-3 py-1 text-xs font-medium rounded-full bg-muted/80 text-foreground hover:bg-muted"
				>
					{sector}
				</Badge>
				<Badge
					variant="secondary"
					className="h-7 px-3 py-1 text-xs font-medium rounded-full bg-muted/80 text-foreground hover:bg-muted"
				>
					{country}
				</Badge>
				<Badge
					variant="secondary"
					className="h-7 px-3 py-1 text-xs font-medium rounded-full bg-muted/80 text-foreground hover:bg-muted font-mono"
				>
					{exchange}
				</Badge>
				<Button
					variant="outline"
					size="sm"
					className="h-7 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground border-dashed"
					onClick={() => {}}
				>
					<Plus className="h-3 w-3 mr-1" />
					More
				</Button>
			</div>

			{/* Description Card */}
			<Card className="border-border/60 bg-card/60 backdrop-blur-sm">
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
					<p className="whitespace-pre-line">{summary}</p>

					<div className="pt-4 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
						<div className="flex items-center gap-2">
							<MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
							<span>
								Headquarters: {instrument?.city ? `${instrument.city}, ` : ""}{country}
							</span>
						</div>
						{website && (
							<div className="flex items-center gap-2">
								<Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
								<a
									href={website.startsWith("http") ? website : `https://${website}`}
									target="_blank"
									rel="noreferrer"
									className="text-primary hover:underline truncate"
								>
									{website.replace(/^https?:\/\//, "")}
								</a>
							</div>
						)}
						<div className="flex items-center gap-2">
							<Tag className="h-3.5 w-3.5 text-muted-foreground/70" />
							<span>Ticker symbol: <strong className="font-mono text-foreground">{symbol}</strong></span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

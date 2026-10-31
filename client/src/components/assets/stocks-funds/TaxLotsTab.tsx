import { useQuery } from "@apollo/client";
import {
	AlertTriangle,
	Clock,
	Info,
	Receipt,
	RefreshCw,
	Scissors,
	ShieldCheck,
} from "lucide-react";
import { useCallback, useContext, useMemo, useState } from "react";
import { PortfolioContext } from "@/components/PortfolioProvider";
import { Explained } from "@/components/shared/info-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GET_DISPOSITIONS_BY_POSITION, GET_TAX_LOTS_BY_POSITION } from "@/graphql/queries/tax-lots";
import { useSafeAuth } from "@/lib/auth-context";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TaxLotItem {
	id: string;
	portfolioId: string;
	positionId: string;
	assetId: string;
	transactionId?: string;
	acquiredAt: string;
	initialQuantity: number;
	remainingQuantity: number;
	costBasisPerUnit: number;
	totalCostBasis: number;
	currency: string;
	status: string;
	holdingPeriodDays: number;
	isLongTerm: boolean;
	currentPrice?: number;
	currentValue?: number;
	unrealizedGainLoss?: number;
	unrealizedGainLossPercent?: number;
}

// One persisted lot-matched disposal: the FISCAL realized gain/loss.
// Separate number from the unrealized figures above and from any economic P/L.
export interface TaxLotDispositionItem {
	id: string;
	lotId: string;
	positionId: string;
	portfolioId: string;
	assetId: string;
	transactionId?: string;
	acquiredAt: string;
	soldAt: string;
	quantity: number;
	costBasisPerUnit: number;
	sellPricePerUnit: number;
	costBasis: number;
	proceeds: number;
	realizedGainLoss: number;
	method: string;
	holdingPeriodDays: number;
	isLongTerm: boolean;
	isTaxExempt?: boolean;
}

interface TaxLotsTabProps {
	positionId?: string;
	symbol: string;
	currency?: string;
	currentPrice?: number;
	accountName?: string;
	accountTaxWrapper?: string;
	portfolioTaxWrapper?: string;
	/** Promotes the inner no-lots hint to a real CTA when a destination exists. */
	onNavigateToTransactions?: () => void;
}

// A row predicate over a recorded currency: true only when the record
// actually names one (string, non-blank). Shared by the basis memos so
// "unreadable" has exactly one definition.
const lotBasisReadable = (c: unknown): c is string => typeof c === "string" && c.trim() !== "";

export function TaxLotsTab({
	positionId,
	symbol,
	currency = "USD",
	currentPrice = 0,
	accountName,
	accountTaxWrapper,
	portfolioTaxWrapper,
	onNavigateToTransactions,
}: TaxLotsTabProps) {
	const portfolioContext = useContext(PortfolioContext);
	// Non-throwing context read: this tab renders inside the sheet even when
	// the auth surface that owns this slice of state renders it, so asking for
	// the throwing hook would risk the component tree on a provider edge case.
	const user = useSafeAuth()?.user ?? null;
	const taxWrapper =
		accountTaxWrapper ||
		portfolioTaxWrapper ||
		portfolioContext?.selectedPortfolio?.taxWrapper ||
		"STANDARD_TAXABLE";
	const taxJurisdiction = user?.taxJurisdiction ?? null;
	const isPEA = taxWrapper === "PEA";

	const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">("OPEN");
	const [method, setMethod] = useState<"FIFO" | "HIFO" | "LIFO" | "PMP">(
		taxJurisdiction === "FR" ? "PMP" : "FIFO",
	);

	const {
		data,
		loading,
		error: lotsError,
		refetch: refetchLots,
	} = useQuery<{ taxLotsByPosition: TaxLotItem[] }>(GET_TAX_LOTS_BY_POSITION, {
		variables: { positionId: positionId || "" },
		skip: !positionId,
		fetchPolicy: "cache-and-network",
	});

	const [taxYear, setTaxYear] = useState<string>("ALL");

	const {
		data: dispData,
		loading: dispLoading,
		error: dispError,
		refetch: refetchDispositions,
	} = useQuery<{
		dispositionsByPosition: TaxLotDispositionItem[];
	}>(GET_DISPOSITIONS_BY_POSITION, {
		variables: { positionId: positionId || "" },
		skip: !positionId,
		fetchPolicy: "cache-and-network",
	});

	// Either request failing blocks honest cost-basis reporting for this
	// position, so both are surfaced together with a single retry action.
	const error = lotsError || dispError;
	const refetchAll = useCallback(() => {
		if (lotsError) refetchLots();
		if (dispError) refetchDispositions();
	}, [lotsError, dispError, refetchLots, refetchDispositions]);

	// Server records only. An empty result means no lots exist for this
	// position yet — it must never be backfilled with synthetic cost basis,
	// acquisition dates, or holding periods, because those values would be
	// indistinguishable from real ones and drive tax-loss-harvesting advice.
	const lots: TaxLotItem[] = useMemo(() => data?.taxLotsByPosition ?? [], [data]);

	// Same no-fabrication rule for disposals: only rows the server persisted
	// at sell time are shown. An empty list means no sales were recorded
	// through the lot-matching engine — never a synthesized zero.
	const dispositions: TaxLotDispositionItem[] = useMemo(
		() => dispData?.dispositionsByPosition ?? [],
		[dispData],
	);

	// Tax years come from actual disposal dates on record.
	const availableYears = useMemo(() => {
		const years = new Set<number>();
		for (const d of dispositions) {
			years.add(new Date(d.soldAt).getUTCFullYear());
		}
		return Array.from(years).sort((a, b) => b - a);
	}, [dispositions]);

	const filteredDispositions = useMemo(() => {
		if (taxYear === "ALL") return dispositions;
		return dispositions.filter((d) => new Date(d.soldAt).getUTCFullYear() === Number(taxYear));
	}, [dispositions, taxYear]);

	// FISCAL realized totals (lot-matched) for the selected window.
	const realized = useMemo(() => {
		let shortTerm = 0;
		let longTerm = 0;
		let internalGain = 0;
		for (const d of filteredDispositions) {
			const gain = d.realizedGainLoss;
			internalGain += gain;
			if (!d.isTaxExempt && !isPEA) {
				if (d.isLongTerm) {
					longTerm += gain;
				} else {
					shortTerm += gain;
				}
			}
		}
		return {
			shortTerm,
			longTerm,
			total: shortTerm + longTerm,
			internalGain,
		};
	}, [filteredDispositions, isPEA]);

	const hasDispositions = dispositions.length > 0;

	const hasLots = lots.length > 0;

	// THE LEDGER'S OWN CURRENCY CLAIM. Unified figures below (open-lot cards,
	// realized sums) accumulate across rows; a sum is a number only when one
	// currency underlies it. Cost basis is recorded per lot — dispositions
	// have no currency column of their own, so their claim is their source
	// lot's. A single currency labels everything; several ⇒ unified sums
	// dash with an explanation while each ROW keeps printing its own real
	// figure — the sheet never relabels a ledger figure by assumption.
	const ledgerBasis = useMemo(() => {
		const currencies = new Set(
			lots.map((l) => l.currency).filter((c): c is string => lotBasisReadable(c)),
		);
		// A single readable currency does not license a unified print while
		// another contributing lot never names one — the sum would silently
		// absorb a figure whose basis never resolved.
		const allReadable = lots.every((l) => lotBasisReadable(l.currency));
		return allReadable && currencies.size === 1 ? (currencies.values().next().value ?? null) : null;
	}, [lots]);
	const isBasisMixed = useMemo(() => {
		const currencies = new Set(
			lots.map((l) => l.currency).filter((c): c is string => lotBasisReadable(c)),
		);
		return lots.length > 0 && currencies.size > 1;
	}, [lots]);
	const unifiedWithheld = lots.length > 0 && ledgerBasis == null;
	const unifiedWithheldReason = isBasisMixed
		? "Recorded lots span more than one currency — unified totals are withheld; each row below prints its own figure."
		: "The recorded cost currency is unreadable on these lots — unified totals print once it resolves.";

	const rawLotCurrencyById = useMemo(
		() =>
			new Map(
				lots.filter((l) => lotBasisReadable(l.currency)).map((l) => [l.id, l.currency] as const),
			),
		[lots],
	);
	const dispositionBasis = useMemo(() => {
		const currencies = new Set(
			dispositions
				.map((d) => rawLotCurrencyById.get(d.lotId))
				.filter((c): c is string => lotBasisReadable(c)),
		);
		// Same rule as the open-lot ledger: one unreadable source record
		// withholds the unified sums — it must not be silently absorbed.
		const allMapped = dispositions.every((d) => lotBasisReadable(rawLotCurrencyById.get(d.lotId)));
		return allMapped && currencies.size === 1 ? (currencies.values().next().value ?? null) : null;
	}, [dispositions, rawLotCurrencyById]);
	const realizedBasisMixed = useMemo(() => {
		const currencies = new Set(
			dispositions
				.map((d) => rawLotCurrencyById.get(d.lotId))
				.filter((c): c is string => typeof c === "string"),
		);
		return currencies.size > 1;
	}, [dispositions, rawLotCurrencyById]);
	const realizedUnifiedWithheld = dispositions.length > 0 && dispositionBasis == null;

	// Per-row binds: a row's figures print in the row's own recorded
	// currency. A row whose record does not name its currency gets dashes —
	// silently relabeling its figures with the position's currency would
	// print a claim the ledger never wrote.
	const formatLot = (lot: TaxLotItem, val: number) => {
		const rowCurrency =
			typeof lot.currency === "string" && lot.currency.trim() !== "" ? lot.currency : null;
		return rowCurrency ? formatMoney(val, rowCurrency) : "—";
	};
	const formatDispositionRow = (d: TaxLotDispositionItem, val: number) => {
		const rowCurrency = rawLotCurrencyById.get(d.lotId);
		return rowCurrency ? formatMoney(val, rowCurrency) : "—";
	};
	// Unified figures print through the ledger's own basis; the renders gate
	// them behind a non-null basis, so the fallback bind is unreachable.
	const formatLedger = (val: number) => formatMoney(val, ledgerBasis ?? currency);
	const formatRealized = (val: number) => formatMoney(val, dispositionBasis ?? currency);

	// Filtered & sorted lots
	const filteredLots = useMemo(() => {
		let result = [...lots];
		if (statusFilter === "OPEN") {
			result = result.filter((l) => l.remainingQuantity > 0);
		} else if (statusFilter === "CLOSED") {
			result = result.filter((l) => l.remainingQuantity <= 0 || l.status === "CLOSED");
		}

		// Sort by accounting preference
		if (method === "FIFO" || method === "PMP") {
			result.sort((a, b) => new Date(a.acquiredAt).getTime() - new Date(b.acquiredAt).getTime());
		} else if (method === "LIFO") {
			result.sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
		} else if (method === "HIFO") {
			result.sort((a, b) => b.costBasisPerUnit - a.costBasisPerUnit);
		}

		return result;
	}, [lots, statusFilter, method]);

	// Aggregated Tax Metrics
	const metrics = useMemo(() => {
		let totalCost = 0;
		let totalCurVal = 0;
		let totalGainLoss = 0;
		let shortTermCost = 0;
		let shortTermGain = 0;
		let longTermCost = 0;
		let longTermGain = 0;
		let harvestableLoss = 0;
		let lossLotsCount = 0;
		// True when any open lot lacks a resolvable price. Cost-basis figures
		// stay real (they never needed a quote); every VALUE-derived number —
		// unrealized P&L, harvest eligibility, percentages — is withheld as an
		// honest dash rather than printed as a manufactured loss. The harvest
		// badge IS tax advice; an absent quote must not raise it.
		let priceUnresolved = false;

		for (const l of lots) {
			if (l.remainingQuantity <= 0) continue;
			const cost = l.costBasisPerUnit * l.remainingQuantity;
			totalCost += cost;

			// The sheet's fallback price quotes in the instrument's quote
			// currency; it may only substitute for a lot recorded in that
			// same currency — otherwise the lot is unpriced here, and the
			// open-value figures stay withheld rather than partially added.
			const lotCurrencyReadable = typeof l.currency === "string" && l.currency.trim() !== "";
			const price =
				l.currentPrice != null && l.currentPrice > 0
					? l.currentPrice
					: lotCurrencyReadable && l.currency === currency && currentPrice > 0
						? currentPrice
						: 0;
			if (!(price > 0)) {
				priceUnresolved = true;
				continue;
			}
			const val = price * l.remainingQuantity;
			const gl = val - cost;

			totalCurVal += val;
			totalGainLoss += gl;

			if (l.isLongTerm) {
				longTermCost += cost;
				longTermGain += gl;
			} else {
				shortTermCost += cost;
				shortTermGain += gl;
			}

			if (gl < 0) {
				harvestableLoss += Math.abs(gl);
				lossLotsCount++;
			}
		}

		return {
			totalCost,
			totalCurVal,
			totalGainLoss,
			totalGainLossPct: totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0,
			shortTermCost,
			shortTermGain,
			longTermCost,
			longTermGain,
			harvestableLoss,
			lossLotsCount,
			priceUnresolved,
		};
	}, [lots, currentPrice, currency]);

	// The unified figures print through the ledger's own basis (formatLedger
	// below); the position-currency prop only survives as a per-row fallback
	// label when a lot's own record is unreadable.

	// The rate badge speaks the ledger's OWN dialect, not another country's:
	// FR taxes gains at the flat PFU regardless of holding length (the PEA
	// states exemption separately, above); US distinguishes ordinary vs
	// preferred rates by term. An unknown jurisdiction prints a dash instead
	// of claiming someone else's vocabulary.
	const rateBadge = (isLongTerm: boolean): { label: string; className: string } => {
		if (isPEA) {
			return {
				label: "PEA Tax-Exempt",
				className: "text-micro h-5 font-semibold text-gain bg-gain/10 border-gain/30",
			};
		}
		if (taxJurisdiction === "FR") {
			return {
				label: "PFU 30%",
				className:
					"text-micro h-5 font-semibold text-muted-foreground bg-muted/40 border-border/40",
			};
		}
		if (taxJurisdiction === "US") {
			return isLongTerm
				? {
						label: "Pref. 15-20%",
						className: "text-micro h-5 font-semibold text-gain bg-gain/10 border-gain/30",
					}
				: {
						label: "Ordinary Rate",
						className: "text-micro h-5 font-semibold text-warning bg-warning/10 border-warning/30",
					};
		}
		return {
			label: "—",
			className: "text-micro h-5 font-semibold text-muted-foreground bg-muted/40 border-border/40",
		};
	};

	return (
		<div className="space-y-6">
			{/* PEA Tax Wrapper Banner */}
			{isPEA ? (
				<div className="flex items-start gap-3 p-3.5 rounded-xl border border-gain/30 bg-gain/5 text-gain">
					<ShieldCheck className="h-5 w-5 shrink-0 mt-0.5 text-gain" />
					<div className="space-y-0.5 text-xs">
						<span className="font-semibold text-gain">
							PEA Tax-Sheltered Account (French Equity Plan)
							{accountName ? ` • ${accountName}` : ""}
						</span>
						<p className="text-muted-foreground leading-relaxed">
							Internal tax-sheltered regime under French tax law. Capital gains realized within this
							envelope are tax-exempt (0% current capital gains tax). Sale tracking and average cost
							basis (PMP) are maintained for economic performance analysis.
						</p>
					</div>
				</div>
			) : accountName ? (
				<div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40 text-xs text-muted-foreground">
					<span className="font-medium text-foreground">Holding Account: {accountName}</span>
					<Badge variant="outline" className="text-micro font-mono">
						{taxWrapper}
					</Badge>
				</div>
			) : null}

			{/* Top Bar / Accounting Method Info */}
			<div className="flex flex-col @sm:flex-row @sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/40 bg-card/40">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-primary" />
						<h2 className="text-sm font-semibold text-foreground">
							Tax-Lot Accounting & Capital Gains
						</h2>
						{/* side="bottom": the badge sits directly under the sheet's
						    sticky header, so a top-side popup would be covered by it. */}
						<Explained
							description={
								<span className="text-xs">
									{taxJurisdiction === "FR" ? (
										<span>
											<span className="font-semibold">
												French Weighted Average Acquisition Price rule (PMP).
											</span>{" "}
											In accordance with Art. 150-0 D of the French Tax Code (CGI), securities sales
											are fiscally valued using the weighted average acquisition cost.
										</span>
									) : taxJurisdiction === "US" ? (
										<span>
											<span className="font-semibold">U.S. cost-basis rule (§1012).</span> An
											asset's basis is what you paid for it, including fees. This view keeps one
											ledger entry per purchase, so every gain is priced off a recorded lot — never
											an average.
										</span>
									) : (
										<span>
											<span className="font-semibold">Tax jurisdiction is not set.</span> Choose it
											in Settings → Account. Until you do, this ledger applies no
											jurisdiction-specific rule and reviews open lots in FIFO order.
										</span>
									)}
								</span>
							}
							side="bottom"
							align="end"
						>
							<Badge
								variant="outline"
								className={cn(
									"text-micro font-mono cursor-help",
									taxJurisdiction == null && "border-warning/40 bg-warning/10 text-warning",
								)}
							>
								{taxJurisdiction === "FR"
									? "CGI Art. 150-0 D (PMP)"
									: taxJurisdiction === "US"
										? "IRS Sec. 1012"
										: "Tax rule not set"}
							</Badge>
						</Explained>
					</div>
					<p className="text-xs text-muted-foreground">
						Track acquisition lots, holding periods, and capital gain classifications for {symbol}.
					</p>
				</div>

				{hasLots && (
					<div className="flex items-center gap-2">
						<Explained
							description={
								<span className="text-xs space-y-1.5 block">
									<span className="font-semibold block">How the ledger above is ordered:</span>
									<span className="block">
										<span className="font-mono font-semibold">PMP (Prix Moyen)</span> — weighted
										average acquisition cost; statutory method under French tax law.
									</span>
									<span className="block">
										<span className="font-mono font-semibold">FIFO (First-In)</span> — oldest
										purchases first; statutory default in Germany and standard US.
									</span>
									<span className="block">
										<span className="font-mono font-semibold">HIFO (Tax-Loss)</span> — highest cost
										basis first; brings the largest embedded losses to the top for harvest planning.
									</span>
									<span className="block">
										<span className="font-mono font-semibold">LIFO (Last-In)</span> — newest
										purchases first.
									</span>
									<span className="block text-muted-foreground">
										Recorded sales are matched on the server; this sets the review order.
									</span>
								</span>
							}
							tooltipClassName="max-w-80"
							className="transition-colors hover:text-foreground"
						>
							<span className="text-xs whitespace-nowrap text-muted-foreground">Lot Strategy:</span>
							<Info className="h-3 w-3 inline ml-0.5 align-[-1px]" aria-hidden="true" />
						</Explained>
						<Select
							value={method}
							onValueChange={(v) => setMethod(v as "FIFO" | "HIFO" | "LIFO" | "PMP")}
						>
							<SelectTrigger
								className="h-8 text-xs w-36 bg-background"
								aria-label="Lot Strategy — ordering method"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value="PMP">PMP (Prix Moyen)</SelectItem>
								<SelectItem value="FIFO">FIFO (First-In)</SelectItem>
								<SelectItem value="HIFO">HIFO (Tax-Loss)</SelectItem>
								<SelectItem value="LIFO">LIFO (Last-In)</SelectItem>
							</SelectContent>
						</Select>
					</div>
				)}
			</div>

			{/* KPI Summary Grid — hidden unless lots actually loaded, so a position
		    with no lots (or a failed request) never renders $0.00 across four
		    cards that read as real measurements. */}
			{hasLots && !loading && !error && (
				<div className="space-y-2">
					{/* Scope line: these four cards are the open-lot snapshot across
					    ALL tax years. The tax-year select below does not drive them
					    — saying so kills the wrong implication. */}
					<p className="px-1 text-xs text-muted-foreground">
						Open lots · all tax years — the tax-year filter below only changes the Realized panel.
					</p>
					{unifiedWithheld && (
						<p className="px-1 text-xs text-warning" role="status">
							{unifiedWithheldReason}
						</p>
					)}
					<div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
						{/* 1. Total Cost Basis */}
						<Card className="border-border/40 bg-card/40">
							<CardHeader className="p-4 pb-2">
								<CardDescription className="text-xs font-medium">Total Cost Basis</CardDescription>
								<CardTitle className="text-lg font-bold font-mono">
									{unifiedWithheld ? "—" : formatLedger(metrics.totalCost)}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 pt-0 text-xs text-muted-foreground flex justify-between items-center">
								<span>Unrealized Gain/Loss</span>
								{metrics.priceUnresolved || unifiedWithheld ? (
									<span className="font-mono font-semibold">—</span>
								) : (
									<span
										className={cn(
											"font-mono font-semibold flex items-center gap-1",
											metrics.totalGainLoss >= 0 ? "text-gain" : "text-loss",
										)}
									>
										{metrics.totalGainLoss >= 0 ? "+" : ""}
										{formatLedger(metrics.totalGainLoss)} ({metrics.totalGainLossPct.toFixed(2)}
										%)
									</span>
								)}
							</CardContent>
						</Card>

						{/* 2. Short-Term Lots */}
						<Card className="border-border/40 bg-card/40">
							<CardHeader className="p-4 pb-2">
								<div className="flex items-center justify-between">
									<CardDescription className="text-xs font-medium">
										Short-Term (≤365d)
									</CardDescription>
									<Badge variant="outline" className={rateBadge(false).className}>
										{rateBadge(false).label}
									</Badge>
								</div>
								<CardTitle className="text-lg font-bold font-mono">
									{unifiedWithheld ? "—" : formatLedger(metrics.shortTermCost)}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 pt-0 text-xs text-muted-foreground flex justify-between items-center">
								<span>Unrealized Gain/Loss</span>
								{metrics.priceUnresolved || unifiedWithheld ? (
									<span className="font-mono font-semibold">—</span>
								) : (
									<span
										className={cn(
											"font-mono font-semibold",
											metrics.shortTermGain >= 0 ? "text-gain" : "text-loss",
										)}
									>
										{metrics.shortTermGain >= 0 ? "+" : ""}
										{formatLedger(metrics.shortTermGain)}
									</span>
								)}
							</CardContent>
						</Card>

						{/* 3. Long-Term Lots */}
						<Card
							className={cn(
								"border-border/40 bg-card/40",
								// With the harvest card suppressed under a PEA wrapper
								// this card ends the row alone — spanning the width
								// beats a half-width orphan.
								isPEA && "@xl:col-span-2",
							)}
						>
							<CardHeader className="p-4 pb-2">
								<div className="flex items-center justify-between">
									<CardDescription className="text-xs font-medium">
										Long-Term (&gt;365d)
									</CardDescription>
									<Badge variant="outline" className={rateBadge(true).className}>
										{rateBadge(true).label}
									</Badge>
								</div>
								<CardTitle className="text-lg font-bold font-mono">
									{unifiedWithheld ? "—" : formatLedger(metrics.longTermCost)}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 pt-0 text-xs text-muted-foreground flex justify-between items-center">
								<span>Unrealized Gain/Loss</span>
								{metrics.priceUnresolved || unifiedWithheld ? (
									<span className="font-mono font-semibold">—</span>
								) : (
									<span
										className={cn(
											"font-mono font-semibold",
											metrics.longTermGain >= 0 ? "text-gain" : "text-loss",
										)}
									>
										{metrics.longTermGain >= 0 ? "+" : ""}
										{formatLedger(metrics.longTermGain)}
									</span>
								)}
							</CardContent>
						</Card>

						{/* 4. Tax-Loss Harvesting — suppressed under a PEA wrapper:
						    realizations there are exempt, so "harvest" advice would
						    be a strategy the account structure voids. */}
						{!isPEA && (
							<Card
								className={cn(
									"border-border/40 transition-colors",
									metrics.harvestableLoss > 0 ? "border-warning/40 bg-warning/5" : "bg-card/40",
								)}
							>
								<CardHeader className="p-4 pb-2">
									<div className="flex items-center justify-between">
										<CardDescription className="text-xs font-medium flex items-center gap-1.5">
											<Scissors className="h-3.5 w-3.5 text-warning" />
											<span>Tax-Loss Harvest</span>
										</CardDescription>
										{metrics.lossLotsCount > 0 && !metrics.priceUnresolved && (
											<Badge className="text-micro bg-warning text-warning-foreground font-bold">
												{metrics.lossLotsCount} Lots Eligible
											</Badge>
										)}
									</div>
									<CardTitle
										className={cn(
											"text-lg font-bold font-mono",
											(metrics.harvestableLoss > 0 || unifiedWithheld) && !metrics.priceUnresolved
												? "text-warning"
												: "text-muted-foreground",
										)}
									>
										{metrics.priceUnresolved || unifiedWithheld
											? "—"
											: formatLedger(metrics.harvestableLoss)}
									</CardTitle>
								</CardHeader>
								<CardContent className="p-4 pt-0 text-xs text-muted-foreground">
									{unifiedWithheld ? (
										<span className="text-micro">
											{isBasisMixed
												? "Loss figures are withheld — the ledger records more than one currency."
												: "Loss figures are withheld — the recorded cost basis is unreadable."}
										</span>
									) : metrics.priceUnresolved ? (
										<span className="text-micro">
											No recorded price for an open lot — losses cannot be assessed until it
											resolves.
										</span>
									) : metrics.harvestableLoss > 0 ? (
										<span className="text-warning-muted text-micro">
											Offset realized gains by selling high-cost lots (HIFO).
										</span>
									) : (
										<span>All active lots currently in profit.</span>
									)}
								</CardContent>
							</Card>
						)}
					</div>
				</div>
			)}

			{/* Realized — FISCAL lot-matched gains from recorded disposals. This is a
		    different number from the unrealized cards above (open positions)
		    and from economic average-cost P/L. Empty means no sales recorded
		    through the lot-matching engine — never a synthesized zero. */}
			{hasDispositions && !dispLoading && !dispError && (
				<div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
					<div className="p-4 border-b border-border/40 flex flex-col @sm:flex-row @sm:items-center justify-between gap-3 bg-muted/10">
						<div className="flex items-center gap-2">
							<Receipt className="h-4 w-4 text-primary" />
							<span className="text-xs font-bold uppercase tracking-wider text-foreground">
								Realized — Sales on Record
							</span>
							<Badge variant="outline" className="text-micro font-mono">
								Lot-Matched
							</Badge>
						</div>
						{availableYears.length > 0 && (
							<div className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground whitespace-nowrap">Tax year:</span>
								<Select value={taxYear} onValueChange={(v) => setTaxYear(v)}>
									<SelectTrigger
										aria-label="Tax year — filters the realized sales below"
										className="h-7 text-xs w-28 bg-background border-border/40"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent align="end">
										<SelectItem value="ALL">All years</SelectItem>
										{availableYears.map((y) => (
											<SelectItem key={y} value={String(y)}>
												{y}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
					</div>

					<div className="grid grid-cols-1 @xl:grid-cols-3 gap-4 p-4">
						{realizedUnifiedWithheld && (
							<p className="col-span-full text-xs text-warning" role="status">
								{realizedBasisMixed
									? "Dispositions stand in more than one currency — the unified sums are withheld; each row below prints its own figure."
									: "The dispositions' recorded currency basis is unreadable — the unified sums print once it resolves."}
							</p>
						)}
						<div>
							<p className="text-xs text-muted-foreground flex items-center gap-1.5">
								Short-Term Realized G/L
								{isPEA && (
									<Badge
										variant="outline"
										className="text-micro font-semibold h-4 text-gain bg-gain/10 border-gain/30"
									>
										PEA Tax-Exempt
									</Badge>
								)}
							</p>
							{/* Under a PEA wrapper the taxable pools are structurally
							    empty by rule — a dash states that instead of a colored
							    zero that looks like a measurement. */}
							<p
								className={cn(
									"text-lg font-bold font-mono",
									isPEA || realizedUnifiedWithheld
										? "text-muted-foreground"
										: realized.shortTerm >= 0
											? "text-gain"
											: "text-loss",
								)}
							>
								{isPEA || realizedUnifiedWithheld
									? "—"
									: `${realized.shortTerm >= 0 ? "+" : ""}${formatRealized(realized.shortTerm)}`}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground flex items-center gap-1.5">
								Long-Term Realized G/L
								{isPEA && (
									<Badge
										variant="outline"
										className="text-micro font-semibold h-4 text-gain bg-gain/10 border-gain/30"
									>
										PEA Tax-Exempt
									</Badge>
								)}
							</p>
							<p
								className={cn(
									"text-lg font-bold font-mono",
									isPEA || realizedUnifiedWithheld
										? "text-muted-foreground"
										: realized.longTerm >= 0
											? "text-gain"
											: "text-loss",
								)}
							>
								{isPEA || realizedUnifiedWithheld
									? "—"
									: `${realized.longTerm >= 0 ? "+" : ""}${formatRealized(realized.longTerm)}`}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground flex items-center gap-1.5">
								Total Realized G/L
								{isPEA && (
									<Badge
										variant="outline"
										className="text-micro font-semibold h-4 text-gain bg-gain/10 border-gain/30"
									>
										PEA Tax-Exempt
									</Badge>
								)}
							</p>
							<p
								className={cn(
									"text-lg font-bold font-mono",
									isPEA || realizedUnifiedWithheld
										? "text-muted-foreground"
										: realized.total >= 0
											? "text-gain"
											: "text-loss",
								)}
							>
								{isPEA || realizedUnifiedWithheld
									? "—"
									: `${realized.total >= 0 ? "+" : ""}${formatRealized(realized.total)}`}
							</p>
							{/* The gross internal gain is what the sells were worth
							    minus what they cost, regardless of tax classification —
							    but it still prints only when its recorded basis resolves,
							    PEA or not. */}
							<p className="text-micro text-muted-foreground font-mono mt-0.5">
								Gross internal gain:{" "}
								{realizedUnifiedWithheld
									? "—"
									: `${realized.internalGain >= 0 ? "+" : ""}${formatRealized(realized.internalGain)}`}
							</p>
						</div>
					</div>

					<div className="overflow-x-auto">
						<Table>
							<TableHeader className="bg-muted/20">
								<TableRow>
									{/* Narrow containers (672px sheet on a phone) show the five
									    columns that identify and value a sale; unit prices are
									    secondary — they reappear at @xl width. */}
									<TableHead className="text-xs">Sale Date</TableHead>
									<TableHead className="text-xs text-right">Shares</TableHead>
									<TableHead className="text-xs text-right hidden @xl:table-cell">
										Cost / Share
									</TableHead>
									<TableHead className="text-xs text-right hidden @xl:table-cell">
										Sale / Share
									</TableHead>
									<TableHead className="text-xs text-right hidden @xl:table-cell">
										Cost Basis
									</TableHead>
									<TableHead className="text-xs text-right">Proceeds</TableHead>
									<TableHead className="text-xs text-right">Realized G/L</TableHead>
									<TableHead className="text-xs text-center">Tax Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredDispositions.map((d) => (
									<TableRow key={d.id} className="hover:bg-muted/30 transition-colors">
										<TableCell className="font-mono text-xs font-medium text-foreground">
											{formatDate(d.soldAt)}
										</TableCell>
										<TableCell className="text-right font-mono text-xs">
											{formatQty(d.quantity)}
										</TableCell>
										<TableCell className="text-right font-mono text-xs text-muted-foreground hidden @xl:table-cell">
											{formatDispositionRow(d, d.costBasisPerUnit)}
										</TableCell>
										<TableCell className="text-right font-mono text-xs text-muted-foreground hidden @xl:table-cell">
											{formatDispositionRow(d, d.sellPricePerUnit)}
										</TableCell>
										<TableCell className="text-right font-mono text-xs text-muted-foreground hidden @xl:table-cell">
											{formatDispositionRow(d, d.costBasis)}
										</TableCell>
										<TableCell className="text-right font-mono text-xs text-muted-foreground">
											{formatDispositionRow(d, d.proceeds)}
										</TableCell>
										<TableCell className="text-right font-mono text-xs">
											<span
												className={cn(
													"font-semibold",
													d.realizedGainLoss >= 0 ? "text-gain" : "text-loss",
												)}
											>
												{d.realizedGainLoss >= 0 ? "+" : ""}
												{formatDispositionRow(d, d.realizedGainLoss)}
											</span>
										</TableCell>
										<TableCell className="text-center">
											{d.isTaxExempt || isPEA ? (
												<Badge
													variant="outline"
													className="text-micro font-semibold h-5 text-gain bg-gain/10 border-gain/30"
												>
													PEA Tax-Exempt
												</Badge>
											) : (
												<Badge
													variant="outline"
													className={cn(
														"text-micro font-semibold h-5",
														d.isLongTerm
															? "text-gain bg-gain/10 border-gain/30"
															: "text-warning bg-warning/10 border-warning/30",
													)}
												>
													{d.isLongTerm ? "Long-Term" : "Short-Term"}
												</Badge>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			)}

			{/* Tax Lots Breakdown Table */}
			<div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
				<div className="p-4 border-b border-border/40 flex flex-col @sm:flex-row @sm:items-center justify-between gap-3 bg-muted/10">
					<div className="flex items-center gap-2">
						<span className="text-xs font-bold uppercase tracking-wider text-foreground">
							Holdings Lot Ledger ({filteredLots.length})
						</span>
					</div>

					<div className="flex items-center gap-2">
						<Select
							value={statusFilter}
							onValueChange={(v) => setStatusFilter(v as "ALL" | "OPEN" | "CLOSED")}
						>
							<SelectTrigger
								className="h-7 text-xs w-28 bg-background border-border/40"
								aria-label="Status filter — which lots are listed"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value="OPEN">Open Lots</SelectItem>
								<SelectItem value="ALL">All Lots</SelectItem>
								<SelectItem value="CLOSED">Closed Lots</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="overflow-x-auto">
					<Table>
						<TableHeader className="bg-muted/20">
							<TableRow>
								{/* Five essentials below @xl — identity (date + holding +
								    shares), entry cost, standing P&L, and the lot's tax
								    standing. Derived term/total/current columns reappear at
								    @xl: the P&L cell already implies value over cost. */}
								<TableHead className="text-xs">Acquisition Date</TableHead>
								<TableHead className="text-xs hidden @xl:table-cell">Term / Age</TableHead>
								<TableHead className="text-xs text-right">Shares</TableHead>
								<TableHead className="text-xs text-right">Cost / Share</TableHead>
								<TableHead className="text-xs text-right hidden @xl:table-cell">
									Total Cost
								</TableHead>
								<TableHead className="text-xs text-right hidden @xl:table-cell">
									Current Value
								</TableHead>
								<TableHead className="text-xs text-right">Unrealized Gain/Loss</TableHead>
								<TableHead className="text-xs text-center">Tax Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredLots.length === 0 ? (
								<TableRow>
									<TableCell colSpan={8} className="h-32 text-center align-middle">
										{error ? (
											<div className="mx-auto flex max-w-sm flex-col items-center gap-1.5 py-2">
												<AlertTriangle aria-hidden className="h-5 w-5 text-warning" />
												<p className="text-xs font-semibold text-foreground">
													Could not load tax lots
												</p>
												<p className="text-micro leading-relaxed text-muted-foreground">
													Cost-basis and capital-gain figures are unavailable until this request
													succeeds. No values are shown in the meantime.
												</p>
												<Button
													variant="outline"
													size="sm"
													className="mt-1 h-7 gap-1.5 text-xs cursor-pointer touch-target"
													onClick={refetchAll}
												>
													<RefreshCw className="h-3 w-3" />
													Retry
												</Button>
											</div>
										) : loading ? (
											<p className="text-xs text-muted-foreground">Loading tax lots…</p>
										) : hasLots ? (
											<p className="text-xs text-muted-foreground">
												No tax lots match the selected filter.
											</p>
										) : (
											<div className="mx-auto flex max-w-sm flex-col items-center gap-1.5 py-2">
												<Receipt aria-hidden className="h-5 w-5 text-muted-foreground/60" />
												<p className="text-xs font-semibold text-foreground">
													No tax lots recorded for {symbol}
												</p>
												<p className="text-micro leading-relaxed text-muted-foreground">
													Tax lots are created when a purchase transaction is recorded. They unlock
													cost-basis, holding-period, and capital-gain reporting.
												</p>
												{onNavigateToTransactions && (
													<button
														type="button"
														onClick={onNavigateToTransactions}
														className="text-micro font-semibold text-primary underline underline-offset-2 hover:text-primary/90 cursor-pointer mt-1"
													>
														Record transactions →
													</button>
												)}
											</div>
										)}
									</TableCell>
								</TableRow>
							) : (
								filteredLots.map((lot) => {
									// LOT-FIGURE BASIS: a lot's recorded price/value stands in
									// the lot's own currency. The sheet's fallback price quotes
									// in the instrument's quote currency — substituting it
									// under a lot recorded in a different currency would
									// manufacture a figure the ledger never wrote, so the
									// substitute only applies when the currencies agree.
									// Derived figures dash when they cannot resolve; costs
									// are real either way.
									const lotCurrencyReadable =
										typeof lot.currency === "string" && lot.currency.trim() !== "";
									const lotRecordedPrice =
										lot.currentPrice != null && lot.currentPrice > 0 ? lot.currentPrice : null;
									const substitutePriceValid =
										lotCurrencyReadable && lot.currency === currency && currentPrice > 0;
									const curPrice = lotRecordedPrice ?? (substitutePriceValid ? currentPrice : null);
									const lotPriceResolved = curPrice != null;
									const curVal =
										lot.currentValue != null
											? lot.currentValue
											: curPrice != null
												? lot.remainingQuantity * curPrice
												: null;
									const cost = lot.costBasisPerUnit * lot.remainingQuantity;
									const gainLoss =
										lot.unrealizedGainLoss ?? (curVal != null ? curVal - cost : null);
									const gainLossPct =
										lot.unrealizedGainLossPercent ??
										(curVal != null && cost > 0 ? ((gainLoss ?? 0) / cost) * 100 : null);
									const isLoss = lotPriceResolved && gainLoss != null && gainLoss < 0;

									return (
										<TableRow key={lot.id} className="hover:bg-muted/30 transition-colors">
											{/* Date */}
											<TableCell className="font-mono text-xs font-medium text-foreground">
												{formatDate(lot.acquiredAt)}
											</TableCell>

											{/* Term / Age */}
											<TableCell className="hidden @xl:table-cell">
												<div className="flex items-center gap-1.5">
													<Badge
														variant="outline"
														className={cn(
															"text-micro font-semibold h-5",
															lot.isLongTerm
																? "text-gain bg-gain/10 border-gain/30"
																: "text-warning bg-warning/10 border-warning/30",
														)}
													>
														{lot.isLongTerm ? "Long-Term" : "Short-Term"}
													</Badge>
													<span className="text-micro font-mono text-muted-foreground">
														({lot.holdingPeriodDays}d)
													</span>
												</div>
											</TableCell>

											{/* Quantity */}
											<TableCell className="text-right font-mono text-xs">
												{formatQty(lot.remainingQuantity)}
												{lot.remainingQuantity < lot.initialQuantity && (
													<span className="text-micro text-muted-foreground block">
														of {formatQty(lot.initialQuantity)}
													</span>
												)}
											</TableCell>

											{/* Cost Per Unit */}
											<TableCell className="text-right font-mono text-xs">
												{formatLot(lot, lot.costBasisPerUnit)}
											</TableCell>

											{/* Total Cost */}
											<TableCell className="text-right font-mono text-xs text-muted-foreground hidden @xl:table-cell">
												{formatLot(lot, cost)}
											</TableCell>

											{/* Current Value */}
											<TableCell className="text-right font-mono text-xs font-semibold text-foreground hidden @xl:table-cell">
												{curVal != null ? formatLot(lot, curVal) : "—"}
											</TableCell>

											{/* Unrealized Gain/Loss */}
											<TableCell className="text-right font-mono text-xs">
												{lotPriceResolved && gainLoss != null ? (
													<>
														<span
															className={cn(
																"font-semibold flex items-center justify-end",
																gainLoss >= 0 ? "text-gain" : "text-loss",
															)}
														>
															{gainLoss >= 0 ? "+" : ""}
															{formatLot(lot, gainLoss)}
														</span>
														<span className="text-micro text-muted-foreground block">
															{gainLossPct != null
																? `${gainLossPct >= 0 ? "+" : ""}${gainLossPct.toFixed(2)}%`
																: "—"}
														</span>
													</>
												) : (
													<span className="text-xs text-muted-foreground">—</span>
												)}
											</TableCell>

											{/* Tax Action Badge — the ledger's own dialect: PEA exempts
											    the whole envelope (no harvest nudge applies); US keeps
											    its term-rates; FR is flat PFU; unknown falls back to
											    neutral term badges. Harvest ALSO needs a resolved price, so
											    a missing quote falls through to those same badges. */}
											<TableCell className="text-center">
												{isPEA ? (
													<Badge
														variant="outline"
														className="text-micro font-semibold h-5 text-gain bg-gain/10 border-gain/30"
													>
														PEA Tax-Exempt
													</Badge>
												) : isLoss ? (
													<Badge
														variant="outline"
														className="text-micro bg-loss/10 text-loss border-loss/30 font-medium inline-flex items-center gap-1"
													>
														<Scissors className="h-2.5 w-2.5" />
														Harvestable
													</Badge>
												) : taxJurisdiction === "US" ? (
													// Same dialect as the KPI cards above: one US
													// vocabulary, not a second one invented for this row.
													lot.isLongTerm ? (
														<Badge
															variant="outline"
															className="text-micro h-5 font-semibold text-gain bg-gain/10 border-gain/30"
														>
															Pref. 15-20%
														</Badge>
													) : (
														<span className="text-micro text-muted-foreground font-mono">
															Ordinary Rate
														</span>
													)
												) : taxJurisdiction === "FR" ? (
													<Badge
														variant="outline"
														className="text-micro bg-muted/40 text-muted-foreground border-border/40 font-medium"
													>
														PFU 30%
													</Badge>
												) : lot.isLongTerm ? (
													<Badge
														variant="outline"
														className="text-micro bg-gain/10 text-gain border-gain/30 font-medium"
													>
														Long-Term
													</Badge>
												) : (
													<Badge
														variant="outline"
														className="text-micro bg-warning/10 text-warning border-warning/30 font-medium"
													>
														Short-Term
													</Badge>
												)}
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	);
}

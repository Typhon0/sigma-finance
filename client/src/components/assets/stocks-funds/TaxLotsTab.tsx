import { useQuery } from "@apollo/client";
import { AlertTriangle, Clock, Info, Receipt, RefreshCw, Scissors, ShieldCheck } from "lucide-react";
import { useCallback, useContext, useMemo, useState } from "react";
import { PortfolioContext } from "@/components/PortfolioProvider";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GET_DISPOSITIONS_BY_POSITION, GET_TAX_LOTS_BY_POSITION } from "@/graphql/queries/tax-lots";
import { useAuth } from "@/lib/auth-context";
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
}

export function TaxLotsTab({
	positionId,
	symbol,
	currency = "USD",
	currentPrice = 0,
	accountName,
	accountTaxWrapper,
	portfolioTaxWrapper,
}: TaxLotsTabProps) {
	const portfolioContext = useContext(PortfolioContext);
	let user: any = null;
	try {
		// Safely handle test environments where AuthProvider or mocks may vary
		// eslint-disable-next-line react-hooks/rules-of-hooks
		const auth = useAuth();
		user = auth?.user;
	} catch {
		user = null;
	}
	const taxWrapper =
		accountTaxWrapper ||
		portfolioTaxWrapper ||
		portfolioContext?.selectedPortfolio?.taxWrapper ||
		"STANDARD_TAXABLE";
	const taxJurisdiction = user?.taxJurisdiction || "FR";
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

		for (const l of lots) {
			if (l.remainingQuantity <= 0) continue;
			const cost = l.costBasisPerUnit * l.remainingQuantity;
			const val = (l.currentPrice || currentPrice) * l.remainingQuantity;
			const gl = val - cost;

			totalCost += cost;
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
		};
	}, [lots, currentPrice]);

	const formatCurrency = (val: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			maximumFractionDigits: 2,
		}).format(val);
	};

	const formatDate = (iso: string) => {
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(new Date(iso));
	};

	return (
		<TooltipProvider delayDuration={200}>
			<div className="space-y-6">
				{/* PEA Tax Wrapper Banner */}
				{isPEA ? (
					<div className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
						<ShieldCheck className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />
						<div className="space-y-0.5 text-xs">
							<span className="font-semibold text-emerald-700 dark:text-emerald-300">
								PEA Tax-Sheltered Account (French Equity Plan){accountName ? ` • ${accountName}` : ""}
							</span>
							<p className="text-muted-foreground leading-relaxed">
								Internal tax-sheltered regime under French tax law. Capital gains realized within this envelope are tax-exempt (0% current capital gains tax). Sale tracking and average cost basis (PMP) are maintained for economic performance analysis.
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
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/40 bg-card/40">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-primary" />
							<h3 className="text-sm font-semibold text-foreground">
								Tax-Lot Accounting & Capital Gains
							</h3>
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge
										variant="outline"
										className="text-micro font-mono cursor-help"
										tabIndex={0}
									>
										{taxJurisdiction === "FR" ? "CGI Art. 150-0 D (PMP)" : "IRS Sec. 1012"}
									</Badge>
								</TooltipTrigger>
								{/* side="bottom": the badge sits directly under the sheet's
								    sticky header, so a top-side popup would be covered by it. */}
								<TooltipContent side="bottom" align="end" className="max-w-72">
									<span className="text-xs">
										{taxJurisdiction === "FR" ? (
											<span>
												<span className="font-semibold">French Weighted Average Acquisition Price rule (PMP).</span> In accordance with Art. 150-0 D of the French Tax Code (CGI), securities sales are fiscally valued using the weighted average acquisition cost.
											</span>
										) : (
											<span>
												<span className="font-semibold">U.S. cost-basis rule (§1012).</span> An asset's
												basis is what you paid for it, including fees. This view keeps one ledger entry
												per purchase, so every gain is priced off a recorded lot — never an average.
											</span>
										)}
									</span>
								</TooltipContent>
							</Tooltip>
						</div>
						<p className="text-xs text-muted-foreground">
							Track acquisition lots, holding periods, and capital gain classifications for {symbol}
							.
						</p>
					</div>

					{hasLots && (
						<div className="flex items-center gap-2">
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										aria-label="What the lot strategies mean"
										className="text-muted-foreground cursor-help transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									>
										<span className="text-xs whitespace-nowrap">Lot Strategy:</span>
										<Info className="h-3 w-3 inline ml-0.5 align-[-1px]" aria-hidden="true" />
									</button>
								</TooltipTrigger>
								<TooltipContent className="max-w-80">
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
											<span className="font-mono font-semibold">HIFO (Tax-Loss)</span> — highest
											cost basis first; brings the largest embedded losses to the top for harvest planning.
										</span>
										<span className="block">
											<span className="font-mono font-semibold">LIFO (Last-In)</span> — newest
											purchases first.
										</span>
										<span className="block text-muted-foreground">
											Recorded sales are matched on the server; this sets the review order.
										</span>
									</span>
								</TooltipContent>
							</Tooltip>
							<Select
								value={method}
								onValueChange={(v) => setMethod(v as "FIFO" | "HIFO" | "LIFO" | "PMP")}
							>
								<SelectTrigger className="h-8 text-xs w-36 bg-background">
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
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						{/* 1. Total Cost Basis */}
						<Card className="border-border/40 bg-card/40">
							<CardHeader className="p-4 pb-2">
								<CardDescription className="text-xs font-medium">Total Cost Basis</CardDescription>
								<CardTitle className="text-lg font-bold font-mono">
									{formatCurrency(metrics.totalCost)}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 pt-0 text-xs text-muted-foreground flex justify-between items-center">
								<span>Unrealized P&L</span>
								<span
									className={cn(
										"font-mono font-semibold flex items-center gap-1",
										metrics.totalGainLoss >= 0 ? "text-gain" : "text-loss",
									)}
								>
									{metrics.totalGainLoss >= 0 ? "+" : ""}
									{formatCurrency(metrics.totalGainLoss)} ({metrics.totalGainLossPct.toFixed(2)}%)
								</span>
							</CardContent>
						</Card>

						{/* 2. Short-Term Lots */}
						<Card className="border-border/40 bg-card/40">
							<CardHeader className="p-4 pb-2">
								<div className="flex items-center justify-between">
									<CardDescription className="text-xs font-medium">
										Short-Term (≤365d)
									</CardDescription>
									<Badge
										variant="outline"
										className="text-micro bg-warning/10 text-warning border-warning/30"
									>
										Ordinary Rate
									</Badge>
								</div>
								<CardTitle className="text-lg font-bold font-mono">
									{formatCurrency(metrics.shortTermCost)}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 pt-0 text-xs text-muted-foreground flex justify-between items-center">
								<span>Unrealized Gain</span>
								<span
									className={cn(
										"font-mono font-semibold",
										metrics.shortTermGain >= 0 ? "text-gain" : "text-loss",
									)}
								>
									{metrics.shortTermGain >= 0 ? "+" : ""}
									{formatCurrency(metrics.shortTermGain)}
								</span>
							</CardContent>
						</Card>

						{/* 3. Long-Term Lots */}
						<Card className="border-border/40 bg-card/40">
							<CardHeader className="p-4 pb-2">
								<div className="flex items-center justify-between">
									<CardDescription className="text-xs font-medium">
										Long-Term (&gt;365d)
									</CardDescription>
									<Badge
										variant="outline"
										className="text-micro bg-gain/10 text-gain border-gain/30"
									>
										Pref. 15-20%
									</Badge>
								</div>
								<CardTitle className="text-lg font-bold font-mono">
									{formatCurrency(metrics.longTermCost)}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 pt-0 text-xs text-muted-foreground flex justify-between items-center">
								<span>Unrealized Gain</span>
								<span
									className={cn(
										"font-mono font-semibold",
										metrics.longTermGain >= 0 ? "text-gain" : "text-loss",
									)}
								>
									{metrics.longTermGain >= 0 ? "+" : ""}
									{formatCurrency(metrics.longTermGain)}
								</span>
							</CardContent>
						</Card>

						{/* 4. Tax-Loss Harvesting */}
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
									{metrics.lossLotsCount > 0 && (
										<Badge className="text-micro bg-warning text-warning-foreground font-bold">
											{metrics.lossLotsCount} Lots Eligible
										</Badge>
									)}
								</div>
								<CardTitle
									className={cn(
										"text-lg font-bold font-mono",
										metrics.harvestableLoss > 0 ? "text-warning" : "text-muted-foreground",
									)}
								>
									{formatCurrency(metrics.harvestableLoss)}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 pt-0 text-xs text-muted-foreground">
								{metrics.harvestableLoss > 0 ? (
									<span className="text-warning-muted text-micro">
										Offset realized gains by selling high-cost lots (HIFO).
									</span>
								) : (
									<span>All active lots currently in profit.</span>
								)}
							</CardContent>
						</Card>
					</div>
				)}

				{/* Realized — FISCAL lot-matched gains from recorded disposals. This is a
			    different number from the unrealized cards above (open positions)
			    and from economic average-cost P/L. Empty means no sales recorded
			    through the lot-matching engine — never a synthesized zero. */}
				{hasDispositions && !dispLoading && !dispError && (
					<div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
						<div className="p-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/10">
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
										<SelectTrigger className="h-7 text-xs w-28 bg-background border-border/40">
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

						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
							<div>
								<p className="text-xs text-muted-foreground flex items-center gap-1.5">
									Short-Term Realized G/L
									{isPEA && (
										<Badge variant="outline" className="text-micro font-semibold h-4 text-emerald-500 bg-emerald-500/10 border-emerald-500/30">
											PEA Tax-Exempt
										</Badge>
									)}
								</p>
								<p
									className={cn(
										"text-lg font-bold font-mono",
										realized.shortTerm >= 0 ? "text-gain" : "text-loss",
									)}
								>
									{realized.shortTerm >= 0 ? "+" : ""}
									{formatCurrency(realized.shortTerm)}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground flex items-center gap-1.5">
									Long-Term Realized G/L
									{isPEA && (
										<Badge variant="outline" className="text-micro font-semibold h-4 text-emerald-500 bg-emerald-500/10 border-emerald-500/30">
											PEA Tax-Exempt
										</Badge>
									)}
								</p>
								<p
									className={cn(
										"text-lg font-bold font-mono",
										realized.longTerm >= 0 ? "text-gain" : "text-loss",
									)}
								>
									{realized.longTerm >= 0 ? "+" : ""}
									{formatCurrency(realized.longTerm)}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground flex items-center gap-1.5">
									Total Realized G/L
									{isPEA && (
										<Badge variant="outline" className="text-micro font-semibold h-4 text-emerald-500 bg-emerald-500/10 border-emerald-500/30">
											PEA Tax-Exempt
										</Badge>
									)}
								</p>
								<p
									className={cn(
										"text-lg font-bold font-mono",
										realized.total >= 0 ? "text-gain" : "text-loss",
									)}
								>
									{realized.total >= 0 ? "+" : ""}
									{formatCurrency(realized.total)}
								</p>
								{isPEA && (
									<p className="text-micro text-muted-foreground font-mono mt-0.5">
										Gross internal gain: {realized.internalGain >= 0 ? "+" : ""}{formatCurrency(realized.internalGain)}
									</p>
								)}
							</div>
						</div>

						<div className="overflow-x-auto">
							<Table>
								<TableHeader className="bg-muted/20">
									{" "}
									<TableRow>
										<TableHead className="text-xs">Sale Date</TableHead>
										<TableHead className="text-xs text-right">Shares</TableHead>
										<TableHead className="text-xs text-right">Cost / Share</TableHead>
										<TableHead className="text-xs text-right">Sale / Share</TableHead>
										<TableHead className="text-xs text-right">Cost Basis</TableHead>
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
												{d.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
											</TableCell>
											<TableCell className="text-right font-mono text-xs text-muted-foreground">
												{formatCurrency(d.costBasisPerUnit)}
											</TableCell>
											<TableCell className="text-right font-mono text-xs text-muted-foreground">
												{formatCurrency(d.sellPricePerUnit)}
											</TableCell>
											<TableCell className="text-right font-mono text-xs text-muted-foreground">
												{formatCurrency(d.costBasis)}
											</TableCell>
											<TableCell className="text-right font-mono text-xs text-muted-foreground">
												{formatCurrency(d.proceeds)}
											</TableCell>
											<TableCell className="text-right font-mono text-xs">
												<span
													className={cn(
														"font-semibold",
														d.realizedGainLoss >= 0 ? "text-gain" : "text-loss",
													)}
												>
													{d.realizedGainLoss >= 0 ? "+" : ""}
													{formatCurrency(d.realizedGainLoss)}
												</span>
											</TableCell>
											<TableCell className="text-center">
												{d.isTaxExempt || isPEA ? (
													<Badge
														variant="outline"
														className="text-micro font-semibold h-5 text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
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
					<div className="p-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/10">
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
								<SelectTrigger className="h-7 text-xs w-28 bg-background border-border/40">
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
								{" "}
								<TableRow>
									<TableHead className="text-xs">Acquisition Date</TableHead>
									<TableHead className="text-xs">Term / Age</TableHead>
									<TableHead className="text-xs text-right">Shares</TableHead>
									<TableHead className="text-xs text-right">Cost / Share</TableHead>
									<TableHead className="text-xs text-right">Total Cost</TableHead>
									<TableHead className="text-xs text-right">Current Value</TableHead>
									<TableHead className="text-xs text-right">Unrealized P&L</TableHead>
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
														Tax lots are created when a purchase transaction is recorded. Add one in
														the Transactions tab to enable cost-basis, holding-period, and
														capital-gain reporting.
													</p>
												</div>
											)}
										</TableCell>
									</TableRow>
								) : (
									filteredLots.map((lot) => {
										const curPrice = lot.currentPrice || currentPrice;
										const curVal = lot.currentValue || lot.remainingQuantity * curPrice;
										const cost = lot.costBasisPerUnit * lot.remainingQuantity;
										const gainLoss = lot.unrealizedGainLoss ?? curVal - cost;
										const gainLossPct =
											lot.unrealizedGainLossPercent ?? (cost > 0 ? (gainLoss / cost) * 100 : 0);
										const isLoss = gainLoss < 0;

										return (
											<TableRow key={lot.id} className="hover:bg-muted/30 transition-colors">
												{/* Date */}
												<TableCell className="font-mono text-xs font-medium text-foreground">
													{formatDate(lot.acquiredAt)}
												</TableCell>

												{/* Term / Age */}
												<TableCell>
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
													{lot.remainingQuantity.toLocaleString(undefined, {
														maximumFractionDigits: 4,
													})}
													{lot.remainingQuantity < lot.initialQuantity && (
														<span className="text-micro text-muted-foreground block">
															of {lot.initialQuantity}
														</span>
													)}
												</TableCell>

												{/* Cost Per Unit */}
												<TableCell className="text-right font-mono text-xs">
													{formatCurrency(lot.costBasisPerUnit)}
												</TableCell>

												{/* Total Cost */}
												<TableCell className="text-right font-mono text-xs text-muted-foreground">
													{formatCurrency(cost)}
												</TableCell>

												{/* Current Value */}
												<TableCell className="text-right font-mono text-xs font-semibold text-foreground">
													{formatCurrency(curVal)}
												</TableCell>

												{/* Unrealized P&L */}
												<TableCell className="text-right font-mono text-xs">
													<span
														className={cn(
															"font-semibold flex items-center justify-end",
															gainLoss >= 0 ? "text-gain" : "text-loss",
														)}
													>
														{gainLoss >= 0 ? "+" : ""}
														{formatCurrency(gainLoss)}
													</span>
													<span className="text-micro text-muted-foreground block">
														{gainLossPct >= 0 ? "+" : ""}
														{gainLossPct.toFixed(2)}%
													</span>
												</TableCell>

												{/* Tax Action Badge */}
												<TableCell className="text-center">
													{isLoss ? (
														<Badge
															variant="outline"
															className="text-micro bg-loss/10 text-loss border-loss/30 font-medium inline-flex items-center gap-1"
														>
															<Scissors className="h-2.5 w-2.5" />
															Harvestable
														</Badge>
													) : lot.isLongTerm ? (
														<Badge
															variant="outline"
															className="text-micro bg-gain/10 text-gain border-gain/30 font-medium"
														>
															Low Tax Rate
														</Badge>
													) : (
														<span className="text-micro text-muted-foreground font-mono">
															Hold &gt; 1yr
														</span>
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
		</TooltipProvider>
	);
}

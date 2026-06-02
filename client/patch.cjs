const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "src/components/StocksFundsModule.tsx");
let code = fs.readFileSync(file, "utf-8");

// 1. Add CheckCircle2 and PiggyBank to lucide imports
code = code.replace(
	/\tChevronDown,\n\tPackage,/,
	"\tCheckCircle2,\n\tChevronDown,\n\tPackage,\n\tPiggyBank,",
);

// 2. Replace DiversificationCard function entirely
const divStart = code.indexOf("function DiversificationCard(");
const divBodyStart = code.indexOf("{", code.indexOf("}) {", divStart) + 2);
// Find matching closing brace
let braceCount = 0;
let divEnd = -1;
for (let i = divBodyStart; i < code.length; i++) {
	if (code[i] === "{") braceCount++;
	if (code[i] === "}") braceCount--;
	if (braceCount === 0) {
		divEnd = i + 1;
		break;
	}
}

const portfolioHealthCard = `function PortfolioHealthCard({
\tassets,
}: {
\tassets: StockAsset[];
\tformatCurrency: (value: number) => string;
\tonFilterSelect: (filter: InsightFilter | null) => void;
}) {
\tconst totalValue = assets.reduce((sum, a) => sum + a.totalValue, 0);
\tconst sorted = [...assets].sort((a, b) => b.totalValue - a.totalValue);
\tconst topHolding = sorted[0];
\tconst topPct = topHolding && totalValue > 0 ? (topHolding.totalValue / totalValue) * 100 : 0;
\tconst top3Pct = totalValue > 0 ? (sorted.slice(0, 3).reduce((s, a) => s + a.totalValue, 0) / totalValue) * 100 : 0;
\tconst sectorMap = new Map<string, number>();
\tfor (const a of assets) {
\t\tif (a.sector && a.sector !== "Other" && a.sector !== "Unknown sector") {
\t\t\tsectorMap.set(a.sector, (sectorMap.get(a.sector) || 0) + a.totalValue);
\t\t}
\t}
\tconst topSector = Array.from(sectorMap.entries()).sort((a, b) => b[1] - a[1])[0];
\tconst topSectorPct = topSector && totalValue > 0 ? (topSector[1] / totalValue) * 100 : 0;
\tconst missingCount = assets.filter((a) => !a.sector || a.sector === "Other" || a.sector === "Unknown sector").length;
\tconst risk = topPct > 25 ? "High" : topPct > 15 ? "Medium" : "Low";

\treturn (
\t\t<Card className="h-full min-h-[300px] border-border/60 bg-card/80">
\t\t\t<CardHeader className="pb-3">
\t\t\t\t<div className="flex items-center justify-between">
\t\t\t\t\t<CardTitle className="text-sm font-semibold tracking-tight">Portfolio Health</CardTitle>
\t\t\t\t\t{assets.length > 0 && (
\t\t\t\t\t\t<span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", risk === "High" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : risk === "Medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")}>Risk: {risk}</span>
\t\t\t\t\t)}
\t\t\t\t</div>
\t\t\t</CardHeader>
\t\t\t<CardContent className="flex h-full flex-col justify-center space-y-4 pt-1 text-sm">
\t\t\t\t{assets.length > 0 ? (<>
\t\t\t\t\t<div className="flex justify-between border-b border-border/40 pb-2">
\t\t\t\t\t\t<span className="text-muted-foreground">Top holding</span>
\t\t\t\t\t\t<span className="font-medium">{topHolding?.symbol || "-"} <span className="font-mono text-muted-foreground">{topPct.toFixed(0)}%</span></span>
\t\t\t\t\t</div>
\t\t\t\t\t<div className="flex justify-between border-b border-border/40 pb-2">
\t\t\t\t\t\t<span className="text-muted-foreground">Top 3 holdings</span>
\t\t\t\t\t\t<span className="font-mono font-medium">{top3Pct.toFixed(0)}%</span>
\t\t\t\t\t</div>
\t\t\t\t\t<div className="flex justify-between border-b border-border/40 pb-2">
\t\t\t\t\t\t<span className="text-muted-foreground">Largest sector</span>
\t\t\t\t\t\t<span className="font-medium">{topSector ? topSector[0] : "-"} <span className="font-mono text-muted-foreground">{topSectorPct.toFixed(0)}%</span></span>
\t\t\t\t\t</div>
\t\t\t\t\t{missingCount > 0 ? (
\t\t\t\t\t\t<div className="flex items-start gap-2 bg-amber-500/10 text-amber-500 p-2.5 rounded-lg border border-amber-500/20">
\t\t\t\t\t\t\t<AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
\t\t\t\t\t\t\t<div className="text-xs leading-tight">
\t\t\t\t\t\t\t\t<span className="font-semibold block mb-0.5">{missingCount} assets need metadata</span>
\t\t\t\t\t\t\t\tAssign sector/region to improve analytics.
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t) : (
\t\t\t\t\t\t<div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 p-2.5 rounded-lg border border-emerald-500/20">
\t\t\t\t\t\t\t<CheckCircle2 className="h-4 w-4" />
\t\t\t\t\t\t\t<span className="text-xs font-semibold">All assets classified</span>
\t\t\t\t\t\t</div>
\t\t\t\t\t)}
\t\t\t\t</>) : (
\t\t\t\t\t<p className="text-center text-xs text-muted-foreground">No assets available.</p>
\t\t\t\t)}
\t\t\t</CardContent>
\t\t</Card>
\t);
}`;

code = code.substring(0, divStart) + portfolioHealthCard + code.substring(divEnd);

// 3. Replace IncomeProjectorCard function entirely
const incStart = code.indexOf("function IncomeProjectorCard(");
const incBodyStart = code.indexOf("{", code.indexOf("}) {", incStart) + 2);
braceCount = 0;
let incEnd = -1;
for (let i = incBodyStart; i < code.length; i++) {
	if (code[i] === "{") braceCount++;
	if (code[i] === "}") braceCount--;
	if (braceCount === 0) {
		incEnd = i + 1;
		break;
	}
}

const incomeForecastCard = `function IncomeForecastCard({
\tassets,
\tformatCurrency,
}: {
\tassets: StockAsset[];
\tformatCurrency: (value: number) => string;
}) {
\tconst dividendAssets = assets.filter((a) => (a.dividendYield ?? 0) > 0);
\tconst forwardAnnual = dividendAssets.reduce((sum, a) => sum + a.totalValue * ((a.dividendYield ?? 0) / 100), 0);
\tconst totalValue = assets.reduce((sum, a) => sum + a.totalValue, 0);
\tconst overallYield = totalValue > 0 ? (forwardAnnual / totalValue) * 100 : 0;
\tconst bestPayer = dividendAssets.length > 0 ? dividendAssets.reduce((prev, curr) => {
\t\treturn curr.totalValue * ((curr.dividendYield ?? 0) / 100) > prev.totalValue * ((prev.dividendYield ?? 0) / 100) ? curr : prev;
\t}) : null;
\tconst bestPayerAnnual = bestPayer ? bestPayer.totalValue * ((bestPayer.dividendYield ?? 0) / 100) : 0;

\treturn (
\t\t<Card className="h-full min-h-[300px] border-border/60 bg-card/80">
\t\t\t<CardHeader className="pb-3">
\t\t\t\t<CardTitle className="text-sm font-semibold tracking-tight">Income Forecast</CardTitle>
\t\t\t</CardHeader>
\t\t\t<CardContent className="flex h-full flex-col justify-between gap-4 pt-1">
\t\t\t\t{forwardAnnual > 0 ? (<>
\t\t\t\t\t<div className="grid grid-cols-2 gap-4 text-xs">
\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Next 12 Months</p>
\t\t\t\t\t\t\t<p className="pt-1 font-mono text-base font-semibold text-emerald-500">{formatCurrency(forwardAnnual)}</p>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Yield</p>
\t\t\t\t\t\t\t<p className="pt-1 font-mono text-base font-semibold">{overallYield.toFixed(2)}%</p>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t\t<div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-border/40 text-xs">
\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t<p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">Best payer</p>
\t\t\t\t\t\t\t<p className="font-semibold">{bestPayer?.symbol || "-"}</p>
\t\t\t\t\t\t\t<p className="text-muted-foreground mt-0.5"><span className="text-emerald-500 font-mono">{formatCurrency(bestPayerAnnual)}</span> / yr</p>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t<p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">Payers</p>
\t\t\t\t\t\t\t<p className="font-semibold">{dividendAssets.length}</p>
\t\t\t\t\t\t\t<p className="text-muted-foreground mt-0.5">of {assets.length} assets</p>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t</>) : (
\t\t\t\t\t<div className="flex flex-col items-center justify-center h-full gap-2 text-center">
\t\t\t\t\t\t<PiggyBank className="h-8 w-8 text-muted-foreground/50" />
\t\t\t\t\t\t<p className="text-xs text-muted-foreground max-w-[200px]">No dividend income yet. Your holdings are mostly growth assets.</p>
\t\t\t\t\t</div>
\t\t\t\t)}
\t\t\t</CardContent>
\t\t</Card>
\t);
}`;

code = code.substring(0, incStart) + incomeForecastCard + code.substring(incEnd);

// 4. Replace DynamicInsightCard function entirely
const dynStart = code.indexOf("function DynamicInsightCard(");
const dynBodyStart = code.indexOf("{", code.indexOf("}) {", dynStart) + 2);
braceCount = 0;
let dynEnd = -1;
for (let i = dynBodyStart; i < code.length; i++) {
	if (code[i] === "{") braceCount++;
	if (code[i] === "}") braceCount--;
	if (braceCount === 0) {
		dynEnd = i + 1;
		break;
	}
}

const perfDriversCard = `function PerformanceDriversCard({
\tassets,
\tformatCurrency,
}: {
\tassets: StockAsset[];
\tformatCurrency: (value: number) => string;
}) {
\tconst sorted = [...assets].filter((a) => a.totalReturn !== undefined).sort((a, b) => (b.totalReturn || 0) - (a.totalReturn || 0));
\tconst topContributors = sorted.filter((a) => (a.totalReturn || 0) > 0).slice(0, 3);
\tconst worstDraggers = [...sorted].reverse().filter((a) => (a.totalReturn || 0) < 0).slice(0, 2);
\tconst totalGain = assets.reduce((sum, a) => sum + (a.totalReturn || 0), 0);

\treturn (
\t\t<Card className="h-full min-h-[300px] border-border/60 bg-card/80">
\t\t\t<CardHeader className="pb-3">
\t\t\t\t<CardTitle className="text-sm font-semibold tracking-tight">Performance Drivers</CardTitle>
\t\t\t</CardHeader>
\t\t\t<CardContent className="flex h-full flex-col justify-center space-y-4 pt-1 text-xs">
\t\t\t\t{assets.length > 0 ? (<>
\t\t\t\t\t<div className="border-b border-border/40 pb-3">
\t\t\t\t\t\t<p className={cn("font-mono text-lg font-semibold", totalGain >= 0 ? "text-emerald-500" : "text-rose-500")}>{totalGain >= 0 ? "+" : ""}{formatCurrency(totalGain)}</p>
\t\t\t\t\t\t<p className="text-[10px] text-muted-foreground mt-0.5">Total gain</p>
\t\t\t\t\t</div>
\t\t\t\t\t<div className="grid grid-cols-2 gap-4">
\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t<p className="text-[10px] uppercase text-muted-foreground mb-2 font-medium tracking-wider">Top contributors</p>
\t\t\t\t\t\t\t<div className="space-y-2">
\t\t\t\t\t\t\t\t{topContributors.length > 0 ? topContributors.map((a) => (
\t\t\t\t\t\t\t\t\t<div key={a.symbol} className="flex justify-between items-center">
\t\t\t\t\t\t\t\t\t\t<span className="truncate w-16 font-medium">{a.symbol}</span>
\t\t\t\t\t\t\t\t\t\t<span className="text-emerald-500 font-mono">+{formatCurrency(a.totalReturn || 0)}</span>
\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t)) : <span className="text-muted-foreground italic">—</span>}
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t<p className="text-[10px] uppercase text-muted-foreground mb-2 font-medium tracking-wider">Worst draggers</p>
\t\t\t\t\t\t\t<div className="space-y-2">
\t\t\t\t\t\t\t\t{worstDraggers.length > 0 ? worstDraggers.map((a) => (
\t\t\t\t\t\t\t\t\t<div key={a.symbol} className="flex justify-between items-center">
\t\t\t\t\t\t\t\t\t\t<span className="truncate w-16 font-medium">{a.symbol}</span>
\t\t\t\t\t\t\t\t\t\t<span className="text-rose-500 font-mono">{formatCurrency(a.totalReturn || 0)}</span>
\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t)) : <span className="text-muted-foreground italic">—</span>}
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t</>) : (
\t\t\t\t\t<p className="text-center text-xs text-muted-foreground">Add purchase prices to see your winners and losers.</p>
\t\t\t\t)}
\t\t\t</CardContent>
\t\t</Card>
\t);
}`;

code = code.substring(0, dynStart) + perfDriversCard + code.substring(dynEnd);

// 5. Update references in the render grid
code = code.replace("<DiversificationCard", "<PortfolioHealthCard");
code = code.replace("<IncomeProjectorCard", "<IncomeForecastCard");
code = code.replace("<DynamicInsightCard", "<PerformanceDriversCard");

fs.writeFileSync(file, code);
console.log("✅ Patched successfully");

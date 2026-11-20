import { useState, useMemo } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	simulateEarlyRepayment,
	type PortfolioLoanItem,
	computeLoanAmortization,
} from "@/lib/loan-calculator";
import { TrendingDown, Calendar, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EarlyRepaymentSimulatorDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	loanItems: PortfolioLoanItem[];
	formatCurrency: (val: number) => string;
}

export function EarlyRepaymentSimulatorDialog({
	isOpen,
	onOpenChange,
	loanItems,
	formatCurrency,
}: EarlyRepaymentSimulatorDialogProps) {
	const [selectedLoanId, setSelectedLoanId] = useState<string>(
		loanItems[0]?.id || "",
	);
	const [lumpSum, setLumpSum] = useState<number>(10000);
	const [extraMonthly, setExtraMonthly] = useState<number>(0);
	const [strategy, setStrategy] = useState<"duration" | "payment">("duration");

	const activeLoan = useMemo(() => {
		return loanItems.find((l) => l.id === selectedLoanId) || loanItems[0];
	}, [loanItems, selectedLoanId]);

	const currencySymbol = useMemo(() => {
		const formatted = formatCurrency(0);
		return formatted.replace(/[\d\s.,]/g, "") || "€";
	}, [formatCurrency]);

	const loanMetrics = useMemo(() => {
		if (!activeLoan) return null;

		const duration = activeLoan.durationMonths ?? 120;
		const base = computeLoanAmortization({
			loanAmount: activeLoan.loanAmount,
			interestRate: activeLoan.interestRate,
			durationMonths: duration,
			startDate: activeLoan.startDate,
		});

		const remainingMonths =
			base.monthsRemaining > 0
				? base.monthsRemaining
				: Math.max(1, duration);

		const result = simulateEarlyRepayment({
			remainingBalance: activeLoan.remainingBalance,
			interestRate: activeLoan.interestRate,
			monthlyPayment: activeLoan.monthlyPayment || base.monthlyPayment,
			remainingMonths,
			lumpSumPrepayment: lumpSum,
			extraMonthlyPayment: extraMonthly,
		});

		// Calculate new payoff date
		const newDate = new Date();
		newDate.setMonth(newDate.getMonth() + result.reducedDurationMonths);

		const originalDate = new Date();
		originalDate.setMonth(originalDate.getMonth() + remainingMonths);

		return {
			...result,
			remainingMonths,
			newDate,
			originalDate,
		};
	}, [activeLoan, lumpSum, extraMonthly]);

	if (!activeLoan || !loanMetrics) return null;

	const lumpSumPresets = [2500, 5000, 10000, 20000];
	const extraMonthlyPresets = [0, 50, 100, 200];

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[620px] bg-background border-border/60">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<div className="h-8 w-8 rounded-lg bg-gain/10 text-gain flex items-center justify-center">
							<Sparkles className="h-4 w-4" />
						</div>
						<div>
							<DialogTitle className="text-base font-semibold">
								Early Repayment Simulator
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								Estimate interest savings and loan term reduction by injecting capital.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-5 py-2">
					{/* Loan Selector if multiple */}
					{loanItems.length > 1 && (
						<div className="space-y-1.5">
							<Label className="text-xs text-muted-foreground">Target Loan</Label>
							<div className="flex gap-2 flex-wrap">
								{loanItems.map((l) => (
									<Button
										key={l.id}
										type="button"
										size="sm"
										variant={selectedLoanId === l.id ? "default" : "outline"}
										onClick={() => setSelectedLoanId(l.id)}
										className="text-xs h-7"
									>
										{l.name}
									</Button>
								))}
							</div>
						</div>
					)}

					{/* Prepayment Inputs */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{/* Lump sum */}
						<div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border/40">
							<Label className="text-xs font-semibold flex items-center justify-between">
								<span>Lump-Sum Prepayment</span>
								<span className="font-mono text-gain">{formatCurrency(lumpSum)}</span>
							</Label>
							<Input
								type="number"
								min={0}
								max={activeLoan.remainingBalance}
								step={500}
								value={lumpSum || ""}
								onChange={(e) => setLumpSum(Number(e.target.value) || 0)}
								className="h-8 font-mono text-sm"
								placeholder={`0 ${currencySymbol}`}
							/>
							<div className="flex gap-1.5 flex-wrap pt-1">
								{lumpSumPresets.map((val) => (
									<Button
										key={val}
										type="button"
										variant={lumpSum === val ? "secondary" : "ghost"}
										size="sm"
										onClick={() => setLumpSum(val)}
										className="h-6 px-2 text-[11px] font-mono"
									>
										+{val >= 1000 ? `${val / 1000}k` : val} {currencySymbol}
									</Button>
								))}
							</div>
						</div>

						{/* Recurring Extra Monthly */}
						<div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border/40">
							<Label className="text-xs font-semibold flex items-center justify-between">
								<span>Extra Monthly Payment</span>
								<span className="font-mono text-primary">+{formatCurrency(extraMonthly)}/mo</span>
							</Label>
							<Input
								type="number"
								min={0}
								step={25}
								value={extraMonthly || ""}
								onChange={(e) => setExtraMonthly(Number(e.target.value) || 0)}
								className="h-8 font-mono text-sm"
								placeholder={`0 ${currencySymbol} / mo`}
							/>
							<div className="flex gap-1.5 flex-wrap pt-1">
								{extraMonthlyPresets.map((val) => (
									<Button
										key={val}
										type="button"
										variant={extraMonthly === val ? "secondary" : "ghost"}
										size="sm"
										onClick={() => setExtraMonthly(val)}
										className="h-6 px-2 text-[11px] font-mono"
									>
										+{val} {currencySymbol}/mo
									</Button>
								))}
							</div>
						</div>
					</div>

					{/* Live Simulation Results */}
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
						{/* Card 1: Interest Saved */}
						<div className="p-3 rounded-xl bg-gain/10 border border-gain/20 space-y-1">
							<div className="flex items-center gap-1.5 text-gain text-xs font-semibold">
								<TrendingDown className="h-3.5 w-3.5" />
								<span>Interest Saved</span>
							</div>
							<div className="font-mono text-xl font-bold text-gain">
								{formatCurrency(loanMetrics.interestSaved)}
							</div>
							<div className="text-[11px] text-muted-foreground">
								saved in bank interest
							</div>
						</div>

						{/* Card 2: Duration Saved */}
						<div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
							<div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
								<Clock className="h-3.5 w-3.5" />
								<span>Time Saved</span>
							</div>
							<div className="font-mono text-xl font-bold text-foreground">
								{loanMetrics.monthsSaved >= 12
									? `${Math.floor(loanMetrics.monthsSaved / 12)} yr${Math.floor(loanMetrics.monthsSaved / 12) > 1 ? "s" : ""} ${loanMetrics.monthsSaved % 12 > 0 ? `and ${loanMetrics.monthsSaved % 12} mo` : ""}`
									: `${loanMetrics.monthsSaved} months`}
							</div>
							<div className="text-[11px] text-muted-foreground">
								payoff accelerated
							</div>
						</div>

						{/* Card 3: Payoff Date */}
						<div className="p-3 rounded-xl bg-muted/60 border border-border/40 space-y-1 col-span-2 sm:col-span-1">
							<div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold">
								<Calendar className="h-3.5 w-3.5" />
								<span>New Payoff Date</span>
							</div>
							<div className="font-mono text-base font-bold text-foreground">
								{loanMetrics.newDate.toLocaleDateString("en-US", {
									month: "short",
									year: "numeric",
								})}
							</div>
							<div className="text-[11px] text-muted-foreground line-through">
								instead of {loanMetrics.originalDate.toLocaleDateString("en-US", {
									month: "short",
									year: "numeric",
								})}
							</div>
						</div>
					</div>

					{/* Alternative: Lower Monthly Payment */}
					{loanMetrics.monthlyPaymentSavings > 0 && (
						<div className="p-3 rounded-xl bg-secondary/30 border border-border/40 flex items-center justify-between text-xs">
							<div className="space-y-0.5">
								<div className="font-semibold text-foreground flex items-center gap-1.5">
									<CheckCircle2 className="h-3.5 w-3.5 text-primary" />
									Alternative: Lower monthly payment (same payoff date)
								</div>
								<div className="text-muted-foreground text-micro">
									Your monthly payment would drop to{" "}
									<span className="font-mono font-semibold text-foreground">
										{formatCurrency(loanMetrics.newMonthlyPayment)}/mo
									</span>
								</div>
							</div>
							<div className="font-mono font-bold text-gain text-right">
								-{formatCurrency(loanMetrics.monthlyPaymentSavings)}/mo
							</div>
						</div>
					)}
				</div>

				<div className="flex justify-end pt-2 border-t border-border/40">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onOpenChange(false)}
						className="h-8 text-xs"
					>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

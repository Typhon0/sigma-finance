import { useQuery } from "@apollo/client";
import {
	AlertCircle,
	ArrowLeft,
	Building2,
	Check,
	Coins,
	Copy,
	Pencil,
	Plus,
	Trash2,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GET_TRANSACTIONS_BY_ACCOUNT } from "@/graphql/queries/transactions";
import { useCurrency } from "@/hooks/use-currency";
import { classifyAccount } from "@/lib/account-classifier";
import { parseTransaction } from "@/lib/transaction-cleaner";
import { cn, formatCurrency as formatCurrencyWithCode } from "@/lib/utils";
import { DeleteSavingDialog } from "./DeleteSavingDialog";
import { EditSavingDialog } from "./EditSavingDialog";
import { RecordSavingMovementDialog } from "./RecordSavingMovementDialog";
import { resolveBankName, resolveCategoryLabel } from "./savings-utils";

interface SavingDetailProps {
	savingId: string;
	onBack: () => void;
	isPanel?: boolean;
}

interface LocalMovement {
	id: string;
	date: string;
	type: string;
	total: number;
	notes?: string;
	currency?: string;
}

export function SavingDetail({ savingId, onBack, isPanel = false }: SavingDetailProps) {
	const { assets, transactions, refetch } = usePortfolio();
	const { currency: defaultCurrency } = useCurrency();

	const [hasCopiedAccountNum, setHasCopiedAccountNum] = useState(false);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [showRecordMovementDialog, setShowRecordMovementDialog] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	// Load custom rate override if stored
	const customRatesMap = useMemo(() => {
		try {
			return JSON.parse(localStorage.getItem("sf_savings_custom_rates") || "{}");
		} catch {
			return {};
		}
	}, []);

	// Find saving asset
	const saving = useMemo(() => {
		const match = assets.find((a) => a.id === savingId);
		if (!match) return null;

		const customRate = customRatesMap[match.id];
		const effectiveRate = typeof customRate === "number" ? customRate : (match.interestRate ?? 0);
		const bankName = resolveBankName(match.name || "", match.institution || match.symbol);

		const effectiveBalance =
			typeof match.balance === "number" && match.balance > 0
				? match.balance
				: typeof match.currentValue === "number" && match.currentValue > 0
					? match.currentValue
					: match.purchasePrice || 0;

		return {
			id: match.id,
			accountId: (match as any).accountId || undefined,
			bankName,
			accountName: match.name,
			balance: effectiveBalance,
			ownership: (match.accountType === "joint"
				? "joint"
				: match.accountType === "company"
					? "company"
					: "personal") as "personal" | "joint" | "company",
			interestRate: effectiveRate,
			currency: match.currency || defaultCurrency || "EUR",
			accountType: match.accountType || match.type || "savings",
			accountNumber: match.accountNumber || `****${match.id.slice(-4)}`,
			initialDeposit: match.purchasePrice || 0,
		};
	}, [assets, savingId, customRatesMap, defaultCurrency]);

	const savingAccountId = saving?.accountId;
	const { data: accountTxData } = useQuery(GET_TRANSACTIONS_BY_ACCOUNT, {
		variables: {
			filter: { accountID: savingAccountId },
			pagination: { limit: 50, offset: 0 },
		},
		skip: !savingAccountId,
		fetchPolicy: "cache-and-network",
	});

	// Transactions for this saving account (from server + local movements)
	const mergedTransactions = useMemo(() => {
		if (!saving) return [];

		const txMap = new Map<string, any>();

		// 1. Transactions directly from GraphQL account query
		for (const t of (accountTxData?.transactions || []) as any[]) {
			const amountVal = t.amount ?? t.quantity * (t.unitPriceAmount || 0);
			const cleaned = parseTransaction({
				notes: t.notes,
				transactionType: t.transactionType,
				amount: amountVal,
			});
			txMap.set(t.id, {
				id: t.id,
				date: t.executedAt,
				type: (t.transactionType || "deposit").toLowerCase(),
				total: Math.abs(amountVal),
				rawAmount: amountVal,
				notes: t.notes as string | undefined,
				cleaned,
			});
		}

		// 2. Server transactions matching this asset or account
		for (const t of transactions as any[]) {
			if (
				t.assetId === saving.id ||
				t.asset?.id === saving.id ||
				(saving.accountId &&
					(t.accountId === saving.accountId || t.account?.id === saving.accountId))
			) {
				if (!txMap.has(t.id)) {
					const amountVal =
						typeof t.amount === "number" ? t.amount : typeof t.total === "number" ? t.total : 0;
					const cleaned = parseTransaction({
						notes: t.notes,
						transactionType: t.type || t.transactionType || "deposit",
						amount: amountVal,
					});
					txMap.set(t.id, {
						id: t.id,
						date: t.executedAt || t.date || new Date().toISOString(),
						type: (t.transactionType || t.type || "deposit").toLowerCase(),
						total: Math.abs(amountVal),
						rawAmount: amountVal,
						notes: t.notes as string | undefined,
						cleaned,
					});
				}
			}
		}

		// 3. Local recorded movements
		let localTx: LocalMovement[] = [];
		try {
			localTx = JSON.parse(localStorage.getItem(`sf_saving_tx_${saving.id}`) || "[]");
		} catch {
			localTx = [];
		}

		for (const lt of localTx) {
			if (!txMap.has(lt.id)) {
				const cleaned = parseTransaction({
					notes: lt.notes,
					transactionType: lt.type,
					amount: lt.total,
				});
				txMap.set(lt.id, {
					id: lt.id,
					date: lt.date,
					type: lt.type.toLowerCase(),
					total: Math.abs(lt.total),
					rawAmount: lt.total,
					notes: lt.notes,
					cleaned,
				});
			}
		}

		const combined = Array.from(txMap.values());
		combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
		return combined;
	}, [saving, transactions, accountTxData?.transactions]);

	const handleCopyNumber = (num: string) => {
		navigator.clipboard.writeText(num);
		setHasCopiedAccountNum(true);
		toast.success("Account identifier copied");
		setTimeout(() => setHasCopiedAccountNum(false), 2000);
	};

	if (!saving) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
				<AlertCircle className="h-10 w-10 text-muted-foreground" />
				<h2 className="text-base font-semibold">Savings Account Not Found</h2>
				<p className="text-xs text-muted-foreground">
					This account may have been deleted or moved.
				</p>
				<Button variant="outline" size="sm" onClick={onBack}>
					Back to Savings
				</Button>
			</div>
		);
	}

	const classification = classifyAccount({
		name: saving.accountName,
		type: "Bank",
		institution: saving.bankName,
		accountNumber: saving.accountNumber,
	});

	const categoryLabel = resolveCategoryLabel(
		saving.accountName,
		saving.accountType,
		classification.isVault,
	);

	const hasPositiveRate = typeof saving.interestRate === "number" && saving.interestRate > 0;
	const annualInterest = hasPositiveRate ? (saving.balance * saving.interestRate) / 100 : 0;
	const monthlyInterest = annualInterest / 12;

	// Two-letter monogram mark for bank
	const bankMonogram = (saving.bankName || "SV").slice(0, 2).toUpperCase();

	return (
		<div className="flex flex-col h-full overflow-y-auto p-5 sm:p-6 space-y-6 text-foreground">
			{/* Header: Institutional Identity & Actions */}
			<div className="flex items-start justify-between gap-3 border-b border-border/30 pb-4">
				<div className="flex items-start gap-3 min-w-0 flex-1">
					{!isPanel && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onBack}
							className="h-8 w-8 shrink-0 touch-target mt-0.5"
							aria-label="Back to savings list"
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
					)}

					{/* Bank Monogram Logo */}
					<div
						className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 select-none"
						aria-hidden="true"
					>
						{bankMonogram}
					</div>

					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
								{saving.accountName}
							</h2>
							<Badge
								variant="outline"
								className="text-micro uppercase font-mono px-1.5 py-0 h-4 border-primary/30 text-primary font-semibold shrink-0"
							>
								{saving.currency}
							</Badge>
						</div>

						<div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground flex-wrap">
							<span className="font-medium text-foreground/90">{saving.bankName}</span>
							<span>•</span>
							<span className="font-mono text-muted-foreground">{saving.accountNumber}</span>
							<button
								type="button"
								onClick={() => handleCopyNumber(saving.accountNumber)}
								className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center"
								title="Copy account identifier"
								aria-label="Copy account identifier"
							>
								{hasCopiedAccountNum ? (
									<Check className="h-3 w-3 text-gain" />
								) : (
									<Copy className="h-3 w-3" />
								)}
							</button>
							<span>•</span>
							<Badge
								variant="outline"
								className="text-micro font-normal px-1.5 py-0 h-4 border-border/50 text-muted-foreground"
							>
								{categoryLabel}
							</Badge>
							<Badge
								variant="secondary"
								className="text-micro font-normal capitalize px-1.5 py-0 h-4"
							>
								{saving.ownership}
							</Badge>
						</div>
					</div>
				</div>

				{/* Header Actions - Padded away from Drawer's X button */}
				<div className={cn("flex items-center gap-1.5 shrink-0", isPanel && "pr-7 sm:pr-8")}>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowEditDialog(true)}
						className="h-8 text-xs gap-1.5 border-border/50 touch-target"
					>
						<Pencil className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Edit</span>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setShowDeleteDialog(true)}
						className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 touch-target"
						title="Delete account"
						aria-label="Delete account"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			{/* Hero Balance & Yield Card (Replaces the broken 4-box layout) */}
			<div className="rounded-xl border border-border/40 bg-card p-5 space-y-4 shadow-xs">
				<div className="space-y-1">
					<span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
						Current Balance
					</span>
					<div className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-foreground">
						{formatCurrencyWithCode(saving.balance, saving.currency)}
					</div>
				</div>

				{/* Yield Metrics Strip (When positive rate is recorded) */}
				{hasPositiveRate ? (
					<div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/25">
						<div className="space-y-0.5">
							<span className="text-micro uppercase font-medium tracking-wider text-muted-foreground block truncate">
								Interest APY
							</span>
							<div className="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
								{saving.interestRate.toFixed(2)}%
							</div>
						</div>

						<div className="space-y-0.5">
							<span className="text-micro uppercase font-medium tracking-wider text-muted-foreground block truncate">
								Est. Annual Yield
							</span>
							<div className="text-base sm:text-lg font-bold font-mono tracking-tight text-gain">
								+{formatCurrencyWithCode(annualInterest, saving.currency)}
							</div>
						</div>

						<div className="space-y-0.5">
							<span className="text-micro uppercase font-medium tracking-wider text-muted-foreground block truncate">
								Est. Monthly
							</span>
							<div className="text-base sm:text-lg font-bold font-mono tracking-tight text-gain">
								+{formatCurrencyWithCode(monthlyInterest, saving.currency)}
							</div>
						</div>
					</div>
				) : (
					/* Quiet Non-Interest Bearing State with 1-Click Rate Setup */
					<div className="flex items-center justify-between pt-3 border-t border-border/25 text-xs">
						<div className="flex items-center gap-2 text-muted-foreground">
							<span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
							<span>Standard Cash Reserve • Non-interest bearing (0.00% APY)</span>
						</div>
						<Button
							variant="link"
							size="sm"
							onClick={() => setShowEditDialog(true)}
							className="h-auto p-0 text-xs text-primary font-medium hover:underline shrink-0"
						>
							Set interest rate →
						</Button>
					</div>
				)}
			</div>

			{/* Account Specifications: Crisp Key-Value Ledger */}
			<div className="rounded-xl border border-border/40 bg-card p-4 space-y-3 shadow-xs">
				<h3 className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
					Account Metadata & Specifications
				</h3>
				<div className="divide-y divide-border/20 text-xs">
					<div className="flex items-center justify-between py-2">
						<span className="text-muted-foreground">Banking Institution</span>
						<span className="font-medium text-foreground text-right">{saving.bankName}</span>
					</div>
					<div className="flex items-center justify-between py-2">
						<span className="text-muted-foreground">Classification</span>
						<span className="font-medium text-foreground text-right">{categoryLabel}</span>
					</div>
					<div className="flex items-center justify-between py-2">
						<span className="text-muted-foreground">Ownership</span>
						<span className="font-medium text-foreground capitalize text-right">
							{saving.ownership}
						</span>
					</div>
					<div className="flex items-center justify-between py-2">
						<span className="text-muted-foreground">Account Identifier</span>
						<span className="font-mono font-medium text-foreground text-right">
							{saving.accountNumber}
						</span>
					</div>
					<div className="flex items-center justify-between py-2">
						<span className="text-muted-foreground">Base Currency</span>
						<span className="font-mono font-medium text-foreground text-right">
							{saving.currency}
						</span>
					</div>
					<div className="flex items-center justify-between py-2">
						<span className="text-muted-foreground">Yield Frequency</span>
						<span className="font-medium text-foreground text-right">
							{hasPositiveRate ? "Annual Simple APY" : "Standard Cash"}
						</span>
					</div>
				</div>
			</div>

			{/* Transaction Activity Ledger */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h3 className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
							Transaction Activity
						</h3>
						<span className="text-micro font-mono text-muted-foreground">
							({mergedTransactions.length})
						</span>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowRecordMovementDialog(true)}
						className="h-7 text-xs gap-1.5 border-border/50 text-foreground hover:text-primary touch-target"
					>
						<Plus className="h-3 w-3" />
						<span>Record Movement</span>
					</Button>
				</div>

				<div className="rounded-xl border border-border/40 bg-card overflow-hidden shadow-xs">
					{mergedTransactions.length === 0 ? (
						<div className="p-8 flex flex-col items-center justify-center text-center space-y-2">
							<Coins className="h-7 w-7 text-muted-foreground/35" />
							<p className="text-xs font-medium text-foreground">No movements recorded yet</p>
							<p className="text-micro text-muted-foreground max-w-[280px]">
								Use the &quot;Record Movement&quot; button above to log deposits, withdrawals, or
								interest distributions.
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow className="border-border/30 hover:bg-transparent text-micro uppercase tracking-wider text-muted-foreground">
									<TableHead className="w-[100px] text-micro">Date</TableHead>
									<TableHead className="text-micro">Merchant & Description</TableHead>
									<TableHead className="w-[120px] text-micro">Category</TableHead>
									<TableHead className="text-right text-micro">Amount</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{mergedTransactions.map((tx) => {
									const isPositive = tx.cleaned?.isPositive ?? false;
									const formattedDate = new Date(tx.date).toLocaleDateString(undefined, {
										year: "numeric",
										month: "short",
										day: "numeric",
									});

									return (
										<TableRow key={tx.id} className="border-border/20 text-xs">
											<TableCell className="font-mono text-muted-foreground text-xs whitespace-nowrap">
												{formattedDate}
											</TableCell>
											<TableCell className="py-2.5">
												<div className="min-w-0">
													<p className="font-semibold text-xs text-foreground truncate max-w-[180px] sm:max-w-[280px]">
														{tx.cleaned?.merchant || tx.notes || "Transaction"}
													</p>
													{tx.notes && (
														<p
															className="font-mono text-micro text-muted-foreground truncate max-w-[220px] sm:max-w-[320px] mt-0.5"
															title={tx.notes}
														>
															{tx.notes}
														</p>
													)}
												</div>
											</TableCell>
											<TableCell>
												{tx.cleaned?.category ? (
													<span
														className={cn(
															"text-micro px-1.5 py-0.5 rounded border font-medium whitespace-nowrap",
															tx.cleaned.category.badgeClass,
														)}
													>
														{tx.cleaned.category.label}
													</span>
												) : (
													<Badge variant="outline" className="text-micro capitalize px-1.5 py-0">
														{tx.type}
													</Badge>
												)}
											</TableCell>
											<TableCell
												className={cn(
													"text-right font-mono font-semibold text-xs whitespace-nowrap",
													isPositive ? "text-gain" : "text-foreground",
												)}
											>
												{isPositive ? "+" : "-"}
												{formatCurrencyWithCode(tx.total, saving.currency)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</div>
			</div>

			{/* Edit Dialog */}
			<EditSavingDialog
				open={showEditDialog}
				onOpenChange={setShowEditDialog}
				saving={{
					id: saving.id,
					accountName: saving.accountName,
					bankName: saving.bankName,
					accountNumber: saving.accountNumber,
					currency: saving.currency,
					interestRate: saving.interestRate,
					balance: saving.balance,
					accountType: saving.accountType,
				}}
				onSuccess={refetch}
			/>

			{/* Record Movement Dialog */}
			<RecordSavingMovementDialog
				open={showRecordMovementDialog}
				onOpenChange={setShowRecordMovementDialog}
				savingId={saving.id}
				accountName={saving.accountName}
				currency={saving.currency}
				onSuccess={refetch}
			/>

			{/* Delete Dialog */}
			<DeleteSavingDialog
				open={showDeleteDialog}
				onOpenChange={setShowDeleteDialog}
				savingId={saving.id}
				accountName={saving.accountName}
				onSuccess={() => {
					onBack();
					refetch();
				}}
			/>
		</div>
	);
}

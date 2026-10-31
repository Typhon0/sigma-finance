import { useMutation, useQuery } from "@apollo/client";
import {
	AlertCircle,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Copy,
	Eye,
	EyeOff,
	ExternalLink,
	Loader2,
	RefreshCw,
	ShieldAlert,
	Trash2,
	Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	REMOVE_WALLET_ACCOUNT,
	TOGGLE_SPAM_TOKEN,
	TRIGGER_WALLET_SYNC,
} from "@/graphql/mutations/wallets";
import { GET_WALLET_ACCOUNTS } from "@/graphql/queries/wallets";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";

interface WalletBalanceItem {
	id: string;
	symbol: string;
	name?: string | null;
	decimals: number;
	formattedQuantity: number;
	rawBalance: string;
	tokenAddress?: string | null;
	isSpam: boolean;
	isHidden: boolean;
	isStale: boolean;
}

interface WalletAccountItem {
	id: string;
	portfolioId?: string | null;
	network: string;
	addressOrXpub: string;
	isXpub: boolean;
	label?: string | null;
	isActive: boolean;
	lastSyncAt?: string | null;
	historyStatus: string;
	lastSyncError?: string | null;
	balances: WalletBalanceItem[];
}

interface WalletListCardProps {
	portfolioId?: string;
	onAddWallet?: () => void;
}

export function WalletListCard({ portfolioId, onAddWallet }: WalletListCardProps) {
	const { data, loading, error, refetch } = useQuery(GET_WALLET_ACCOUNTS, {
		variables: { portfolioId },
		fetchPolicy: "cache-and-network",
		pollInterval: 15000, // Poll every 15s to update ongoing sync status
	});

	const [triggerSync, { loading: syncing }] = useMutation(TRIGGER_WALLET_SYNC, {
		onCompleted: () => {
			toast.info("Blockchain sync requested. Updating holdings in background...");
			refetch();
		},
		onError: (err) => {
			toast.error(`Sync error: ${err.message}`);
		},
	});

	const [removeWallet, { loading: removing }] = useMutation(REMOVE_WALLET_ACCOUNT, {
		refetchQueries: ["GetWalletAccounts", "GetAccounts", "GetPortfolio"],
		onCompleted: () => {
			toast.success("Wallet disconnected");
		},
		onError: (err) => {
			toast.error(`Failed to remove wallet: ${err.message}`);
		},
	});

	const [toggleSpam] = useMutation(TOGGLE_SPAM_TOKEN, {
		onCompleted: () => {
			refetch();
		},
	});

	const [expandedSpam, setExpandedSpam] = useState<Record<string, boolean>>({});

	const toggleSpamShelf = (accId: string) => {
		setExpandedSpam((prev) => ({ ...prev, [accId]: !prev[accId] }));
	};

	const copyToClipboard = (text: string, label: string) => {
		navigator.clipboard.writeText(text);
		toast.success(`Copied ${label} to clipboard`);
	};

	const truncate = (s: string) => {
		if (s.length <= 16) return s;
		return `${s.slice(0, 8)}...${s.slice(-6)}`;
	};

	const accounts: WalletAccountItem[] = data?.walletAccounts || [];

	if (loading && !data) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Wallet className="h-4 w-4" /> Connected Crypto Wallets
					</CardTitle>
				</CardHeader>
				<CardContent className="flex justify-center py-8">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card className="border-destructive/30">
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2 text-destructive">
						<AlertCircle className="h-4 w-4" /> Crypto Wallets Sync Error
					</CardTitle>
					<CardDescription>{error.message}</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<div>
					<CardTitle className="text-base flex items-center gap-2">
						<Wallet className="h-4 w-4 text-primary" /> Connected On-Chain Wallets
					</CardTitle>
					<CardDescription>
						Zero-cost Alchemy integration covering EVM, Solana, and Bitcoin addresses with Trust Wallet spam filtering.
					</CardDescription>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
						<RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
					</Button>
					{onAddWallet && (
						<Button size="sm" onClick={onAddWallet}>
							Add Wallet
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{accounts.length === 0 ? (
					<div className="text-center py-8 border border-dashed rounded-lg space-y-3">
						<Wallet className="h-8 w-8 mx-auto text-muted-foreground opacity-60" />
						<p className="text-sm text-muted-foreground">No blockchain addresses connected yet.</p>
						{onAddWallet && (
							<Button variant="outline" size="sm" onClick={onAddWallet}>
								Connect Public Address or xpub
							</Button>
						)}
					</div>
				) : (
					accounts.map((acc) => {
						const visibleBalances = acc.balances.filter((b) => !b.isHidden && !b.isSpam);
						const spamBalances = acc.balances.filter((b) => b.isHidden || b.isSpam);
						const isSpamOpen = expandedSpam[acc.id] ?? false;

						return (
							<div key={acc.id} className="border rounded-lg p-4 space-y-4 bg-card/60">
								{/* Header */}
								<div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="font-semibold text-xs uppercase tracking-wider">
											{acc.network}
										</Badge>
										<span className="font-medium text-sm text-foreground">
											{acc.label || `${acc.network} Wallet`}
										</span>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<div className="flex items-center gap-1 font-mono text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded cursor-pointer hover:bg-muted" onClick={() => copyToClipboard(acc.addressOrXpub, "address")}>
														<span>{truncate(acc.addressOrXpub)}</span>
														<Copy className="h-3 w-3 inline text-muted-foreground" />
													</div>
												</TooltipTrigger>
												<TooltipContent>
													<p className="font-mono text-xs">{acc.addressOrXpub}</p>
													<p className="text-[10px] text-muted-foreground">Click to copy</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
										{acc.isXpub && (
											<Badge variant="secondary" className="text-[10px]">
												xpub
											</Badge>
										)}
									</div>

									<div className="flex items-center gap-2">
										{/* Status badge */}
										{acc.historyStatus === "SYNCED" && (
											<Badge variant="outline" className="border-green-500/40 text-green-600 bg-green-500/10 text-xs flex items-center gap-1">
												<CheckCircle className="h-3 w-3" /> Synced
											</Badge>
										)}
										{acc.historyStatus === "IN_PROGRESS" && (
											<Badge variant="outline" className="border-blue-500/40 text-blue-600 bg-blue-500/10 text-xs flex items-center gap-1 animate-pulse">
												<Loader2 className="h-3 w-3 animate-spin" /> Syncing...
											</Badge>
										)}
										{acc.historyStatus === "PENDING" && (
											<Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-xs">
												Pending Initial Sync
											</Badge>
										)}
										{acc.historyStatus === "ERROR" && (
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Badge variant="destructive" className="text-xs flex items-center gap-1 cursor-help">
															<AlertCircle className="h-3 w-3" /> Sync Failed
														</Badge>
													</TooltipTrigger>
													<TooltipContent>
														<p className="text-xs">{acc.lastSyncError || "Unknown sync error"}</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										)}

										<Button
											variant="ghost"
											size="sm"
											className="h-7 text-xs"
											onClick={() => triggerSync({ variables: { id: acc.id } })}
											disabled={syncing || acc.historyStatus === "IN_PROGRESS"}
										>
											<RefreshCw className="h-3 w-3 mr-1" /> Sync Now
										</Button>

										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
											onClick={() => removeWallet({ variables: { id: acc.id } })}
											disabled={removing}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>

								{/* Token Holdings Table */}
								{visibleBalances.length > 0 ? (
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow className="text-xs hover:bg-transparent">
													<TableHead className="w-[180px]">Asset</TableHead>
													<TableHead className="text-right">Balance</TableHead>
													<TableHead className="text-right">Contract</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{visibleBalances.map((b) => (
													<TableRow key={b.id} className="text-xs">
														<TableCell className="font-medium">
															<div className="flex items-center gap-1.5">
																<span className="font-semibold text-foreground">{b.symbol}</span>
																{b.name && <span className="text-muted-foreground truncate max-w-[140px]">({b.name})</span>}
															</div>
														</TableCell>
														<TableCell className="text-right font-mono font-medium">
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<span className="cursor-help">
																			{b.formattedQuantity.toLocaleString(undefined, {
																				minimumFractionDigits: 2,
																				maximumFractionDigits: 6,
																			})}
																		</span>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p className="font-mono text-xs">Raw: {b.rawBalance}</p>
																		<p className="text-[10px] text-muted-foreground">Decimals: {b.decimals}</p>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														</TableCell>
														<TableCell className="text-right text-muted-foreground font-mono">
															{b.tokenAddress ? (
																<TooltipProvider>
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<span
																				className="cursor-pointer hover:underline"
																				onClick={() => copyToClipboard(b.tokenAddress!, "contract address")}
																			>
																				{truncate(b.tokenAddress)}
																			</span>
																		</TooltipTrigger>
																		<TooltipContent>
																			<p className="font-mono text-xs">{b.tokenAddress}</p>
																		</TooltipContent>
																	</Tooltip>
																</TooltipProvider>
															) : (
																<span className="text-[10px] italic">Native Coin</span>
															)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								) : (
									<p className="text-xs text-muted-foreground italic py-2">
										No verified token holdings found on-chain for this address.
									</p>
								)}

								{/* Spam / Unverified Collapsible Shelf */}
								{spamBalances.length > 0 && (
									<Collapsible open={isSpamOpen} onOpenChange={() => toggleSpamShelf(acc.id)} className="border-t pt-2">
										<div className="flex items-center justify-between text-xs text-muted-foreground">
											<div className="flex items-center gap-1.5">
												<ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
												<span>{spamBalances.length} unverified / suspected spam tokens hidden</span>
											</div>
											<CollapsibleTrigger asChild>
												<Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
													{isSpamOpen ? (
														<>
															Hide <ChevronUp className="h-3 w-3" />
														</>
													) : (
														<>
															View <ChevronDown className="h-3 w-3" />
														</>
													)}
												</Button>
											</CollapsibleTrigger>
										</div>

										<CollapsibleContent className="pt-2">
											<div className="bg-muted/30 rounded border p-2 space-y-1.5 text-xs">
												{spamBalances.map((sb) => (
													<div key={sb.id} className="flex items-center justify-between text-muted-foreground hover:bg-muted/50 p-1.5 rounded">
														<div className="flex items-center gap-2">
															<span className="font-mono text-foreground font-medium">{sb.symbol}</span>
															{sb.name && <span className="truncate max-w-[120px] text-[11px]">({sb.name})</span>}
															<span className="font-mono text-[11px] text-muted-foreground">
																{sb.formattedQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
															</span>
														</div>
														<Button
															variant="ghost"
															size="sm"
															className="h-6 text-[10px] gap-1"
															onClick={() => toggleSpam({ variables: { balanceId: sb.id, isHidden: !sb.isHidden } })}
														>
															{sb.isHidden ? (
																<>
																	<Eye className="h-3 w-3 mr-1" /> Unhide
																</>
															) : (
																<>
																	<EyeOff className="h-3 w-3 mr-1" /> Hide
																</>
															)}
														</Button>
													</div>
												))}
											</div>
										</CollapsibleContent>
									</Collapsible>
								)}
							</div>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}

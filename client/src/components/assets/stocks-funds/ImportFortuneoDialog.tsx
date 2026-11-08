import { useMutation, useQuery } from "@apollo/client";
import {
	AlertCircle,
	Check,
	Coins,
	FileText,
	Loader2,
	Plus,
	Trash2,
	Upload,
	Wallet,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CREATE_ACCOUNT } from "@/graphql/mutations/accounts";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import {
	type ParsedFortuneoPosition,
	parseFortuneoClipboard,
	parseFortuneoCSV,
	parseFortuneoPortfolio,
} from "@/lib/parsers/fortuneo-portfolio-parser";
import { cn, formatCurrency } from "@/lib/utils";

interface ImportFortuneoDialogProps {
	open: boolean;
	onClose: () => void;
	onSuccess?: () => void;
}

export function ImportFortuneoDialog({ open, onClose, onSuccess }: ImportFortuneoDialogProps) {
	const { addAsset, currentPortfolio, refetch } = usePortfolio();

	const [activeTab, setActiveTab] = useState<"csv" | "paste">("csv");
	const [pastedText, setPastedText] = useState("");
	const [fileName, setFileName] = useState<string | null>(null);
	const [parsedPositions, setParsedPositions] = useState<ParsedFortuneoPosition[]>([]);
	const [cashPocketAmount, setCashPocketAmount] = useState<string>("");
	const [selectedAccountId, setSelectedAccountId] = useState<string>("");
	const [isImporting, setIsImporting] = useState(false);

	// Fetch user accounts to bind with PEA
	const { data: accountsData, refetch: refetchAccounts } = useQuery(GET_ACCOUNTS, {
		fetchPolicy: "cache-and-network",
	});

	const [createAccountMutation] = useMutation(CREATE_ACCOUNT);

	const accounts = useMemo(() => {
		return accountsData?.accounts || [];
	}, [accountsData]);

	// Automatically pick or suggest the Fortuneo PEA account
	const peaAccounts = useMemo(() => {
		return accounts.filter(
			(a: any) =>
				a.taxWrapper === "PEA" ||
				a.name?.toLowerCase().includes("pea") ||
				a.name?.toLowerCase().includes("fortuneo"),
		);
	}, [accounts]);

	// Auto-select initial account if none selected
	useMemo(() => {
		if (!selectedAccountId && peaAccounts.length > 0) {
			setSelectedAccountId(peaAccounts[0].id);
		}
	}, [peaAccounts, selectedAccountId]);

	const handleFileSelect = (file: File) => {
		setFileName(file.name);
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			if (text) {
				const result = parseFortuneoCSV(text);
				setParsedPositions(result.positions);
				if (typeof result.cashBalance === "number" && result.cashBalance > 0) {
					setCashPocketAmount(result.cashBalance.toFixed(2));
				}
				toast.info(`${result.positions.length} position(s) détectée(s) dans le fichier.`);
			}
		};
		reader.readAsText(file);
	};

	const handlePasteChange = (text: string) => {
		setPastedText(text);
		if (!text.trim()) {
			setParsedPositions([]);
			return;
		}
		const result = parseFortuneoClipboard(text);
		setParsedPositions(result.positions);
		if (typeof result.cashBalance === "number" && result.cashBalance > 0) {
			setCashPocketAmount(result.cashBalance.toFixed(2));
		}
	};

	const handleRemovePosition = (index: number) => {
		setParsedPositions((prev) => prev.filter((_, i) => i !== index));
	};

	const totalValuation = useMemo(() => {
		return parsedPositions.reduce((sum, p) => sum + p.valuation, 0);
	}, [parsedPositions]);

	const handleExecuteImport = async () => {
		if (parsedPositions.length === 0 && !cashPocketAmount) {
			toast.error("Aucune position ni montant d'espèces à importer.");
			return;
		}

		setIsImporting(true);
		let targetAccountId = selectedAccountId;

		try {
			// Auto-create "Fortuneo PEA" account if user has none and didn't select one
			if (!targetAccountId || targetAccountId === "__create_new__") {
				const created = await createAccountMutation({
					variables: {
						input: {
							portfolioId: currentPortfolio,
							name: "Fortuneo PEA",
							type: "BROKER",
							taxWrapper: "PEA",
							institution: "Fortuneo",
							currency: "EUR",
							accountNumber: "****PEA",
						},
					},
				});
				targetAccountId = created.data?.createAccount?.id;
				await refetchAccounts();
			}

			// 1. Import all detected stock/ETF positions
			let successCount = 0;
			for (const pos of parsedPositions) {
				await addAsset({
					name: pos.name,
					symbol: pos.symbol,
					type: "stock",
					quantity: pos.quantity,
					purchasePrice: pos.purchasePrice,
					currentPrice: pos.currentPrice,
					account: targetAccountId,
					quoteCurrency: "EUR",
					unitPriceCurrency: "EUR",
				});
				successCount++;
			}

			// 2. Import or record Cash Pocket if specified
			const cashVal = parseFloat(cashPocketAmount.replace(",", "."));
			if (!isNaN(cashVal) && cashVal > 0) {
				await addAsset({
					name: "Liquidités PEA",
					symbol: "EUR",
					type: "stock",
					quantity: cashVal,
					purchasePrice: 1,
					currentPrice: 1,
					account: targetAccountId,
					quoteCurrency: "EUR",
					unitPriceCurrency: "EUR",
				});
			}

			toast.success(`Importation réussie : ${successCount} position(s) ajoutée(s) à votre PEA !`);

			await refetch?.();
			onSuccess?.();
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Erreur lors de l'importation";
			toast.error(`Échec de l'import : ${msg}`);
		} finally {
			setIsImporting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-6 gap-5 bg-card text-foreground">
				<DialogHeader className="space-y-1.5">
					<div className="flex items-center gap-2">
						<div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs select-none">
							FT
						</div>
						<DialogTitle className="text-lg font-bold tracking-tight">
							Importer mon Portefeuille Fortuneo PEA
						</DialogTitle>
					</div>
					<DialogDescription className="text-xs text-muted-foreground">
						Importez vos positions et liquidités Fortuneo en 1 clic sans risque de panne de scraper.
						Les cotations sont ensuite actualisées automatiquement chaque jour.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 flex-1 overflow-y-auto pr-1">
					{/* Account Selection */}
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold text-foreground">
							Compte PEA de destination
						</Label>
						<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
							<SelectTrigger className="h-9 text-xs bg-muted/30 border-border/50">
								<SelectValue placeholder="Sélectionner ou créer un compte PEA..." />
							</SelectTrigger>
							<SelectContent>
								{peaAccounts.map((acc: any) => (
									<SelectItem key={acc.id} value={acc.id} className="text-xs">
										{acc.name} ({acc.institution || "PEA"})
									</SelectItem>
								))}
								<SelectItem value="__create_new__" className="text-xs font-semibold text-primary">
									+ Créer automatiquement &quot;Fortuneo PEA&quot;
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Dual Import Tabs */}
					<Tabs
						value={activeTab}
						onValueChange={(val) => setActiveTab(val as "csv" | "paste")}
						className="w-full"
					>
						<TabsList className="grid grid-cols-2 h-9 p-1 bg-muted/40 border border-border/40">
							<TabsTrigger value="csv" className="text-xs font-medium">
								<Upload className="h-3.5 w-3.5 mr-1.5" />
								Fichier CSV Fortuneo
							</TabsTrigger>
							<TabsTrigger value="paste" className="text-xs font-medium">
								<FileText className="h-3.5 w-3.5 mr-1.5" />
								Copier-Coller le tableau
							</TabsTrigger>
						</TabsList>

						<TabsContent value="csv" className="pt-3">
							<div
								onDragOver={(e) => e.preventDefault()}
								onDrop={(e) => {
									e.preventDefault();
									if (e.dataTransfer.files?.[0]) {
										handleFileSelect(e.dataTransfer.files[0]);
									}
								}}
								className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/60 hover:border-primary/50 rounded-xl bg-muted/10 transition-colors text-center cursor-pointer relative"
							>
								<input
									type="file"
									accept=".csv,.txt"
									onChange={(e) => {
										if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
									}}
									className="absolute inset-0 opacity-0 cursor-pointer"
									aria-label="Upload Fortuneo CSV"
								/>
								<Upload className="h-8 w-8 text-muted-foreground/60 mb-2" />
								<p className="text-xs font-semibold text-foreground">
									{fileName ? fileName : "Glissez-déposez votre export CSV Fortuneo ici"}
								</p>
								<p className="text-micro text-muted-foreground mt-1">
									Ou cliquez pour parcourir vos fichiers (téléchargeable depuis Fortuneo &gt;
									Portefeuille &gt; Télécharger CSV).
								</p>
							</div>
						</TabsContent>

						<TabsContent value="paste" className="pt-3 space-y-2">
							<Textarea
								placeholder="Sélectionnez et collez les lignes de votre tableau Fortuneo ici... (ex: AMUNDI MSCI WORLD   FR0010756098   50   520,35 €   460,00 €)"
								value={pastedText}
								onChange={(e) => handlePasteChange(e.target.value)}
								className="min-h-[110px] text-xs font-mono bg-muted/20 border-border/50 resize-y"
							/>
							<p className="text-micro text-muted-foreground">
								Copiez simplement votre tableau sur Fortuneo (Ctrl+A / Ctrl+C) et collez-le ici. Les
								ISINs, quantités et PRU sont automatiquement extraits.
							</p>
						</TabsContent>
					</Tabs>

					{/* Cash Pocket Input */}
					<div className="p-3.5 rounded-xl border border-border/40 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div className="space-y-0.5">
							<div className="flex items-center gap-1.5">
								<Coins className="h-4 w-4 text-primary" />
								<span className="text-xs font-semibold text-foreground">
									Solde Espèces / Liquidités du PEA
								</span>
							</div>
							<p className="text-micro text-muted-foreground">
								Liquidités non investies en attente d&apos;ordre sur votre PEA.
							</p>
						</div>
						<div className="w-full sm:w-44">
							<Input
								type="text"
								placeholder="0.00 €"
								value={cashPocketAmount}
								onChange={(e) => setCashPocketAmount(e.target.value)}
								className="h-8 text-xs font-mono text-right bg-background border-border/60"
							/>
						</div>
					</div>

					{/* Live Positions Preview Table */}
					{parsedPositions.length > 0 && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span className="text-xs font-semibold text-foreground">
										Positions détectées ({parsedPositions.length})
									</span>
									<Badge variant="outline" className="text-micro font-mono">
										Total: {formatCurrency(totalValuation)}
									</Badge>
								</div>
								<span className="text-micro text-muted-foreground">
									Vérifiez avant de confirmer
								</span>
							</div>

							<div className="rounded-xl border border-border/40 overflow-hidden bg-card max-h-[220px] overflow-y-auto">
								<Table>
									<TableHeader>
										<TableRow className="border-border/30 hover:bg-transparent text-micro uppercase tracking-wider text-muted-foreground">
											<TableHead className="text-micro">Instrument</TableHead>
											<TableHead className="text-right text-micro">Quantité</TableHead>
											<TableHead className="text-right text-micro">PRU</TableHead>
											<TableHead className="text-right text-micro">Cours</TableHead>
											<TableHead className="text-right text-micro">Valeur</TableHead>
											<TableHead className="w-9" />
										</TableRow>
									</TableHeader>
									<TableBody>
										{parsedPositions.map((pos, idx) => (
											<TableRow key={pos.isin + idx} className="border-border/20 text-xs">
												<TableCell className="py-2">
													<p className="font-semibold text-xs text-foreground truncate max-w-[170px]">
														{pos.name}
													</p>
													<div className="flex items-center gap-1.5 mt-0.5">
														<span className="font-mono text-micro text-primary font-bold">
															{pos.symbol}
														</span>
														<span className="text-micro text-muted-foreground font-mono">
															{pos.isin}
														</span>
													</div>
												</TableCell>
												<TableCell className="text-right font-mono text-xs py-2">
													{pos.quantity}
												</TableCell>
												<TableCell className="text-right font-mono text-xs py-2">
													{formatCurrency(pos.purchasePrice)}
												</TableCell>
												<TableCell className="text-right font-mono text-xs py-2">
													{formatCurrency(pos.currentPrice)}
												</TableCell>
												<TableCell className="text-right font-mono text-xs font-semibold py-2">
													{formatCurrency(pos.valuation)}
												</TableCell>
												<TableCell className="py-2 text-right">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => handleRemovePosition(idx)}
														className="h-7 w-7 text-muted-foreground hover:text-destructive touch-target"
													>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}
				</div>

				<DialogFooter className="flex items-center justify-between gap-3 pt-2 border-t border-border/30 sm:justify-between">
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						disabled={isImporting}
						className="text-xs h-9 touch-target"
					>
						Annuler
					</Button>

					<Button
						variant="default"
						size="sm"
						onClick={handleExecuteImport}
						disabled={isImporting || (parsedPositions.length === 0 && !cashPocketAmount)}
						className="text-xs h-9 font-semibold gap-1.5 touch-target bg-primary text-primary-foreground hover:bg-primary/95"
					>
						{isImporting ? (
							<>
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								<span>Importation en cours...</span>
							</>
						) : (
							<>
								<Check className="h-3.5 w-3.5" />
								<span>
									Importer{" "}
									{parsedPositions.length > 0 ? `${parsedPositions.length} position(s)` : ""} dans
									mon PEA
								</span>
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

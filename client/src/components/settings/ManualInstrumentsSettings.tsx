"use client";

import { useMutation, useQuery } from "@apollo/client";
import { Archive, EllipsisVertical, RotateCcw, SlidersHorizontal, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
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
import {
	type ArchiveManualInstrumentMutation,
	type ArchiveManualInstrumentMutationVariables,
	InstrumentAssetType,
	type ManualInstrumentsQuery,
	type ManualInstrumentsQueryVariables,
	type RestoreManualInstrumentMutation,
	type RestoreManualInstrumentMutationVariables,
	type UpdateManualInstrumentInput,
	type UpdateManualInstrumentMutation,
	type UpdateManualInstrumentMutationVariables,
} from "@/gql/graphql";
import {
	ARCHIVE_MANUAL_INSTRUMENT,
	RESTORE_MANUAL_INSTRUMENT,
	UPDATE_MANUAL_INSTRUMENT,
} from "@/graphql/mutations/instruments";
import { MANUAL_INSTRUMENTS } from "@/graphql/queries/instruments";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

type ManualInstrumentItem = ManualInstrumentsQuery["manualInstruments"]["items"][number];

interface ManualInstrumentFormState {
	symbol: string;
	name: string;
	exchange: string;
	exchangeCode: string;
	country: string;
	currency: string;
	baseCurrency: string;
	quoteCurrency: string;
	underlyingSymbol: string;
	assetType: InstrumentAssetType;
	summary: string;
	sector: string;
	industryGroup: string;
	industry: string;
	categoryGroup: string;
	category: string;
	family: string;
	website: string;
	marketCap: string;
	state: string;
	city: string;
	zipcode: string;
}

const PAGE_SIZE = 20;

const ASSET_TYPE_OPTIONS: Array<{ label: string; value: InstrumentAssetType }> = [
	{ label: "Stock", value: InstrumentAssetType.Stock },
	{ label: "ETF", value: InstrumentAssetType.Etf },
	{ label: "Fund", value: InstrumentAssetType.Fund },
	{ label: "Crypto", value: InstrumentAssetType.Crypto },
	{ label: "Currency", value: InstrumentAssetType.Currency },
	{ label: "Index", value: InstrumentAssetType.Index },
	{ label: "Money Market", value: InstrumentAssetType.MoneyMarket },
];

function toFormState(item: ManualInstrumentItem): ManualInstrumentFormState {
	return {
		symbol: item.symbol,
		name: item.name,
		exchange: item.exchange,
		exchangeCode: item.exchangeCode ?? "",
		country: item.country ?? "",
		currency: item.currency ?? "",
		baseCurrency: item.baseCurrency ?? "",
		quoteCurrency: item.quoteCurrency ?? "",
		underlyingSymbol: item.underlyingSymbol ?? "",
		assetType: item.assetType,
		summary: item.summary ?? "",
		sector: item.sector ?? "",
		industryGroup: item.industryGroup ?? "",
		industry: item.industry ?? "",
		categoryGroup: item.categoryGroup ?? "",
		category: item.category ?? "",
		family: item.family ?? "",
		website: item.website ?? "",
		marketCap: item.marketCap ?? "",
		state: item.state ?? "",
		city: item.city ?? "",
		zipcode: item.zipcode ?? "",
	};
}

function toUpdateInput(form: ManualInstrumentFormState): UpdateManualInstrumentInput {
	return {
		symbol: form.symbol.trim(),
		name: form.name.trim(),
		exchange: form.exchange.trim(),
		exchangeCode: form.exchangeCode.trim() || null,
		country: form.country.trim() || null,
		currency: form.currency.trim() || null,
		baseCurrency: form.baseCurrency.trim() || null,
		quoteCurrency: form.quoteCurrency.trim() || null,
		underlyingSymbol: form.underlyingSymbol.trim() || null,
		assetType: form.assetType,
		summary: form.summary.trim() || null,
		sector: form.sector.trim() || null,
		industryGroup: form.industryGroup.trim() || null,
		industry: form.industry.trim() || null,
		categoryGroup: form.categoryGroup.trim() || null,
		category: form.category.trim() || null,
		family: form.family.trim() || null,
		website: form.website.trim() || null,
		marketCap: form.marketCap.trim() || null,
		state: form.state.trim() || null,
		city: form.city.trim() || null,
		zipcode: form.zipcode.trim() || null,
	};
}

function statusTone(status: string): "secondary" | "outline" | "default" {
	switch (status.toUpperCase()) {
		case "ACTIVE":
			return "default";
		case "ARCHIVED":
			return "outline";
		default:
			return "secondary";
	}
}

function verificationLabel(item: ManualInstrumentItem): string {
	const confidence = item.syncState?.verificationConfidence ?? 0;
	const syncStatus = item.syncState?.syncStatus ?? item.status;
	if (item.status === "ARCHIVED") {
		return "Archived";
	}
	if (confidence >= 80 || syncStatus === "SYNCED") {
		return "Verified";
	}
	if (confidence > 0) {
		return `Confidence ${confidence}%`;
	}
	return "Unverified";
}

function formatTimestamp(value?: string | null): string {
	if (!value) {
		return "Never";
	}
	return new Date(value).toLocaleString();
}

export function ManualInstrumentsSettings() {
	const [query, setQuery] = useState("");
	const [assetTypeFilter, setAssetTypeFilter] = useState<"all" | InstrumentAssetType>("all");
	const [showArchived, setShowArchived] = useState(false);
	const [page, setPage] = useState(0);
	const [editingItem, setEditingItem] = useState<ManualInstrumentItem | null>(null);
	const [formState, setFormState] = useState<ManualInstrumentFormState | null>(null);

	const debouncedQuery = useDebounce(query.trim(), 250);
	const queryVariables = useMemo<ManualInstrumentsQueryVariables>(
		() => ({
			filter: {
				query: debouncedQuery.length > 0 ? debouncedQuery : undefined,
				assetTypes: assetTypeFilter === "all" ? undefined : [assetTypeFilter],
				includeArchived: showArchived,
			},
			pagination: {
				limit: PAGE_SIZE,
				offset: page * PAGE_SIZE,
			},
		}),
		[assetTypeFilter, debouncedQuery, page, showArchived],
	);

	useEffect(() => {
		setPage(0);
	}, []);

	const { data, loading, error, refetch } = useQuery<
		ManualInstrumentsQuery,
		ManualInstrumentsQueryVariables
	>(MANUAL_INSTRUMENTS, {
		variables: queryVariables,
		fetchPolicy: "cache-and-network",
	});

	const [updateManualInstrument, { loading: saving }] = useMutation<
		UpdateManualInstrumentMutation,
		UpdateManualInstrumentMutationVariables
	>(UPDATE_MANUAL_INSTRUMENT);
	const [archiveManualInstrument, { loading: archiving }] = useMutation<
		ArchiveManualInstrumentMutation,
		ArchiveManualInstrumentMutationVariables
	>(ARCHIVE_MANUAL_INSTRUMENT);
	const [restoreManualInstrument, { loading: restoring }] = useMutation<
		RestoreManualInstrumentMutation,
		RestoreManualInstrumentMutationVariables
	>(RESTORE_MANUAL_INSTRUMENT);

	const items = data?.manualInstruments.items ?? [];
	const hasMore = data?.manualInstruments.hasMore ?? false;

	const openEditDialog = (item: ManualInstrumentItem) => {
		setEditingItem(item);
		setFormState(toFormState(item));
	};

	const closeEditDialog = () => {
		setEditingItem(null);
		setFormState(null);
	};

	const handleSave = async () => {
		if (!editingItem || !formState) {
			return;
		}
		try {
			await updateManualInstrument({
				variables: {
					id: editingItem.id,
					input: toUpdateInput(formState),
				},
			});
			await refetch();
			closeEditDialog();
			toast.success("Manual instrument updated");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update instrument");
		}
	};

	const handleArchiveToggle = async (item: ManualInstrumentItem) => {
		try {
			if (item.status === "ARCHIVED") {
				await restoreManualInstrument({ variables: { id: item.id } });
			} else {
				await archiveManualInstrument({ variables: { id: item.id } });
			}
			await refetch();
			toast.success(item.status === "ARCHIVED" ? "Instrument restored" : "Instrument archived");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update instrument state");
		}
	};

	return (
		<div className="flex flex-col gap-6 w-full">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Tag className="h-5 w-5 text-muted-foreground" />
						<h1 className="text-xl font-semibold tracking-tight text-foreground">
							Instruments Manuels
						</h1>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Gérez et archivez les actions, fonds, ETF et cryptomonnaies créés manuellement.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<SearchInput
						placeholder="Rechercher symbole, nom..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onClear={() => setQuery("")}
						containerClassName="w-48 sm:w-64"
					/>
					<Select
						value={assetTypeFilter}
						onValueChange={(value) => setAssetTypeFilter(value as "all" | InstrumentAssetType)}
					>
						<SelectTrigger className="w-[8.5rem] h-9 text-xs">
							<SelectValue placeholder="Classe d'actif" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Tous les types</SelectItem>
							{ASSET_TYPE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						variant={showArchived ? "secondary" : "outline"}
						size="sm"
						onClick={() => setShowArchived((value) => !value)}
						className="h-9 gap-1.5 text-xs border-border/60"
					>
						<SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
						{showArchived ? "Archivés inclus" : "Masquer archivés"}
					</Button>
				</div>
			</div>

			{error && (
				<div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
					{error.message}
				</div>
			)}

			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className="border-b border-border/40 bg-muted/20 hover:bg-muted/20">
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Symbole
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Nom
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Type
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Place / Exchange
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Statut
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Mis à jour
							</TableHead>
							<TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody className="divide-y divide-border/20">
						{loading && items.length === 0 ? (
							<TableRow>
								<TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
									Chargement des instruments manuels...
								</TableCell>
							</TableRow>
						) : items.length === 0 ? (
							<TableRow>
								<TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
									Aucun instrument manuel trouvé.
								</TableCell>
							</TableRow>
						) : (
							items.map((item) => (
								<TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
									<TableCell className="font-mono font-medium text-xs text-foreground">
										{item.symbol}
									</TableCell>
									<TableCell className="text-xs font-medium">{item.name}</TableCell>
									<TableCell>
										<Badge variant="secondary" className="font-mono text-[11px]">
											{item.assetType}
										</Badge>
									</TableCell>
									<TableCell className="font-mono text-xs text-muted-foreground">
										{item.exchange}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-1.5">
											<Badge
												variant="outline"
												className={cn(
													"text-[11px] font-mono gap-1",
													item.status === "ACTIVE"
														? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
														: "border-border/60 bg-muted/30 text-muted-foreground",
												)}
											>
												<span
													className={cn(
														"h-1.5 w-1.5 rounded-full",
														item.status === "ACTIVE" ? "bg-emerald-500" : "bg-muted-foreground",
													)}
												/>
												{verificationLabel(item)}
											</Badge>
											{item.syncState?.stale ? (
												<Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600 text-[10px]">
													Obsolète
												</Badge>
											) : null}
										</div>
									</TableCell>
									<TableCell className="text-xs text-muted-foreground font-mono">
										{formatTimestamp(item.updatedAt)}
									</TableCell>
									<TableCell className="text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7"
													disabled={saving || archiving || restoring}
												>
													<EllipsisVertical className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onSelect={() => openEditDialog(item)}>
													<Tag className="mr-2 h-4 w-4" />
													Modifier
												</DropdownMenuItem>
												<DropdownMenuItem onSelect={() => handleArchiveToggle(item)}>
													{item.status === "ARCHIVED" ? (
														<>
															<RotateCcw className="mr-2 h-4 w-4" />
															Restaurer
														</>
													) : (
														<>
															<Archive className="mr-2 h-4 w-4" />
															Archiver
														</>
													)}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
				<p>
					<span className="font-mono tabular-nums text-foreground">{items.length}</span> instrument{items.length === 1 ? "" : "s"} sur cette page
				</p>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="h-8 text-xs border-border/60"
						onClick={() => setPage((value) => Math.max(0, value - 1))}
						disabled={page === 0 || loading}
					>
						Précédent
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-8 text-xs border-border/60"
						onClick={() => setPage((value) => value + 1)}
						disabled={!hasMore || loading}
					>
						Suivant
					</Button>
				</div>
			</div>

			<Dialog open={editingItem !== null} onOpenChange={(open) => !open && closeEditDialog()}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>Edit manual instrument</DialogTitle>
						<DialogDescription>
							Update the catalog entry without changing the portfolio positions that already use it.
						</DialogDescription>
					</DialogHeader>
					{formState && editingItem && (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="symbol">Symbol</Label>
								<Input
									id="symbol"
									value={formState.symbol}
									onChange={(event) => setFormState({ ...formState, symbol: event.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									value={formState.name}
									onChange={(event) => setFormState({ ...formState, name: event.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="exchange">Exchange</Label>
								<Input
									id="exchange"
									value={formState.exchange}
									onChange={(event) => setFormState({ ...formState, exchange: event.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="assetType">Asset Type</Label>
								<Select
									value={formState.assetType}
									onValueChange={(value) =>
										setFormState({
											...formState,
											assetType: value as InstrumentAssetType,
										})
									}
								>
									<SelectTrigger id="assetType">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ASSET_TYPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="exchangeCode">Exchange code</Label>
								<Input
									id="exchangeCode"
									value={formState.exchangeCode}
									onChange={(event) =>
										setFormState({
											...formState,
											exchangeCode: event.target.value,
										})
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="currency">Currency</Label>
								<Input
									id="currency"
									value={formState.currency}
									onChange={(event) => setFormState({ ...formState, currency: event.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="baseCurrency">Base currency</Label>
								<Input
									id="baseCurrency"
									value={formState.baseCurrency}
									onChange={(event) =>
										setFormState({
											...formState,
											baseCurrency: event.target.value,
										})
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="quoteCurrency">Quote currency</Label>
								<Input
									id="quoteCurrency"
									value={formState.quoteCurrency}
									onChange={(event) =>
										setFormState({
											...formState,
											quoteCurrency: event.target.value,
										})
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="underlyingSymbol">Underlying symbol</Label>
								<Input
									id="underlyingSymbol"
									value={formState.underlyingSymbol}
									onChange={(event) =>
										setFormState({
											...formState,
											underlyingSymbol: event.target.value,
										})
									}
								/>
							</div>
							<div className="space-y-2 md:col-span-2">
								<Label htmlFor="website">Website</Label>
								<Input
									id="website"
									value={formState.website}
									onChange={(event) => setFormState({ ...formState, website: event.target.value })}
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={closeEditDialog}>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={saving}>
							{saving ? "Saving..." : "Save changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

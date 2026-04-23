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
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Manual Instruments</h1>
					<p className="text-sm text-muted-foreground">
						Edit and archive manually added stocks, funds, ETFs, and crypto entries.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<SearchInput
						placeholder="Search instruments..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onClear={() => setQuery("")}
						containerClassName="flex-1"
					/>
					<Select
						value={assetTypeFilter}
						onValueChange={(value) => setAssetTypeFilter(value as "all" | InstrumentAssetType)}
					>
						<SelectTrigger className="w-[10rem]">
							<SelectValue placeholder="Asset type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All types</SelectItem>
							{ASSET_TYPE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						variant={showArchived ? "default" : "outline"}
						onClick={() => setShowArchived((value) => !value)}
						className="gap-2"
					>
						<SlidersHorizontal className="h-4 w-4" />
						{showArchived ? "Showing archived" : "Show archived"}
					</Button>
				</div>
			</div>

			{error && (
				<div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
					{error.message}
				</div>
			)}

			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Symbol</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Exchange</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Updated</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading && items.length === 0 ? (
							<TableRow>
								<TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
									Loading manual instruments...
								</TableCell>
							</TableRow>
						) : items.length === 0 ? (
							<TableRow>
								<TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
									No manual instruments found.
								</TableCell>
							</TableRow>
						) : (
							items.map((item) => (
								<TableRow key={item.id}>
									<TableCell className="font-medium">{item.symbol}</TableCell>
									<TableCell>{item.name}</TableCell>
									<TableCell>
										<Badge variant="secondary">{item.assetType}</Badge>
									</TableCell>
									<TableCell>{item.exchange}</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Badge variant={statusTone(item.status)}>{verificationLabel(item)}</Badge>
											{item.syncState?.stale ? <Badge variant="outline">Stale</Badge> : null}
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground">
										{formatTimestamp(item.updatedAt)}
									</TableCell>
									<TableCell className="text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													disabled={saving || archiving || restoring}
												>
													<EllipsisVertical className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onSelect={() => openEditDialog(item)}>
													<Tag className="mr-2 h-4 w-4" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem onSelect={() => handleArchiveToggle(item)}>
													{item.status === "ARCHIVED" ? (
														<>
															<RotateCcw className="mr-2 h-4 w-4" />
															Restore
														</>
													) : (
														<>
															<Archive className="mr-2 h-4 w-4" />
															Archive
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

			<div className="flex items-center justify-between gap-3">
				<p className="text-sm text-muted-foreground">
					{items.length} item{items.length === 1 ? "" : "s"} on this page
				</p>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={() => setPage((value) => Math.max(0, value - 1))}
						disabled={page === 0 || loading}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						onClick={() => setPage((value) => value + 1)}
						disabled={!hasMore || loading}
					>
						Next
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

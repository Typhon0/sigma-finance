"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/ui/search-input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { type AssetSyncType, useFinanceDatabasePreview } from "@/hooks/use-sync-management";

interface Asset {
	symbol: string;
	name: string;
	exchange: string;
	sector: string | null;
	country: string | null;
}

interface DataPreviewTableProps {
	assetType: string;
	isOpen: boolean;
	onClose: () => void;
	onImport: (selectedSymbols: string[]) => void;
}

const ITEMS_PER_PAGE = 20;

const toAssetSyncType = (assetType: string): AssetSyncType =>
	assetType.toUpperCase() as AssetSyncType;

export function DataPreviewTable({ assetType, isOpen, onClose, onImport }: DataPreviewTableProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
	const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
	const [currentPage, setCurrentPage] = useState(1);

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			setDebouncedSearchQuery(searchQuery.trim());
			setCurrentPage(1);
		}, 250);
		return () => window.clearTimeout(timeout);
	}, [searchQuery]);

	const previewAssetType = useMemo(() => toAssetSyncType(assetType), [assetType]);

	const { preview, loading, error } = useFinanceDatabasePreview(
		previewAssetType,
		debouncedSearchQuery || undefined,
		200,
		undefined,
		isOpen,
	);

	const assets = useMemo<Asset[]>(
		() =>
			preview.map(
				(item) =>
					({
						id: item.symbol,
						symbol: item.symbol,
						name: item.name,
						exchange: item.exchange ?? undefined,
						sector: item.sector ?? undefined,
						country: item.country ?? undefined,
						type: "STOCK",
					}) as Asset,
			),
		[preview],
	);

	const totalPages = Math.max(1, Math.ceil(assets.length / ITEMS_PER_PAGE));
	const paginatedAssets = assets.slice(
		(currentPage - 1) * ITEMS_PER_PAGE,
		currentPage * ITEMS_PER_PAGE,
	);

	const handleSelectAll = (checked: boolean) => {
		if (checked) {
			const allSymbols = new Set(paginatedAssets.map((a) => a.symbol));
			setSelectedSymbols((prev) => new Set([...prev, ...allSymbols]));
			return;
		}

		const pageSymbols = new Set(paginatedAssets.map((a) => a.symbol));
		setSelectedSymbols((prev) => {
			const next = new Set(prev);
			pageSymbols.forEach((symbol) => {
				next.delete(symbol);
			});
			return next;
		});
	};

	const handleSelectOne = (symbol: string, checked: boolean) => {
		setSelectedSymbols((prev) => {
			const next = new Set(prev);
			if (checked) {
				next.add(symbol);
			} else {
				next.delete(symbol);
			}
			return next;
		});
	};

	const handleImport = () => {
		onImport(Array.from(selectedSymbols));
		setSelectedSymbols(new Set());
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
			<div className="fixed left-1/2 top-1/2 flex max-h-[90vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-card shadow-lg">
				<div className="flex items-center justify-between border-b p-4">
					<div>
						<h2 className="text-lg font-semibold">Preview {assetType} Data</h2>
						<p className="text-sm text-muted-foreground">
							Select rows to import or refresh in the catalog
						</p>
					</div>
					<Button variant="ghost" size="icon" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="border-b p-4">
					<SearchInput
						placeholder="Search..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onClear={() => setSearchQuery("")}
					/>
				</div>

				<div className="flex-1 overflow-auto p-4">
					{error ? (
						<div className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">
							{error.message}
						</div>
					) : loading && assets.length === 0 ? (
						<div className="py-8 text-center text-sm text-muted-foreground">
							Loading preview data...
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-12">
										<Checkbox
											checked={
												paginatedAssets.length > 0 &&
												paginatedAssets.every((asset) => selectedSymbols.has(asset.symbol))
											}
											onCheckedChange={handleSelectAll}
										/>
									</TableHead>
									<TableHead>Symbol</TableHead>
									<TableHead>Name</TableHead>
									<TableHead>Exchange</TableHead>
									<TableHead>Sector</TableHead>
									<TableHead>Country</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{paginatedAssets.map((asset) => (
									<TableRow key={asset.symbol}>
										<TableCell>
											<Checkbox
												checked={selectedSymbols.has(asset.symbol)}
												onCheckedChange={(checked) =>
													handleSelectOne(asset.symbol, checked as boolean)
												}
											/>
										</TableCell>
										<TableCell className="font-mono font-medium">{asset.symbol}</TableCell>
										<TableCell className="max-w-[200px] truncate">{asset.name}</TableCell>
										<TableCell>{asset.exchange}</TableCell>
										<TableCell>{asset.sector ?? "—"}</TableCell>
										<TableCell>{asset.country ?? "—"}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</div>

				<div className="flex items-center justify-between border-t p-4">
					<div className="text-sm text-muted-foreground">
						{selectedSymbols.size} of {assets.length} assets selected
					</div>
					<div className="flex items-center gap-2">
						{totalPages > 1 && (
							<div className="mr-4 flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
									disabled={currentPage === 1}
								>
									Previous
								</Button>
								<span className="text-sm text-muted-foreground">
									Page {currentPage} of {totalPages}
								</span>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
									disabled={currentPage === totalPages}
								>
									Next
								</Button>
							</div>
						)}
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={handleImport} disabled={selectedSymbols.size === 0}>
							Import Selected ({selectedSymbols.size})
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

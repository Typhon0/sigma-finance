import { zodResolver } from "@hookform/resolvers/zod";
import { DollarSign, Hash, Loader2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Badge } from "@/components/ui/badge";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	useAssetManagement,
	useAssets,
	useAssetTypes,
} from "@/hooks/use-asset-management";

const addAssetFormSchema = z.object({
	assetID: z.string().min(1, "Please select an asset"),
	quantity: z.number().min(0.000001, "Quantity must be greater than 0"),
	averagePurchasePrice: z
		.number()
		.min(0, "Purchase price must be greater than or equal to 0")
		.optional(),
});

type AddAssetFormData = z.infer<typeof addAssetFormSchema>;

interface AddAssetDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioID: string;
	portfolioName: string;
	onSuccess?: () => void;
	trigger?: React.ReactNode;
}

export function AddAssetDialog({
	open,
	onOpenChange,
	portfolioID,
	portfolioName,
	onSuccess,
	trigger,
}: AddAssetDialogProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedAssetTypeID, setSelectedAssetTypeID] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const { assetTypes, loading: assetTypesLoading } = useAssetTypes();
	const { assets, loading: assetsLoading } = useAssets(
		{
			assetTypeID: selectedAssetTypeID || undefined,
			nameContains: searchTerm || undefined,
		},
		{ limit: 50 },
		{ field: "NAME", direction: "ASC" },
	);
	const { addAssetToPortfolio } = useAssetManagement();

	const form = useForm<AddAssetFormData>({
		resolver: zodResolver(addAssetFormSchema),
		defaultValues: {
			assetID: "",
			quantity: 1,
			averagePurchasePrice: undefined,
		},
	});

	const filteredAssets = useMemo(() => {
		let filtered = assets;

		if (searchTerm) {
			filtered = filtered.filter(
				(asset) =>
					asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					asset.symbol?.toLowerCase().includes(searchTerm.toLowerCase()),
			);
		}

		return filtered;
	}, [assets, searchTerm]);

	const selectedAsset = useMemo(() => {
		const assetID = form.watch("assetID");
		return assets.find((asset) => asset.id === assetID);
	}, [assets, form.watch("assetID")]);

	const onSubmit = async (data: AddAssetFormData) => {
		if (!selectedAsset) return;

		setIsSubmitting(true);
		try {
			await addAssetToPortfolio({
				portfolioID,
				assetID: data.assetID,
				quantity: data.quantity,
				averagePurchasePrice: data.averagePurchasePrice,
			});

			form.reset();
			setSearchTerm("");
			setSelectedAssetTypeID("");
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			console.error("Failed to add asset to portfolio:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClose = () => {
		if (!isSubmitting) {
			form.reset();
			setSearchTerm("");
			setSelectedAssetTypeID("");
			onOpenChange(false);
		}
	};

	const estimatedValue = useMemo(() => {
		const quantity = form.watch("quantity");
		const price =
			form.watch("averagePurchasePrice") || selectedAsset?.currentValue;

		if (quantity && price) {
			return quantity * price;
		}
		return null;
	}, [
		form.watch("quantity"),
		form.watch("averagePurchasePrice"),
		selectedAsset?.currentValue,
	]);

	return (
		<ActionDialog
			open={open}
			onOpenChange={handleClose}
			trigger={trigger}
			title={
				<div className="flex items-center gap-2">
					<Plus className="h-5 w-5" />
					Add Asset to {portfolioName}
				</div>
			}
			description="Search and select an asset to add to your portfolio. Specify the quantity and purchase price."
			actionText={
				isSubmitting ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Adding Asset...
					</>
				) : (
					"Add Asset"
				)
			}
			onAction={form.handleSubmit(onSubmit)}
			isActionDisabled={isSubmitting || !selectedAsset}
		>
			<Form {...form}>
				<div className="space-y-6">
					<div className="space-y-2">
						<FormLabel>Filter by Asset Type</FormLabel>
						<Select
							value={selectedAssetTypeID || "all"}
							onValueChange={(value) =>
								setSelectedAssetTypeID(value === "all" ? "" : value)
							}
							disabled={assetTypesLoading}
						>
							<SelectTrigger>
								<SelectValue placeholder="All asset types" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All asset types</SelectItem>
								{assetTypes.map((type) => (
									<SelectItem key={type.id} value={type.id}>
										{type.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<FormLabel>Search Assets</FormLabel>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by name or symbol..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
							/>
						</div>
					</div>

					<FormField
						control={form.control}
						name="assetID"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Select Asset</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Choose an asset" />
										</SelectTrigger>
									</FormControl>
									<SelectContent className="max-h-[200px]">
										{assetsLoading ? (
											<div className="flex items-center justify-center p-4">
												<Loader2 className="h-4 w-4 animate-spin" />
												<span className="ml-2">Loading assets...</span>
											</div>
										) : filteredAssets.length === 0 ? (
											<div className="p-4 text-center text-muted-foreground">
												No assets found
											</div>
										) : (
											filteredAssets.map((asset) => (
												<SelectItem key={asset.id} value={asset.id}>
													<div className="flex items-center justify-between w-full">
														<div className="flex items-center gap-2">
															<span className="font-medium">{asset.name}</span>
															{asset.symbol && (
																<Badge variant="secondary" className="text-xs">
																	{asset.symbol}
																</Badge>
															)}
														</div>
														<div className="flex items-center gap-2 text-sm text-muted-foreground">
															<Badge variant="outline" className="text-xs">
																{asset.assetType.name}
															</Badge>
															{asset.currentValue && (
																<span>${asset.currentValue.toFixed(2)}</span>
															)}
														</div>
													</div>
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
								<FormDescription>
									Select the asset you want to add to your portfolio
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					{selectedAsset && (
						<div className="rounded-lg border p-4 bg-muted/50">
							<h4 className="font-medium mb-2">Selected Asset</h4>
							<div className="space-y-1 text-sm">
								<div className="flex justify-between">
									<span>Name:</span>
									<span className="font-medium">{selectedAsset.name}</span>
								</div>
								{selectedAsset.symbol && (
									<div className="flex justify-between">
										<span>Symbol:</span>
										<Badge variant="secondary">{selectedAsset.symbol}</Badge>
									</div>
								)}
								<div className="flex justify-between">
									<span>Type:</span>
									<Badge variant="outline">
										{selectedAsset.assetType.name}
									</Badge>
								</div>
								{selectedAsset.currentValue && (
									<div className="flex justify-between">
										<span>Current Value:</span>
										<span className="font-medium">
											${selectedAsset.currentValue.toFixed(2)}
										</span>
									</div>
								)}
							</div>
						</div>
					)}

					<FormField
						control={form.control}
						name="quantity"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="flex items-center gap-2">
									<Hash className="h-4 w-4" />
									Quantity
								</FormLabel>
								<FormControl>
									<Input
										type="number"
										step="0.000001"
										min="0.000001"
										placeholder="Enter quantity"
										{...field}
										onChange={(e) =>
											field.onChange(parseFloat(e.target.value) || 0)
										}
									/>
								</FormControl>
								<FormDescription>
									Number of units/shares you own
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="averagePurchasePrice"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="flex items-center gap-2">
									<DollarSign className="h-4 w-4" />
									Average Purchase Price (Optional)
								</FormLabel>
								<FormControl>
									<Input
										type="number"
										step="0.01"
										min="0"
										placeholder="Enter purchase price"
										{...field}
										onChange={(e) =>
											field.onChange(parseFloat(e.target.value) || undefined)
										}
									/>
								</FormControl>
								<FormDescription>
									Average price per unit when you purchased this asset
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					{estimatedValue && (
						<div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20">
							<div className="flex items-center justify-between">
								<span className="font-medium">Estimated Total Value:</span>
								<span className="text-lg font-bold text-green-600 dark:text-green-400">
									${estimatedValue.toFixed(2)}
								</span>
							</div>
						</div>
					)}
				</div>
			</Form>
		</ActionDialog>
	);
}

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	TradeableInstrumentSearch,
	type TradeableInstrumentSelection,
} from "@/components/assets/tradeable-instrument-search";
import { InstrumentAssetType } from "@/gql/graphql";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const stockAssetSchema = z.object({
	name: z.string().min(1, "Asset name is required"),
	ticker: z
		.string()
		.min(1, "Ticker symbol is required")
		.max(10, "Ticker too long"),
	quantity: z.number().min(0.001, "Quantity must be greater than 0"),
	purchasePrice: z
		.number()
		.min(0, "Purchase price must be positive")
		.optional(),
	purchaseDate: z.string().optional(),
});

export type StockAssetFormData = z.infer<typeof stockAssetSchema>;

interface StockAssetFormProps {
	onSubmit: (data: StockAssetFormData) => Promise<void>;
	onCancel: () => void;
	isLoading?: boolean;
	initialData?: Partial<StockAssetFormData>;
}

export function StockAssetForm({
	onSubmit,
	onCancel,
	isLoading,
	initialData,
}: StockAssetFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedInstrument, setSelectedInstrument] =
		useState<TradeableInstrumentSelection | null>(null);
	const instrumentTypes = [
		InstrumentAssetType.Stock,
		InstrumentAssetType.Etf,
		InstrumentAssetType.Fund,
	] as const;

	const form = useForm<StockAssetFormData>({
		resolver: zodResolver(stockAssetSchema),
		defaultValues: {
			name: initialData?.name || "",
			ticker: initialData?.ticker || "",
			quantity: initialData?.quantity || 0,
			purchasePrice: initialData?.purchasePrice || undefined,
			purchaseDate: initialData?.purchaseDate || "",
		},
	});

	const handleSubmit = async (data: StockAssetFormData) => {
		setIsSubmitting(true);
		try {
			await onSubmit(data);
		} catch (error) {
			console.error("Error submitting stock asset:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Building2 className="h-5 w-5 text-green-600" />
					<div>
						<CardTitle className="text-lg">Stock Asset</CardTitle>
						<CardDescription>
							Add publicly traded stocks, ETFs, or mutual funds
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Form {...form}>
			<form
						onSubmit={form.handleSubmit(handleSubmit)}
						className="space-y-4"
					>
						<TradeableInstrumentSearch
							assetTypes={instrumentTypes}
							value={selectedInstrument}
							onChange={(selection) => {
								setSelectedInstrument(selection);
								form.setValue("ticker", selection?.symbol ?? "");
								form.setValue("name", selection?.name ?? "");
							}}
							placeholder="Search stock, ETF, or fund..."
						/>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="ticker"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Ticker Symbol</FormLabel>
										<FormControl>
											<Input
												placeholder="AAPL"
												{...field}
												className="uppercase"
												onChange={(e) =>
													field.onChange(e.target.value.toUpperCase())
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Company Name</FormLabel>
										<FormControl>
											<Input placeholder="Apple Inc." {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="quantity"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Shares</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.001"
												placeholder="100"
												{...field}
												onChange={(e) =>
													field.onChange(parseFloat(e.target.value) || 0)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="purchasePrice"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Purchase Price (per share)</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												placeholder="150.00"
												{...field}
												onChange={(e) =>
													field.onChange(
														parseFloat(e.target.value) || undefined,
													)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="purchaseDate"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Purchase Date (Optional)</FormLabel>
									<FormControl>
										<Input type="date" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex gap-2 pt-4">
							<Button
								type="button"
								variant="outline"
								onClick={onCancel}
								disabled={isSubmitting || isLoading}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={isSubmitting || isLoading}
								className="gap-2"
							>
								<TrendingUp className="h-4 w-4" />
								{isSubmitting ? "Adding..." : "Add Stock"}
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

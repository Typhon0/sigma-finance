import { zodResolver } from "@hookform/resolvers/zod";
import { Coins, Wallet } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	TradeableInstrumentSearch,
	type TradeableInstrumentSelection,
} from "@/components/assets/tradeable-instrument-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
	Form,
	FormControl,
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
import { InstrumentAssetType } from "@/gql/graphql";

const cryptoAssetSchema = z.object({
	instrumentId: z.string().optional(),
	name: z.string().min(1, "Asset name is required"),
	symbol: z.string().min(1, "Symbol is required").max(10, "Symbol too long"),
	quantity: z.number().min(0.00000001, "Quantity must be greater than 0"),
	purchasePrice: z.number().min(0, "Purchase price must be positive").optional(),
	purchaseDate: z.date().optional(),
	walletAddress: z.string().optional(),
	blockchainNetwork: z.string().min(1, "Blockchain network is required"),
});

export type CryptoAssetFormData = z.infer<typeof cryptoAssetSchema>;

interface CryptoAssetFormProps {
	onSubmit: (data: CryptoAssetFormData) => Promise<void>;
	onCancel: () => void;
	isLoading?: boolean;
	initialData?: Partial<CryptoAssetFormData>;
}

const BLOCKCHAIN_NETWORKS = [
	{ value: "BITCOIN", label: "Bitcoin" },
	{ value: "ETHEREUM", label: "Ethereum" },
	{ value: "BINANCE_SMART_CHAIN", label: "Binance Smart Chain" },
	{ value: "POLYGON", label: "Polygon" },
	{ value: "SOLANA", label: "Solana" },
	{ value: "CARDANO", label: "Cardano" },
	{ value: "AVALANCHE", label: "Avalanche" },
	{ value: "OTHER", label: "Other" },
];

export function CryptoAssetForm({
	onSubmit,
	onCancel,
	isLoading,
	initialData,
}: CryptoAssetFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedInstrument, setSelectedInstrument] = useState<TradeableInstrumentSelection | null>(
		null,
	);

	const form = useForm<CryptoAssetFormData>({
		resolver: zodResolver(cryptoAssetSchema),
		defaultValues: {
			instrumentId: initialData?.instrumentId || "",
			name: initialData?.name || "",
			symbol: initialData?.symbol || "",
			quantity: initialData?.quantity || 0,
			purchasePrice: initialData?.purchasePrice || undefined,
			purchaseDate: initialData?.purchaseDate ? new Date(initialData.purchaseDate) : undefined,
			walletAddress: initialData?.walletAddress || "",
			blockchainNetwork: initialData?.blockchainNetwork || "",
		},
	});
	const instrumentTypes = [InstrumentAssetType.Crypto] as const;

	const handleSubmit = async (data: CryptoAssetFormData) => {
		setIsSubmitting(true);
		try {
			await onSubmit(data);
		} catch (_error) {
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Coins className="h-5 w-5 text-amber-600" />
					<div>
						<CardTitle className="text-lg">Cryptocurrency Asset</CardTitle>
						<CardDescription>Add cryptocurrencies and digital assets</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
						<TradeableInstrumentSearch
							assetTypes={instrumentTypes}
							value={selectedInstrument}
							onChange={(selection) => {
								setSelectedInstrument(selection);
								form.setValue("instrumentId", selection?.id ?? "");
								form.setValue("symbol", selection?.symbol ?? "");
								form.setValue("name", selection?.name ?? "");
							}}
							placeholder="Search cryptocurrency..."
						/>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="symbol"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Symbol</FormLabel>
										<FormControl>
											<Input
												placeholder="BTC"
												{...field}
												className="uppercase"
												onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input placeholder="Bitcoin" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="blockchainNetwork"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Blockchain Network</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select blockchain network" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{BLOCKCHAIN_NETWORKS.map((network) => (
												<SelectItem key={network.value} value={network.value}>
													{network.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="quantity"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Quantity</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.00000001"
												placeholder="1.5"
												{...field}
												onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
										<FormLabel>Purchase Price (per unit)</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												placeholder="45000.00"
												{...field}
												onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="walletAddress"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Wallet Address (Optional)</FormLabel>
									<FormControl>
										<Input
											placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
											{...field}
											className="font-mono text-sm"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="purchaseDate"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Purchase Date (Optional)</FormLabel>
									<FormControl>
										<DatePicker
											date={field.value}
											onChange={field.onChange}
											disabledDates={(date) => date > new Date() || date < new Date("1900-01-01")}
										/>
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
							<Button type="submit" disabled={isSubmitting || isLoading} className="gap-2">
								<Wallet className="h-4 w-4" />
								{isSubmitting ? "Adding..." : "Add Crypto"}
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

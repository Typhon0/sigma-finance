import {
	Bitcoin,
	Building,
	Landmark,
	Package,
	Shield,
	TrendingUp,
	Watch,
} from "lucide-react";
import { useState } from "react";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Button } from "./ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

const assetTypes = [
	{
		id: "stock",
		label: "Stock/ETF",
		icon: TrendingUp,
		description: "Publicly traded stocks and funds",
	},
	{
		id: "crypto",
		label: "Cryptocurrency",
		icon: Bitcoin,
		description: "Digital currencies and tokens",
	},
	{
		id: "bank",
		label: "Bank Account",
		icon: Landmark,
		description: "Savings, checking, and cash accounts",
	},
	{
		id: "real_estate",
		label: "Real Estate",
		icon: Building,
		description: "Properties and real estate investments",
	},
	{
		id: "insurance",
		label: "Life Insurance",
		icon: Shield,
		description: "Life insurance policies",
	},
	{
		id: "watch",
		label: "Luxury Watch",
		icon: Watch,
		description: "Collectible timepieces",
	},
	{
		id: "other",
		label: "Other",
		icon: Package,
		description: "Other valuable assets",
	},
];

export function AddAssetForm({ onClose }) {
	const { addAsset } = usePortfolio();
	const [selectedType, setSelectedType] = useState("");
	const [formData, setFormData] = useState({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			const assetData = {
				type: selectedType,
				...formData,
				currentPrice: parseFloat(
					formData.currentPrice ||
						formData.balance ||
						formData.currentValue ||
						0,
				),
				purchasePrice: parseFloat(
					formData.purchasePrice ||
						formData.balance ||
						formData.purchasePrice ||
						0,
				),
				quantity: parseFloat(formData.quantity || 1),
				createdAt: new Date().toISOString(),
			};

			addAsset(assetData);
			onClose();
		} catch (error) {
			console.error("Error adding asset:", error);
		}

		setIsSubmitting(false);
	};

	const updateFormData = (field, value) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const renderStockForm = () => (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="symbol">Symbol *</Label>
					<Input
						id="symbol"
						value={formData.symbol || ""}
						onChange={(e) =>
							updateFormData("symbol", e.target.value.toUpperCase())
						}
						placeholder="AAPL"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="name">Company Name *</Label>
					<Input
						id="name"
						value={formData.name || ""}
						onChange={(e) => updateFormData("name", e.target.value)}
						placeholder="Apple Inc."
						required
					/>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="quantity">Quantity *</Label>
					<Input
						id="quantity"
						type="number"
						step="0.001"
						value={formData.quantity || ""}
						onChange={(e) => updateFormData("quantity", e.target.value)}
						placeholder="10"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="currentPrice">Current Price *</Label>
					<Input
						id="currentPrice"
						type="number"
						step="0.01"
						value={formData.currentPrice || ""}
						onChange={(e) => updateFormData("currentPrice", e.target.value)}
						placeholder="185.50"
						required
					/>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="purchasePrice">Purchase Price *</Label>
					<Input
						id="purchasePrice"
						type="number"
						step="0.01"
						value={formData.purchasePrice || ""}
						onChange={(e) => updateFormData("purchasePrice", e.target.value)}
						placeholder="170.00"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="purchaseDate">Purchase Date</Label>
					<Input
						id="purchaseDate"
						type="date"
						value={formData.purchaseDate || ""}
						onChange={(e) => updateFormData("purchaseDate", e.target.value)}
					/>
				</div>
			</div>
		</div>
	);

	const renderCryptoForm = () => (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="symbol">Symbol *</Label>
					<Input
						id="symbol"
						value={formData.symbol || ""}
						onChange={(e) =>
							updateFormData("symbol", e.target.value.toUpperCase())
						}
						placeholder="BTC"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="name">Name *</Label>
					<Input
						id="name"
						value={formData.name || ""}
						onChange={(e) => updateFormData("name", e.target.value)}
						placeholder="Bitcoin"
						required
					/>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="quantity">Quantity *</Label>
					<Input
						id="quantity"
						type="number"
						step="0.00000001"
						value={formData.quantity || ""}
						onChange={(e) => updateFormData("quantity", e.target.value)}
						placeholder="0.5"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="currentPrice">Current Price *</Label>
					<Input
						id="currentPrice"
						type="number"
						step="0.01"
						value={formData.currentPrice || ""}
						onChange={(e) => updateFormData("currentPrice", e.target.value)}
						placeholder="43250.00"
						required
					/>
				</div>
			</div>

			<div className="space-y-2">
				<Label htmlFor="walletAddress">Wallet Address (Optional)</Label>
				<Input
					id="walletAddress"
					value={formData.walletAddress || ""}
					onChange={(e) => updateFormData("walletAddress", e.target.value)}
					placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
				/>
			</div>
		</div>
	);

	const renderBankForm = () => (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Account Name *</Label>
				<Input
					id="name"
					value={formData.name || ""}
					onChange={(e) => updateFormData("name", e.target.value)}
					placeholder="Chase Savings Account"
					required
				/>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="accountType">Account Type *</Label>
					<Select
						value={formData.accountType || ""}
						onValueChange={(value) => updateFormData("accountType", value)}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="checking">Checking</SelectItem>
							<SelectItem value="savings">Savings</SelectItem>
							<SelectItem value="cd">Certificate of Deposit</SelectItem>
							<SelectItem value="money_market">Money Market</SelectItem>
							<SelectItem value="other">Other</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="balance">Current Balance *</Label>
					<Input
						id="balance"
						type="number"
						step="0.01"
						value={formData.balance || ""}
						onChange={(e) => updateFormData("balance", e.target.value)}
						placeholder="15000.00"
						required
					/>
				</div>
			</div>

			<div className="space-y-2">
				<Label htmlFor="accountNumber">Account Number (Last 4 digits)</Label>
				<Input
					id="accountNumber"
					value={formData.accountNumber || ""}
					onChange={(e) => updateFormData("accountNumber", e.target.value)}
					placeholder="1234"
					maxLength="4"
				/>
			</div>
		</div>
	);

	const renderRealEstateForm = () => (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Property Name *</Label>
				<Input
					id="name"
					value={formData.name || ""}
					onChange={(e) => updateFormData("name", e.target.value)}
					placeholder="Primary Residence"
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="address">Address</Label>
				<Textarea
					id="address"
					value={formData.address || ""}
					onChange={(e) => updateFormData("address", e.target.value)}
					placeholder="123 Main St, Anytown, ST 12345"
				/>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="currentValue">Current Value *</Label>
					<Input
						id="currentValue"
						type="number"
						step="1000"
						value={formData.currentValue || ""}
						onChange={(e) => updateFormData("currentValue", e.target.value)}
						placeholder="450000"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="purchasePrice">Purchase Price</Label>
					<Input
						id="purchasePrice"
						type="number"
						step="1000"
						value={formData.purchasePrice || ""}
						onChange={(e) => updateFormData("purchasePrice", e.target.value)}
						placeholder="350000"
					/>
				</div>
			</div>

			<div className="space-y-2">
				<Label htmlFor="ownershipPercentage">Ownership Percentage</Label>
				<Input
					id="ownershipPercentage"
					type="number"
					min="0"
					max="100"
					value={formData.ownershipPercentage || "100"}
					onChange={(e) =>
						updateFormData("ownershipPercentage", e.target.value)
					}
					placeholder="100"
				/>
			</div>
		</div>
	);

	const renderForm = () => {
		switch (selectedType) {
			case "stock":
				return renderStockForm();
			case "crypto":
				return renderCryptoForm();
			case "bank":
				return renderBankForm();
			case "real_estate":
				return renderRealEstateForm();
			default:
				return (
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">Asset Name *</Label>
							<Input
								id="name"
								value={formData.name || ""}
								onChange={(e) => updateFormData("name", e.target.value)}
								placeholder="Asset name"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="currentValue">Current Value *</Label>
							<Input
								id="currentValue"
								type="number"
								step="0.01"
								value={formData.currentValue || ""}
								onChange={(e) => updateFormData("currentValue", e.target.value)}
								placeholder="1000.00"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								value={formData.description || ""}
								onChange={(e) => updateFormData("description", e.target.value)}
								placeholder="Asset description..."
							/>
						</div>
					</div>
				);
		}
	};

	if (!selectedType) {
		return (
			<div className="space-y-6">
				<div className="text-center">
					<h3 className="text-lg font-medium">Choose Asset Type</h3>
					<p className="text-muted-foreground">
						Select the type of asset you want to add
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{assetTypes.map((type) => {
						const Icon = type.icon;
						return (
							<Card
								key={type.id}
								className="cursor-pointer hover:bg-muted/50 transition-colors"
								onClick={() => setSelectedType(type.id)}
							>
								<CardHeader className="pb-3">
									<div className="flex items-center space-x-3">
										<div className="bg-primary/10 p-2 rounded-lg">
											<Icon className="h-5 w-5 text-primary" />
										</div>
										<div>
											<CardTitle className="text-base">{type.label}</CardTitle>
											<CardDescription className="text-sm">
												{type.description}
											</CardDescription>
										</div>
									</div>
								</CardHeader>
							</Card>
						);
					})}
				</div>
			</div>
		);
	}

	const selectedAssetType = assetTypes.find((type) => type.id === selectedType);

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className="flex items-center space-x-3">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setSelectedType("")}
				>
					← Back
				</Button>
				<div className="flex items-center space-x-2">
					<selectedAssetType.icon className="h-5 w-5" />
					<h3 className="text-lg font-medium">{selectedAssetType.label}</h3>
				</div>
			</div>

			{renderForm()}

			<div className="flex justify-end space-x-3 pt-4">
				<Button type="button" variant="outline" onClick={onClose}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Adding..." : "Add Asset"}
				</Button>
			</div>
		</form>
	);
}

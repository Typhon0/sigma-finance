import { Building2, Coins, CreditCard, Home, Package, Shield, Watch } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssetType } from "@/hooks/use-asset-management";
import { useAssetTypes } from "@/hooks/use-asset-management";

interface AssetTypeSelectorProps {
	selectedType: AssetType | null;
	onTypeSelect: (type: AssetType) => void;
	className?: string;
}

const ASSET_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	STOCK: Building2,
	CRYPTO: Coins,
	BANK_ACCOUNT: CreditCard,
	REAL_ESTATE: Home,
	LIFE_INSURANCE: Shield,
	WATCH: Watch,
	OTHER_VALUABLE: Package,
};

const ASSET_TYPE_DESCRIPTIONS: Record<string, string> = {
	STOCK: "Publicly traded stocks, ETFs, and mutual funds",
	CRYPTO: "Cryptocurrencies and digital assets",
	BANK_ACCOUNT: "Checking, savings, and term deposit accounts",
	REAL_ESTATE: "Properties, land, and real estate investments",
	LIFE_INSURANCE: "Life insurance policies with cash value",
	WATCH: "Luxury watches and timepieces",
	OTHER_VALUABLE: "Other valuable assets and collectibles",
};

export function AssetTypeSelector({
	selectedType,
	onTypeSelect,
	className,
}: AssetTypeSelectorProps) {
	const { assetTypes, loading } = useAssetTypes();

	if (loading) {
		return (
			<div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<Card key={i} className="animate-pulse">
						<CardHeader className="pb-2">
							<div className="h-6 w-6 bg-muted rounded" />
							<div className="h-4 bg-muted rounded w-20" />
						</CardHeader>
						<CardContent>
							<div className="h-3 bg-muted rounded w-full" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	return (
		<div className={`grid gap-3 grid-cols-2 lg:grid-cols-3 ${className}`}>
			{assetTypes.map((type) => {
				const Icon = ASSET_TYPE_ICONS[type.name] || Package;
				const description = ASSET_TYPE_DESCRIPTIONS[type.name] || "Asset type";
				const isSelected = selectedType?.id === type.id;

				return (
					<Card
						key={type.id}
						className={`cursor-pointer transition-all hover:shadow-md ${
							isSelected ? "ring-2 ring-primary bg-primary/5" : ""
						}`}
						onClick={() => onTypeSelect(type)}
					>
						<CardHeader className="pb-2">
							<div className="flex items-center gap-2">
								<Icon
									className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
								/>
								<CardTitle className="text-sm">{type.name.replace("_", " ")}</CardTitle>
							</div>
						</CardHeader>
						<CardContent>
							<CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

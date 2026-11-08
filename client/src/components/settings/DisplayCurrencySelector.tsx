import { Check, DollarSign, Euro, Loader2, PoundSterling } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUpdateDisplayCurrencyMutation } from "@/hooks/use-user-mutations";
import { useAuth } from "@/hooks/use-auth";

const currencies = [
	{
		id: "USD",
		name: "Dollar US",
		description: "United States Dollar",
		symbol: "$",
		icon: DollarSign,
	},
	{
		id: "EUR",
		name: "Euro",
		description: "Union Européenne",
		symbol: "€",
		icon: Euro,
	},
	{
		id: "GBP",
		name: "Livre Sterling",
		description: "Royaume-Uni",
		symbol: "£",
		icon: PoundSterling,
	},
	{
		id: "CHF",
		name: "Franc Suisse",
		description: "Confédération Suisse",
		symbol: "Fr",
		icon: DollarSign,
	},
];

interface DisplayCurrencySelectorProps {
	currentCurrency?: string;
	onCurrencyChange?: (currency: string) => void;
}

export function DisplayCurrencySelector({
	currentCurrency = "USD",
	onCurrencyChange,
}: DisplayCurrencySelectorProps) {
	const { updateUser } = useAuth();
	const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);
	const [updateDisplayCurrency, { loading }] = useUpdateDisplayCurrencyMutation();

	useEffect(() => {
		setSelectedCurrency(currentCurrency);
	}, [currentCurrency]);

	const handleSave = async () => {
		try {
			const result = await updateDisplayCurrency({
				variables: {
					input: {
						displayCurrency: selectedCurrency,
					},
				},
			});

			if (result.data?.updateUserDisplayCurrency) {
				updateUser(result.data.updateUserDisplayCurrency);
				onCurrencyChange?.(selectedCurrency);
				toast.success(`Devise d'affichage définie sur ${selectedCurrency}`);
			}
		} catch {
			toast.error("Échec de la mise à jour de la devise");
		}
	};

	return (
		<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-4">
			<div>
				<h2 className="text-sm font-semibold text-foreground">Devise de Référence</h2>
				<p className="text-xs text-muted-foreground mt-0.5">
					Détermine la monnaie d'évaluation par défaut de vos portefeuilles et agrégats financiers.
				</p>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
				{currencies.map((currency) => {
					const isSelected = selectedCurrency === currency.id;
					return (
						<button
							type="button"
							key={currency.id}
							onClick={() => setSelectedCurrency(currency.id)}
							className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
								isSelected
									? "bg-secondary/70 border-primary/50 text-foreground shadow-2xs"
									: "bg-card/20 hover:bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
							}`}
						>
							<div className="flex items-center gap-2.5 min-w-0">
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 font-mono text-xs font-semibold text-foreground">
									{currency.symbol}
								</span>
								<div className="min-w-0">
									<p className="text-xs font-medium truncate text-foreground">{currency.name}</p>
									<p className="text-[10px] font-mono text-muted-foreground">{currency.id}</p>
								</div>
							</div>
							{isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
						</button>
					);
				})}
			</div>

			{selectedCurrency !== currentCurrency && (
				<div className="flex justify-end pt-1">
					<Button
						size="sm"
						onClick={handleSave}
						disabled={loading}
						className="h-8 gap-1.5 text-xs font-medium"
					>
						{loading ? (
							<>
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Enregistrement...
							</>
						) : (
							<>
								<Check className="h-3.5 w-3.5" />
								Appliquer {selectedCurrency}
							</>
						)}
					</Button>
				</div>
			)}
		</div>
	);
}

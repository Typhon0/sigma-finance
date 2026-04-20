import { Check, DollarSign, Euro, Loader2, PoundSterling } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUpdateDisplayCurrencyMutation } from "@/hooks/use-user-mutations";

const currencies = [
  {
    id: "USD",
    name: "US Dollar",
    description: "United States Dollar",
    symbol: "$",
    icon: DollarSign,
  },
  {
    id: "EUR",
    name: "Euro",
    description: "European Union Euro",
    symbol: "€",
    icon: Euro,
  },
  {
    id: "GBP",
    name: "British Pound",
    description: "United Kingdom Pound Sterling",
    symbol: "£",
    icon: PoundSterling,
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
  const [updateDisplayCurrency, { loading }] =
    useUpdateDisplayCurrencyMutation();

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
        // Update the AuthContext immediately so that useCurrency(),
        // AddStockForm, AddCryptoForm, etc. reflect the new currency
        // without requiring a full page refresh.
        updateUser({ displayCurrency: selectedCurrency });
        toast.success(
          `Display currency updated to ${selectedCurrency}`
        );
        onCurrencyChange?.(selectedCurrency);
      }
    } catch (error) {
      toast.error("Failed to update display currency");
      console.error("Error updating display currency:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Display Currency
        </CardTitle>
        <CardDescription>
          Choose the currency for displaying your portfolio values
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedCurrency}
          onValueChange={setSelectedCurrency}
          disabled={loading}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currencies.map((currency) => {
              const Icon = currency.icon;
              return (
                <label
                  key={currency.id}
                  htmlFor={currency.id}
                  className={`
                    relative flex cursor-pointer rounded-lg border-2 p-4 transition-all
                    ${
                      selectedCurrency === currency.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }
                    ${loading ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  <div className="flex flex-1 items-start gap-3">
                    <div
                      className={`
                        flex h-10 w-10 items-center justify-center rounded-lg
                        ${
                          selectedCurrency === currency.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }
                      `}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value={currency.id}
                          id={currency.id}
                          className="sr-only"
                        />
                        <span className="font-medium">{currency.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({currency.symbol})
                        </span>
                        {selectedCurrency === currency.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currency.description}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </RadioGroup>

        <div className="flex justify-end pt-4 border-t mt-4">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Currency
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

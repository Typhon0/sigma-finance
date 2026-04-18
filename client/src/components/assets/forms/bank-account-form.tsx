import { zodResolver } from "@hookform/resolvers/zod";
import { Building, CreditCard } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const bankAccountSchema = z.object({
	name: z.string().min(1, "Account name is required"),
	institution: z.string().min(1, "Institution name is required"),
	accountType: z.string().min(1, "Account type is required"),
	accountNumber: z.string().optional(),
	currentBalance: z.number().min(0, "Balance must be positive"),
	currency: z.string().min(1, "Currency is required"),
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;

interface BankAccountFormProps {
	onSubmit: (data: BankAccountFormData) => Promise<void>;
	onCancel: () => void;
	isLoading?: boolean;
	initialData?: Partial<BankAccountFormData>;
}

const ACCOUNT_TYPES = [
	{ value: "CHECKING", label: "Checking Account" },
	{ value: "SAVINGS", label: "Savings Account" },
	{ value: "TERM_DEPOSIT", label: "Term Deposit / CD" },
	{ value: "MONEY_MARKET", label: "Money Market Account" },
	{ value: "HIGH_YIELD_SAVINGS", label: "High Yield Savings" },
	{ value: "OTHER", label: "Other" },
];

const CURRENCIES = [
	{ value: "USD", label: "US Dollar (USD)" },
	{ value: "EUR", label: "Euro (EUR)" },
	{ value: "GBP", label: "British Pound (GBP)" },
	{ value: "CAD", label: "Canadian Dollar (CAD)" },
	{ value: "AUD", label: "Australian Dollar (AUD)" },
	{ value: "JPY", label: "Japanese Yen (JPY)" },
	{ value: "CHF", label: "Swiss Franc (CHF)" },
];

export function BankAccountForm({
	onSubmit,
	onCancel,
	isLoading,
	initialData,
}: BankAccountFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<BankAccountFormData>({
		resolver: zodResolver(bankAccountSchema),
		defaultValues: {
			name: initialData?.name || "",
			institution: initialData?.institution || "",
			accountType: initialData?.accountType || "",
			accountNumber: initialData?.accountNumber || "",
			currentBalance: initialData?.currentBalance || 0,
			currency: initialData?.currency || "USD",
		},
	});

	const handleSubmit = async (data: BankAccountFormData) => {
		setIsSubmitting(true);
		try {
			await onSubmit(data);
		} catch (error) {
			console.error("Error submitting bank account:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<CreditCard className="h-5 w-5 text-blue-600" />
					<div>
						<CardTitle className="text-lg">Bank Account</CardTitle>
						<CardDescription>
							Add checking, savings, and other bank accounts
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
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Account Name</FormLabel>
									<FormControl>
										<Input placeholder="My Checking Account" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="institution"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Bank/Institution</FormLabel>
										<FormControl>
											<Input placeholder="Chase Bank" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="accountType"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Account Type</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select account type" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{ACCOUNT_TYPES.map((type) => (
													<SelectItem key={type.value} value={type.value}>
														{type.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="accountNumber"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Account Number (Optional)</FormLabel>
									<FormControl>
										<Input placeholder="****1234" {...field} type="password" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="currentBalance"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Current Balance</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												placeholder="10000.00"
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
								name="currency"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Currency</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select currency" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{CURRENCIES.map((currency) => (
													<SelectItem
														key={currency.value}
														value={currency.value}
													>
														{currency.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

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
								<Building className="h-4 w-4" />
								{isSubmitting ? "Adding..." : "Add Account"}
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

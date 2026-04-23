import { format } from "date-fns";
import { CalendarIcon, DollarSign, FileText, Shield } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";

interface InsuranceFormData {
	name: string;
	category: string;
	currentValue: string;
	purchasePrice: string;
	policyNumber: string;
	coverageAmount: string;
	premiumAmount: string;
	premiumFrequency: string;
	annualReturn: string;
	openingDate: string;
	ownership: string;
	provider: string;
	beneficiaries: string;
	notes: string;
}

interface AddInsuranceFormProps {
	onSubmit: (data: InsuranceFormData) => void;
	onCancel: () => void;
	initialData?: Partial<InsuranceFormData>;
}

export function AddInsuranceForm({ onSubmit, onCancel, initialData }: AddInsuranceFormProps) {
	const [formData, setFormData] = useState({
		name: initialData?.name || "",
		category: initialData?.category || "life_insurance",
		currentValue: initialData?.currentValue || "",
		purchasePrice: initialData?.purchasePrice || "",
		policyNumber: initialData?.policyNumber || "",
		coverageAmount: initialData?.coverageAmount || "",
		premiumAmount: initialData?.premiumAmount || "",
		premiumFrequency: initialData?.premiumFrequency || "yearly",
		annualReturn: initialData?.annualReturn || "",
		openingDate: initialData?.openingDate || "",
		ownership: initialData?.ownership || "personal",
		provider: initialData?.provider || "",
		beneficiaries: initialData?.beneficiaries || "",
		notes: initialData?.notes || "",
	});

	const handleChange = (field: string, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit(formData);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			{/* Basic Information */}
			<div className="space-y-4">
				<div>
					<h3 className="mb-4 flex items-center gap-2">
						<Shield className="h-5 w-5" />
						Basic Information
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="name">Policy Name *</Label>
						<Input
							id="name"
							placeholder="e.g., Assurance Vie Axa"
							value={formData.name}
							onChange={(e) => handleChange("name", e.target.value)}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="category">Category *</Label>
						<Select
							value={formData.category}
							onValueChange={(value) => handleChange("category", value)}
						>
							<SelectTrigger id="category">
								<SelectValue placeholder="Select category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="life_insurance">Life Insurance</SelectItem>
								<SelectItem value="retirement">Retirement (PER)</SelectItem>
								<SelectItem value="savings">Savings Plan</SelectItem>
								<SelectItem value="death_insurance">Death Insurance</SelectItem>
								<SelectItem value="mixed">Mixed</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="provider">Provider</Label>
						<Input
							id="provider"
							placeholder="e.g., AXA, Generali, Allianz"
							value={formData.provider}
							onChange={(e) => handleChange("provider", e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="policyNumber">Policy Number</Label>
						<Input
							id="policyNumber"
							placeholder="e.g., AXA-****-2847"
							value={formData.policyNumber}
							onChange={(e) => handleChange("policyNumber", e.target.value)}
						/>
					</div>
				</div>
			</div>

			{/* Financial Information */}
			<div className="space-y-4">
				<div>
					<h3 className="mb-4 flex items-center gap-2">
						<DollarSign className="h-5 w-5" />
						Financial Information
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="currentValue">Current Value (€) *</Label>
						<Input
							id="currentValue"
							type="number"
							step="0.01"
							placeholder="e.g., 45800"
							value={formData.currentValue}
							onChange={(e) => handleChange("currentValue", e.target.value)}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="purchasePrice">Total Contributions (€) *</Label>
						<Input
							id="purchasePrice"
							type="number"
							step="0.01"
							placeholder="e.g., 42000"
							value={formData.purchasePrice}
							onChange={(e) => handleChange("purchasePrice", e.target.value)}
							required
						/>
						<p className="text-xs text-muted-foreground">Total amount invested/contributed</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="space-y-2">
						<Label htmlFor="coverageAmount">Coverage Amount (€)</Label>
						<Input
							id="coverageAmount"
							type="number"
							step="0.01"
							placeholder="e.g., 100000"
							value={formData.coverageAmount}
							onChange={(e) => handleChange("coverageAmount", e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">Death benefit / coverage amount</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="premiumAmount">Premium Amount (€)</Label>
						<Input
							id="premiumAmount"
							type="number"
							step="0.01"
							placeholder="e.g., 1200"
							value={formData.premiumAmount}
							onChange={(e) => handleChange("premiumAmount", e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">Amount paid per premium period</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="premiumFrequency">Premium Frequency</Label>
						<Select
							value={formData.premiumFrequency}
							onValueChange={(value) => handleChange("premiumFrequency", value)}
						>
							<SelectTrigger id="premiumFrequency">
								<SelectValue placeholder="Select frequency" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="monthly">Monthly</SelectItem>
								<SelectItem value="quarterly">Quarterly</SelectItem>
								<SelectItem value="semi_annually">Semi-Annually</SelectItem>
								<SelectItem value="yearly">Yearly</SelectItem>
								<SelectItem value="single">Single Premium</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="annualReturn">Annual Return (%)</Label>
						<Input
							id="annualReturn"
							type="number"
							step="0.01"
							placeholder="e.g., 3.2"
							value={formData.annualReturn}
							onChange={(e) => handleChange("annualReturn", e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">Average annual return rate</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="openingDate">Opening Date</Label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className={cn(
										"w-full pl-3 text-left font-normal",
										!formData.openingDate && "text-muted-foreground",
									)}
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{formData.openingDate ? (
										format(new Date(formData.openingDate), "PPP")
									) : (
										<span>Pick a date</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={formData.openingDate ? new Date(formData.openingDate) : undefined}
									onSelect={(date) => handleChange("openingDate", date ? date.toISOString() : "")}
									disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
									autoFocus
								/>
							</PopoverContent>
						</Popover>
					</div>
				</div>
			</div>

			{/* Additional Information */}
			<div className="space-y-4">
				<div>
					<h3 className="mb-4 flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Additional Information
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="ownership">Ownership</Label>
						<Select
							value={formData.ownership}
							onValueChange={(value) => handleChange("ownership", value)}
						>
							<SelectTrigger id="ownership">
								<SelectValue placeholder="Select ownership" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="personal">Personal</SelectItem>
								<SelectItem value="joint">Joint</SelectItem>
								<SelectItem value="family">Family</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="beneficiaries">Beneficiaries</Label>
						<Input
							id="beneficiaries"
							placeholder="e.g., Spouse, Children"
							value={formData.beneficiaries}
							onChange={(e) => handleChange("beneficiaries", e.target.value)}
						/>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="notes">Notes</Label>
					<Textarea
						id="notes"
						placeholder="Additional notes about this policy..."
						value={formData.notes}
						onChange={(e) => handleChange("notes", e.target.value)}
						rows={3}
					/>
				</div>
			</div>

			{/* Actions */}
			<div className="flex gap-3 pt-4 border-t">
				<Button type="button" variant="outline" onClick={onCancel} className="flex-1">
					Cancel
				</Button>
				<Button type="submit" className="flex-1">
					{initialData ? "Update Policy" : "Add Policy"}
				</Button>
			</div>
		</form>
	);
}

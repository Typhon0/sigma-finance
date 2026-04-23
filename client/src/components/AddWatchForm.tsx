import { format } from "date-fns";
import { CalendarIcon, DollarSign, Package, Watch } from "lucide-react";
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

interface WatchFormData {
	name: string;
	brand: string;
	model: string;
	currentValue: string;
	purchasePrice: string;
	purchaseDate: string;
	serialNumber: string;
	condition: string;
	reference: string;
	yearManufactured: string;
	material: string;
	movement: string;
	boxPapers: string;
	description: string;
}

interface AddWatchFormProps {
	onSubmit: (data: WatchFormData) => void;
	onCancel: () => void;
	initialData?: Partial<WatchFormData>;
}

export function AddWatchForm({ onSubmit, onCancel, initialData }: AddWatchFormProps) {
	const [formData, setFormData] = useState({
		name: initialData?.name || "",
		brand: initialData?.brand || "",
		model: initialData?.model || "",
		currentValue: initialData?.currentValue || "",
		purchasePrice: initialData?.purchasePrice || "",
		purchaseDate: initialData?.purchaseDate || "",
		serialNumber: initialData?.serialNumber || "",
		condition: initialData?.condition || "excellent",
		reference: initialData?.reference || "",
		yearManufactured: initialData?.yearManufactured || "",
		material: initialData?.material || "stainless_steel",
		movement: initialData?.movement || "automatic",
		boxPapers: initialData?.boxPapers || "both",
		description: initialData?.description || "",
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
						<Watch className="h-5 w-5" />
						Watch Information
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="name">Watch Name *</Label>
						<Input
							id="name"
							placeholder="e.g., Rolex Submariner Date"
							value={formData.name}
							onChange={(e) => handleChange("name", e.target.value)}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="brand">Brand *</Label>
						<Input
							id="brand"
							placeholder="e.g., Rolex, Omega, Patek Philippe"
							value={formData.brand}
							onChange={(e) => handleChange("brand", e.target.value)}
							required
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="model">Model *</Label>
						<Input
							id="model"
							placeholder="e.g., Submariner 126610LN"
							value={formData.model}
							onChange={(e) => handleChange("model", e.target.value)}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="reference">Reference Number</Label>
						<Input
							id="reference"
							placeholder="e.g., 126610LN"
							value={formData.reference}
							onChange={(e) => handleChange("reference", e.target.value)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="serialNumber">Serial Number</Label>
						<Input
							id="serialNumber"
							placeholder="e.g., ****8234"
							value={formData.serialNumber}
							onChange={(e) => handleChange("serialNumber", e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="yearManufactured">Year Manufactured</Label>
						<Input
							id="yearManufactured"
							type="number"
							placeholder="e.g., 2021"
							value={formData.yearManufactured}
							onChange={(e) => handleChange("yearManufactured", e.target.value)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="material">Case Material</Label>
						<Select
							value={formData.material}
							onValueChange={(value) => handleChange("material", value)}
						>
							<SelectTrigger id="material">
								<SelectValue placeholder="Select material" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="stainless_steel">Stainless Steel</SelectItem>
								<SelectItem value="gold">Gold</SelectItem>
								<SelectItem value="rose_gold">Rose Gold</SelectItem>
								<SelectItem value="white_gold">White Gold</SelectItem>
								<SelectItem value="platinum">Platinum</SelectItem>
								<SelectItem value="titanium">Titanium</SelectItem>
								<SelectItem value="ceramic">Ceramic</SelectItem>
								<SelectItem value="bronze">Bronze</SelectItem>
								<SelectItem value="other">Other</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="movement">Movement</Label>
						<Select
							value={formData.movement}
							onValueChange={(value) => handleChange("movement", value)}
						>
							<SelectTrigger id="movement">
								<SelectValue placeholder="Select movement" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="automatic">Automatic</SelectItem>
								<SelectItem value="manual">Manual Wind</SelectItem>
								<SelectItem value="quartz">Quartz</SelectItem>
								<SelectItem value="spring_drive">Spring Drive</SelectItem>
								<SelectItem value="kinetic">Kinetic</SelectItem>
								<SelectItem value="solar">Solar</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{/* Financial Information */}
			<div className="space-y-4">
				<div>
					<h3 className="mb-4 flex items-center gap-2">
						<DollarSign className="h-5 w-5" />
						Valuation
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="currentValue">Current Value (€) *</Label>
						<Input
							id="currentValue"
							type="number"
							step="0.01"
							placeholder="e.g., 12500"
							value={formData.currentValue}
							onChange={(e) => handleChange("currentValue", e.target.value)}
							required
						/>
						<p className="text-xs text-muted-foreground">Current market value</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="purchasePrice">Purchase Price (€) *</Label>
						<Input
							id="purchasePrice"
							type="number"
							step="0.01"
							placeholder="e.g., 9800"
							value={formData.purchasePrice}
							onChange={(e) => handleChange("purchasePrice", e.target.value)}
							required
						/>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="purchaseDate">Purchase Date</Label>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								className={cn(
									"w-full pl-3 text-left font-normal",
									!formData.purchaseDate && "text-muted-foreground",
								)}
							>
								<CalendarIcon className="mr-2 h-4 w-4" />
								{formData.purchaseDate ? (
									format(new Date(formData.purchaseDate), "PPP")
								) : (
									<span>Pick a date</span>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={formData.purchaseDate ? new Date(formData.purchaseDate) : undefined}
								onSelect={(date) => handleChange("purchaseDate", date ? date.toISOString() : "")}
								disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
								autoFocus
							/>
						</PopoverContent>
					</Popover>
				</div>
			</div>

			{/* Condition & Documentation */}
			<div className="space-y-4">
				<div>
					<h3 className="mb-4 flex items-center gap-2">
						<Package className="h-5 w-5" />
						Condition & Documentation
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="condition">Condition *</Label>
						<Select
							value={formData.condition}
							onValueChange={(value) => handleChange("condition", value)}
						>
							<SelectTrigger id="condition">
								<SelectValue placeholder="Select condition" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="mint">Mint / Unworn</SelectItem>
								<SelectItem value="excellent">Excellent</SelectItem>
								<SelectItem value="very_good">Very Good</SelectItem>
								<SelectItem value="good">Good</SelectItem>
								<SelectItem value="fair">Fair</SelectItem>
								<SelectItem value="poor">Poor</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="boxPapers">Box & Papers</Label>
						<Select
							value={formData.boxPapers}
							onValueChange={(value) => handleChange("boxPapers", value)}
						>
							<SelectTrigger id="boxPapers">
								<SelectValue placeholder="Select" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="both">Box & Papers</SelectItem>
								<SelectItem value="box_only">Box Only</SelectItem>
								<SelectItem value="papers_only">Papers Only</SelectItem>
								<SelectItem value="none">None</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						placeholder="Additional details about the watch, service history, provenance, etc."
						value={formData.description}
						onChange={(e) => handleChange("description", e.target.value)}
						rows={4}
					/>
				</div>
			</div>

			{/* Actions */}
			<div className="flex gap-3 pt-4 border-t">
				<Button type="button" variant="outline" onClick={onCancel} className="flex-1">
					Cancel
				</Button>
				<Button type="submit" className="flex-1">
					{initialData ? "Update Watch" : "Add Watch"}
				</Button>
			</div>
		</form>
	);
}

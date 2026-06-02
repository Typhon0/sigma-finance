import { zodResolver } from "@hookform/resolvers/zod";
import { Home, MapPin } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";

const realEstateSchema = z.object({
	name: z.string().min(1, "Property name is required"),
	propertyType: z.string().min(1, "Property type is required"),
	address: z.string().min(1, "Address is required"),
	city: z.string().min(1, "City is required"),
	state: z.string().optional(),
	country: z.string().min(1, "Country is required"),
	purchasePrice: z.number().min(0, "Purchase price must be positive"),
	currentValue: z.number().min(0, "Current value must be positive"),
	ownershipPercentage: z
		.number()
		.min(0.01, "Ownership must be at least 0.01%")
		.max(100, "Ownership cannot exceed 100%"),
	purchaseDate: z.date().optional(),
	notes: z.string().optional(),
});

type RealEstateFormData = z.infer<typeof realEstateSchema>;

interface RealEstateFormProps {
	onSubmit: (data: RealEstateFormData) => Promise<void>;
	onCancel: () => void;
	isLoading?: boolean;
	initialData?: Partial<RealEstateFormData>;
}

const PROPERTY_TYPES = [
	{ value: "RESIDENTIAL_HOUSE", label: "Residential House" },
	{ value: "APARTMENT", label: "Apartment/Condo" },
	{ value: "COMMERCIAL", label: "Commercial Property" },
	{ value: "LAND", label: "Land/Vacant Lot" },
	{ value: "RENTAL_PROPERTY", label: "Rental Property" },
	{ value: "VACATION_HOME", label: "Vacation Home" },
	{ value: "INDUSTRIAL", label: "Industrial Property" },
	{ value: "OTHER", label: "Other" },
];

export function RealEstateForm({
	onSubmit,
	onCancel,
	isLoading,
	initialData,
}: RealEstateFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<RealEstateFormData>({
		resolver: zodResolver(realEstateSchema),
		defaultValues: {
			name: initialData?.name || "",
			propertyType: initialData?.propertyType || "",
			address: initialData?.address || "",
			city: initialData?.city || "",
			state: initialData?.state || "",
			country: initialData?.country || "United States",
			purchasePrice: initialData?.purchasePrice || 0,
			currentValue: initialData?.currentValue || 0,
			ownershipPercentage: initialData?.ownershipPercentage || 100,
			purchaseDate: initialData?.purchaseDate ? new Date(initialData.purchaseDate) : undefined,
			notes: initialData?.notes || "",
		},
	});

	const handleSubmit = async (data: RealEstateFormData) => {
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
					<Home className="h-5 w-5 text-purple-600" />
					<div>
						<CardTitle className="text-lg">Real Estate Property</CardTitle>
						<CardDescription>Add properties, land, and real estate investments</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Property Name</FormLabel>
										<FormControl>
											<Input placeholder="Main Street House" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="propertyType"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Property Type</FormLabel>
										<Select onValueChange={field.onChange} defaultValue={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select property type" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{PROPERTY_TYPES.map((type) => (
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
							name="address"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Address</FormLabel>
									<FormControl>
										<Input placeholder="123 Main Street" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-3">
							<FormField
								control={form.control}
								name="city"
								render={({ field }) => (
									<FormItem>
										<FormLabel>City</FormLabel>
										<FormControl>
											<Input placeholder="New York" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="state"
								render={({ field }) => (
									<FormItem>
										<FormLabel>State/Province</FormLabel>
										<FormControl>
											<Input placeholder="NY" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="country"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Country</FormLabel>
										<FormControl>
											<Input placeholder="United States" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-3">
							<FormField
								control={form.control}
								name="purchasePrice"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Purchase Price</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												placeholder="500000.00"
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
								name="currentValue"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Current Value</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												placeholder="550000.00"
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
								name="ownershipPercentage"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Ownership %</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												min="0.01"
												max="100"
												placeholder="100"
												{...field}
												onChange={(e) => field.onChange(parseFloat(e.target.value) || 100)}
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

						<FormField
							control={form.control}
							name="notes"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Notes (Optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Additional property details..."
											className="resize-none"
											{...field}
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
								<MapPin className="h-4 w-4" />
								{isSubmitting ? "Adding..." : "Add Property"}
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

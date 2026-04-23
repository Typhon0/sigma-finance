import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Gem, Watch } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const watchSchema = z.object({
	name: z.string().min(1, "Watch name is required"),
	brand: z.string().min(1, "Brand is required"),
	model: z.string().min(1, "Model is required"),
	serialNumber: z.string().optional(),
	condition: z.string().min(1, "Condition is required"),
	purchasePrice: z.number().min(0, "Purchase price must be positive"),
	currentValue: z.number().min(0, "Current value must be positive"),
	purchaseDate: z.date().optional(),
	yearManufactured: z.number().optional(),
	material: z.string().optional(),
	movement: z.string().optional(),
	notes: z.string().optional(),
});

type WatchFormData = z.infer<typeof watchSchema>;

interface WatchFormProps {
	onSubmit: (data: WatchFormData) => Promise<void>;
	onCancel: () => void;
	isLoading?: boolean;
	initialData?: Partial<WatchFormData>;
}

const WATCH_BRANDS = [
	"Rolex",
	"Patek Philippe",
	"Audemars Piguet",
	"Omega",
	"Cartier",
	"Breitling",
	"TAG Heuer",
	"IWC",
	"Jaeger-LeCoultre",
	"Vacheron Constantin",
	"Panerai",
	"Hublot",
	"Richard Mille",
	"Tudor",
	"Seiko",
	"Casio",
	"Other",
];

const CONDITIONS = [
	{ value: "NEW", label: "New" },
	{ value: "EXCELLENT", label: "Excellent" },
	{ value: "VERY_GOOD", label: "Very Good" },
	{ value: "GOOD", label: "Good" },
	{ value: "FAIR", label: "Fair" },
	{ value: "POOR", label: "Poor" },
];

const MATERIALS = [
	"Stainless Steel",
	"Gold",
	"Rose Gold",
	"White Gold",
	"Platinum",
	"Titanium",
	"Ceramic",
	"Carbon Fiber",
	"Leather",
	"Rubber",
	"Other",
];

const MOVEMENTS = ["Automatic", "Manual", "Quartz", "Solar", "Kinetic", "Spring Drive", "Other"];

export function WatchForm({ onSubmit, onCancel, isLoading, initialData }: WatchFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<WatchFormData>({
		resolver: zodResolver(watchSchema),
		defaultValues: {
			name: initialData?.name || "",
			brand: initialData?.brand || "",
			model: initialData?.model || "",
			serialNumber: initialData?.serialNumber || "",
			condition: initialData?.condition || "",
			purchasePrice: initialData?.purchasePrice || 0,
			currentValue: initialData?.currentValue || 0,
			purchaseDate: initialData?.purchaseDate ? new Date(initialData.purchaseDate) : undefined,
			yearManufactured: initialData?.yearManufactured || undefined,
			material: initialData?.material || "",
			movement: initialData?.movement || "",
			notes: initialData?.notes || "",
		},
	});

	const handleSubmit = async (data: WatchFormData) => {
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
					<Watch className="h-5 w-5 text-indigo-600" />
					<div>
						<CardTitle className="text-lg">Luxury Watch</CardTitle>
						<CardDescription>Add luxury watches and timepieces to your collection</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Watch Name</FormLabel>
									<FormControl>
										<Input placeholder="Rolex Submariner Date" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="brand"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Brand</FormLabel>
										<Select onValueChange={field.onChange} defaultValue={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select brand" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{WATCH_BRANDS.map((brand) => (
													<SelectItem key={brand} value={brand}>
														{brand}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="model"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Model</FormLabel>
										<FormControl>
											<Input placeholder="Submariner Date 116610LN" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="serialNumber"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Serial Number (Optional)</FormLabel>
										<FormControl>
											<Input placeholder="V123456" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="condition"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Condition</FormLabel>
										<Select onValueChange={field.onChange} defaultValue={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select condition" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{CONDITIONS.map((condition) => (
													<SelectItem key={condition.value} value={condition.value}>
														{condition.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
												placeholder="8500.00"
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
												placeholder="9200.00"
												{...field}
												onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="purchaseDate"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel>Purchase Date (Optional)</FormLabel>
										<Popover>
											<PopoverTrigger asChild>
												<FormControl>
													<Button
														variant="outline"
														className={cn(
															"w-full pl-3 text-left font-normal",
															!field.value && "text-muted-foreground",
														)}
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
													</Button>
												</FormControl>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													mode="single"
													selected={field.value}
													onSelect={field.onChange}
													disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
													autoFocus
												/>
											</PopoverContent>
										</Popover>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="yearManufactured"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Year Manufactured (Optional)</FormLabel>
										<FormControl>
											<Input
												type="number"
												min="1800"
												max={new Date().getFullYear()}
												placeholder="2020"
												{...field}
												onChange={(e) => field.onChange(parseInt(e.target.value, 10) || undefined)}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<FormField
								control={form.control}
								name="material"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Material (Optional)</FormLabel>
										<Select onValueChange={field.onChange} defaultValue={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select material" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{MATERIALS.map((material) => (
													<SelectItem key={material} value={material}>
														{material}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="movement"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Movement (Optional)</FormLabel>
										<Select onValueChange={field.onChange} defaultValue={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select movement" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{MOVEMENTS.map((movement) => (
													<SelectItem key={movement} value={movement}>
														{movement}
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
							name="notes"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Notes (Optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Additional details about the watch..."
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
								<Gem className="h-4 w-4" />
								{isSubmitting ? "Adding..." : "Add Watch"}
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

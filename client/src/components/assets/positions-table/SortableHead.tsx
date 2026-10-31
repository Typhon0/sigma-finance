import { ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TableDensity } from "./types";

/**
 * Sortable column header with full keyboard focus and correct aria-sort attributes.
 */
export function SortableHead<T extends string>({
	label,
	field,
	className,
	align = "left",
	sortField,
	sortDirection,
	onSort,
	density = "compact",
}: {
	label: string;
	field: T;
	className?: string;
	align?: "left" | "right";
	sortField?: T;
	sortDirection?: "asc" | "desc";
	onSort?: (field: T) => void;
	density?: TableDensity;
}) {
	const isActive = sortField === field;
	const ariaSort = isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none";
	const isCompact = density === "compact";

	return (
		<TableHead
			className={cn(
				"font-semibold",
				isCompact ? "h-8 px-2" : "h-10 px-2",
				className,
			)}
			aria-sort={ariaSort}
		>
			<button
				type="button"
				onClick={() => onSort?.(field)}
				className={cn(
					"group inline-flex items-center gap-1 cursor-pointer select-none",
					"text-foreground/70 hover:text-foreground transition-colors",
					"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm",
					align === "right" ? "w-full justify-end" : "justify-start",
					isCompact ? "h-8 text-xs" : "h-10 text-xs",
				)}
			>
				<span>{label}</span>
				{isActive ? (
					<span aria-hidden className="text-primary font-bold text-micro">
						{sortDirection === "asc" ? "▲" : "▼"}
					</span>
				) : (
					<ArrowUpDown
						aria-hidden
						className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity"
					/>
				)}
			</button>
		</TableHead>
	);
}


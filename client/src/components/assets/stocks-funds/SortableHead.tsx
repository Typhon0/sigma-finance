import { ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Sortable column header shared by the holdings table and the transactions
 * table.
 *
 * These were previously bare <TableHead onClick> elements: not focusable, not
 * operable by keyboard, and with no aria-sort, so the table could not be
 * sorted without a mouse. A real <button> inside the header cell gives
 * keyboard access, a visible focus ring, and correct semantics for free.
 */
export function SortableHead<T extends string>({
	label,
	field,
	className,
	align = "left",
	sortField,
	sortDirection,
	onSort,
}: {
	label: string;
	field: T;
	className?: string;
	align?: "left" | "right";
	sortField?: T;
	sortDirection?: "asc" | "desc";
	onSort?: (field: T) => void;
}) {
	const isActive = sortField === field;
	const ariaSort = isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none";

	return (
		<TableHead className={cn("font-semibold", className)} aria-sort={ariaSort}>
			<button
				type="button"
				onClick={() => onSort?.(field)}
				className={cn(
					"inline-flex items-center gap-1 cursor-pointer select-none",
					"text-foreground/70 hover:text-foreground transition-colors",
					"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm",
					align === "right" && "justify-end",
					"h-10 text-xs",
				)}
			>
				<span>{label}</span>
				{isActive ? (
					<span aria-hidden className="text-primary font-bold text-micro">
						{sortDirection === "asc" ? "▲" : "▼"}
					</span>
				) : (
					<ArrowUpDown aria-hidden className="h-3 w-3 opacity-30" />
				)}
			</button>
		</TableHead>
	);
}

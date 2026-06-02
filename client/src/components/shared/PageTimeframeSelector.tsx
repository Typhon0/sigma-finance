import { Button } from "../ui/button";

export type TimeRange = "1D" | "5D" | "7D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL" | "MAX";

interface PageTimeframeSelectorProps {
	value: TimeRange;
	onChange: (range: TimeRange) => void;
	ranges?: TimeRange[];
	className?: string;
}

export function PageTimeframeSelector({
	value,
	onChange,
	ranges = ["1D", "1M", "3M", "YTD", "1Y", "MAX"],
	className,
}: PageTimeframeSelectorProps) {
	return (
		<div className={`flex items-center gap-1 bg-muted/30 p-1 rounded-md ${className}`}>
			{ranges.map((r) => (
				<Button
					key={r}
					variant={value === r ? "secondary" : "ghost"}
					size="sm"
					onClick={() => onChange(r)}
					className="h-7 px-3 text-[11px] font-medium"
				>
					{r}
				</Button>
			))}
		</div>
	);
}

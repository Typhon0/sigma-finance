import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface AssetPageHeaderProps {
	title: string;
	description: string;
	onBack?: () => void;
	backLabel?: string;
	actions?: ReactNode;
}

export function AssetPageHeader({
	title,
	description,
	onBack,
	backLabel = "Back to Portfolios",
	actions,
}: AssetPageHeaderProps) {
	return (
		<div className="flex flex-col space-y-2 border-b border-border/30 pb-4">
			{onBack && (
				<button
					type="button"
					className="group inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors focus:outline-hidden bg-transparent border-0 p-0 text-left w-fit"
					onClick={onBack}
				>
					<ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
					<span>{backLabel}</span>
				</button>
			)}

			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-1">
				<div className="space-y-0.5">
					<h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
					<p className="text-xs text-muted-foreground">{description}</p>
				</div>
				{actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
			</div>
		</div>
	);
}

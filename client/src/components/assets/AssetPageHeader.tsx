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
					className="group inline-flex items-center gap-1 text-micro font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors focus:outline-hidden bg-transparent border-0 p-0 text-left w-fit touch-target"
					onClick={onBack}
				>
					<ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
					<span>{backLabel}</span>
				</button>
			)}

			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-1">
				<div className="space-y-0.5 text-left">
					<h1 className="text-2xl font-bold tracking-tight text-foreground text-left">{title}</h1>
					<p className="text-xs text-muted-foreground text-left">{description}</p>
				</div>
				{/* Wraps on narrow screens: the actions row (market chip + import +
				    add) is wider than a 390px viewport and used to push the primary
				    button off-screen. */}
				{actions && (
					<div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">{actions}</div>
				)}
			</div>
		</div>
	);
}

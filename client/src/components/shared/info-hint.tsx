import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface InfoHintProps {
	/**
	 * Short accessible name: what this affordance explains (e.g. "What is
	 * Price Return?"). The name is what a screen reader announces, so it
	 * must stand on its own.
	 */
	label: string;
	/**
	 * The explanation itself. It is shown as the tooltip AND exposed as the
	 * trigger's description, so it is announced on focus rather than only
	 * on hover.
	 */
	children: ReactNode;
	className?: string;
}

/**
 * An explanation affordance that keyboard and assistive-tech users can
 * actually reach. A bare hover-only icon is invisible to them: here the
 * trigger is a real button with a name, and the explanation is its
 * description — announced when the button takes focus, not only when a
 * pointer hovers it. The same text opens as a tooltip for sighted users.
 */
export function InfoHint({ label, children, className }: InfoHintProps) {
	const descriptionId = useId();
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						aria-label={label}
						aria-describedby={descriptionId}
						className={cn(
							"inline-flex items-center p-1.5 -m-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-help",
							className,
						)}
					>
						<HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
					</button>
				</TooltipTrigger>
				<span id={descriptionId} className="sr-only">
					{children}
				</span>
				<TooltipContent className="max-w-72">{children}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

interface ExplainedProps {
	/**
	 * The explanation, exposed as the trigger's description and shown as the
	 * tooltip. Rich content is allowed — it renders in both places.
	 */
	description: ReactNode;
	/** The visible content the explanation belongs to (a badge, a figure). */
	children: ReactNode;
	className?: string;
	/** Tooltip placement — a header badge can sit under the sheet's sticky header. */
	side?: "top" | "right" | "bottom" | "left";
	align?: "start" | "center" | "end";
	/** Extra classes for the tooltip surface (the repo caps its width). */
	tooltipClassName?: string;
}

/**
 * Makes an existing piece of content explainable: the content becomes a
 * focusable trigger whose accessible name stays the visible text, with the
 * explanation attached as its description. Used where a `title` attribute
 * used to carry the reason — a title is unreachable by keyboard and is not
 * reliably announced at all.
 */
export function Explained({
	description,
	children,
	className,
	side,
	align,
	tooltipClassName,
}: ExplainedProps) {
	const descriptionId = useId();
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						aria-describedby={descriptionId}
						className={cn(
							"inline-flex items-center py-1 -my-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-help",
							className,
						)}
					>
						{children}
					</button>
				</TooltipTrigger>
				<span id={descriptionId} className="sr-only">
					{description}
				</span>
				<TooltipContent className={cn("max-w-72", tooltipClassName)} side={side} align={align}>
					{description}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

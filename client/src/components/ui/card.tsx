import type * as React from "react";

import { cn } from "@/lib/utils";

/*
 * Card family
 *
 * Style-sensitive properties (padding, gap, radius, shadow) are driven
 * by CSS variables defined in themes.css and the per-style files.
 * The component markup focuses on layout; visual identity lives in CSS.
 */

function Card({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card" className={cn("ui-card", className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-header" className={cn("ui-card-header", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-title" className={cn("ui-card-title", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="card-description" className={cn("ui-card-description", className)} {...props} />
	);
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-content" className={cn("ui-card-content", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-footer" className={cn("ui-card-footer", className)} {...props} />;
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };

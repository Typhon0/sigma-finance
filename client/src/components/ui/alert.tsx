import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("ui-alert", {
	variants: {
		variant: {
			default: "bg-card text-card-foreground",
			destructive:
				"bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="alert-title" className={cn("ui-alert-title", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn("ui-alert-description", className)}
			{...props}
		/>
	);
}

export { Alert, AlertDescription, AlertTitle };

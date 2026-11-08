import { cva, type VariantProps } from "class-variance-authority";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import type * as React from "react";

import { cn } from "@/lib/utils";

const toggleVariants = cva("ui-toggle", {
	variants: {
		variant: {
			default: "bg-transparent",
			outline:
				"border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
		},
		size: {
			default: "",
			sm: "",
			lg: "",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

function Toggle({
	className,
	variant,
	size,
	...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
	return (
		<TogglePrimitive.Root
			data-slot="toggle"
			className={cn(toggleVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Toggle, toggleVariants };

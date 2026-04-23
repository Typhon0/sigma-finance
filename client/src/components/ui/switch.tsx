"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
	className,
	size = "default",
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
	size?: "sm" | "default";
}) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			className={cn("peer group/switch ui-switch", className)}
			{...props}
		>
			<SwitchPrimitive.Thumb data-slot="switch-thumb" className={cn("ui-switch-thumb")} />
		</SwitchPrimitive.Root>
	);
}

export { Switch };
